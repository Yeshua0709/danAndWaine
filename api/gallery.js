// GET /api/gallery
import { listMedia } from "../lib/dropbox.js";

export default async function handler(_req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ items: await listMedia() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load gallery" });
  }
}
