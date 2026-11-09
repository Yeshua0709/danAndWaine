import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN } = process.env;
const FOLDER = process.env.DROPBOX_FOLDER || "/Wedding Photos";
const PORT = process.env.PORT || 3001;

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB per photo
});

// --- Dropbox access token (refreshed automatically, cached in memory) ---
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

// Dropbox-API-Arg must be ASCII, so keep filenames simple.
function safeName(original) {
  const ext = path.extname(original).replace(/[^.\w]/g, "").slice(0, 8) || ".jpg";
  const base = path.basename(original, path.extname(original))
    .replace(/[^\w\- ]/g, "")
    .trim()
    .slice(0, 60) || "photo";
  return `${Date.now()}-${base}${ext}`;
}

app.post("/api/upload", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({ error: "Images only" });
    }

    const token = await getAccessToken();
    const dropboxRes = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: `${FOLDER}/${safeName(req.file.originalname)}`,
          mode: "add",
          autorename: true,
          mute: true,
        }),
      },
      body: req.file.buffer,
    });

    if (!dropboxRes.ok) throw new Error(await dropboxRes.text());
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// In production, serve the built React app from the same server.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
