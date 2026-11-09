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