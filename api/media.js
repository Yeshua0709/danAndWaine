// GET /api/media?id=id:...
import { getTempLink, isValidId } from "../lib/dropbox.js";

export default async function handler(req, res) {
  try {
    const id = req.query?.id;
    if (!isValidId(id)) return res.status(400).json({ error: "Bad id" });
    res.status(200).json({ url: await getTempLink(id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load file" });
  }
}
