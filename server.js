// Local dev server (and optional Node hosting). On Vercel, the files in /api are used instead.
import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { createUploadLink, listMedia, getThumbs, getTempLink, isValidId } = await import("./lib/dropbox.js");
const PORT = process.env.PORT || 3001;
const app = express();
app.use(express.json());

const fail = (res, err, msg) => {
  console.error(err);
  res.status(500).json({ error: msg });
};

app.post("/api/upload-link", async (req, res) => {
  try { res.json({ link: await createUploadLink(req.body?.filename) }); }
  catch (err) { fail(res, err, "Could not create upload link"); }
});

app.get("/api/gallery", async (_req, res) => {
  try { res.json({ items: await listMedia() }); }
  catch (err) { fail(res, err, "Could not load gallery"); }
});

app.post("/api/thumbs", async (req, res) => {
  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || !ids.length || !ids.every(isValidId)) {
      return res.status(400).json({ error: "Bad ids" });
    }
    res.json({ thumbs: await getThumbs(ids) });
  } catch (err) { fail(res, err, "Could not load thumbnails"); }
});

app.get("/api/media", async (req, res) => {
  try {
    if (!isValidId(req.query.id)) return res.status(400).json({ error: "Bad id" });
    res.json({ url: await getTempLink(req.query.id) });
  } catch (err) { fail(res, err, "Could not load file"); }
});

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
