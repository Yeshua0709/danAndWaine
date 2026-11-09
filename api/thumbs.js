// POST /api/thumbs  { ids: ["id:...", ...] }
import { getThumbs, isValidId } from "../lib/dropbox.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || !ids.length || !ids.every(isValidId)) {
      return res.status(400).json({ error: "Bad ids" });
    }
    res.status(200).json({ thumbs: await getThumbs(ids) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load thumbnails" });
  }
}
