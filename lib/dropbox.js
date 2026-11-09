// Shared Dropbox helpers, used by the local server and the Vercel function.
const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN } = process.env;
const FOLDER = process.env.DROPBOX_FOLDER || "/Wedding Photos";

let cached = { token: null, expiresAt: 0 };

async function getAccessToken() {
  if (cached.token && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: DROPBOX_REFRESH_TOKEN,
      client_id: DROPBOX_APP_KEY,
      client_secret: DROPBOX_APP_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Dropbox auth failed: ${await res.text()}`);

  const data = await res.json();
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

function safeName(original = "photo.jpg") {
  const dot = original.lastIndexOf(".");
  const ext = (dot > -1 ? original.slice(dot) : ".jpg").replace(/[^.\w]/g, "").slice(0, 8) || ".jpg";
  const base = (dot > -1 ? original.slice(0, dot) : original)
    .replace(/[^\w\- ]/g, "")
    .trim()
    .slice(0, 60) || "photo";
  return `${Date.now()}-${base}${ext}`;
}

// Returns a one-time Dropbox URL the browser can upload a file to directly.
export async function createUploadLink(filename) {
  const token = await getAccessToken();
  const res = await fetch("https://api.dropboxapi.com/2/files/get_temporary_upload_link", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      commit_info: {
        path: `${FOLDER}/${safeName(filename)}`,
        mode: "add",
        autorename: true,
        mute: true,
      },
      duration: 14400,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).link;
}

// ---------------- Gallery helpers (need files.content.read + files.metadata.read) ----------------
const IMG = /\.(jpe?g|png|gif|webp|bmp|tiff?|ppm|heic|heif)$/i;
const VID = /\.(mp4|mov|m4v|webm|avi|mkv)$/i;

export const isValidId = (id) => typeof id === "string" && /^id:[\w-]+$/.test(id);

async function dbx(endpoint, body, host = "api") {
  const token = await getAccessToken();
  const res = await fetch(`https://${host}.dropboxapi.com/2/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

let listCache = { at: 0, items: [] };

// Every photo/video in the folder, newest first.
export async function listMedia() {
  if (Date.now() - listCache.at < 15_000) return listCache.items;

  let entries = [];
  try {
    let res = await dbx("files/list_folder", { path: FOLDER, limit: 2000 });
    entries = res.entries;
    while (res.has_more) {
      res = await dbx("files/list_folder/continue", { cursor: res.cursor });
      entries.push(...res.entries);
    }
  } catch (err) {
    if (String(err.message).includes("not_found")) return []; // nothing uploaded yet
    throw err;
  }

  const items = entries
    .filter((e) => e[".tag"] === "file" && (IMG.test(e.name) || VID.test(e.name)))
    .sort((a, b) => new Date(b.server_modified) - new Date(a.server_modified))
    .map((e) => ({ id: e.id, name: e.name, isVideo: VID.test(e.name) }));

  listCache = { at: Date.now(), items };
  return items;
}

// Small preview images (up to 25 at a time). Failures come back as null.
export async function getThumbs(ids) {
  const list = ids.slice(0, 25);
  const data = await dbx(
    "files/get_thumbnail_batch",
    { entries: list.map((path) => ({ path, format: "jpeg", size: "w480h320", mode: "fitone_bestfit" })) },
    "content"
  );
  const out = {};
  data.entries.forEach((e, i) => {
    out[list[i]] = e[".tag"] === "success" ? `data:image/jpeg;base64,${e.thumbnail}` : null;
  });
  return out;
}

// A link (valid ~4 hours) to the full-size photo or video.
export async function getTempLink(id) {
  return (await dbx("files/get_temporary_link", { path: id })).link;
}
