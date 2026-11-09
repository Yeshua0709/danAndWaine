// Vercel serverless function: POST /api/upload-link
import { createUploadLink } from "../lib/dropbox.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { filename } = req.body || {};
    const link = await createUploadLink(filename);
    res.status(200).json({ link });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create upload link" });
  }
}