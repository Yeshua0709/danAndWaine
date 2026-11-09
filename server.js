// Local dev server (and optional Node hosting). On Vercel, api/upload-link.js is used instead.
import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { createUploadLink } = await import("./lib/dropbox.js");
const PORT = process.env.PORT || 3001;
const app = express();

app.post("/api/upload-link", express.json(), async (req, res) => {
  try {
    const link = await createUploadLink(req.body?.filename);
    res.json({ link });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create upload link" });
  }
});

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));