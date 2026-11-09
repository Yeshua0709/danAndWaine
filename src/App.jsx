import { useEffect, useRef, useState } from "react";

const WAVES = [
  { cls: "wave-1", d: "M0,0 C150,90 350,-40 500,40 C650,120 900,20 1200,60 L1200,120 L0,120 Z" },
  { cls: "wave-2", d: "M0,0 C200,60 400,-20 600,50 C800,120 1000,10 1200,40 L1200,120 L0,120 Z" },
  { cls: "wave-3", d: "M0,30 C150,70 450,-10 700,50 C950,110 1100,30 1200,50 L1200,120 L0,120 Z" },
];

const MAX_BYTES = 150 * 1024 * 1024; // Dropbox upload-link limit per file
const isMedia = (f) =>
  f.type.startsWith("image/") ||
  f.type.startsWith("video/") ||
  /\.(heic|heif|jpe?g|png|webp|gif|mp4|mov|m4v|webm)$/i.test(f.name);

export default function App() {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | uploading | done | partial
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState({ saved: 0, failed: 0 });
  const [tooBig, setTooBig] = useState(0);

  const uploading = status === "uploading";

  function closeModal() {
    if (uploading) return;
    setOpen(false);
    setFiles([]);
    setTooBig(0);
    setStatus("idle");
  }

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && closeModal();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function addFiles(list) {
    const media = Array.from(list).filter(isMedia);
    const ok = media.filter((f) => f.size <= MAX_BYTES);
    setTooBig(media.length - ok.length);
    if (!ok.length) return;
    setFiles((prev) => [...prev, ...ok]);
    setStatus("idle");
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (!files.length || uploading) return;

    const batch = files;
    const failed = [];
    setStatus("uploading");
    setProgress({ done: 0, total: batch.length });

    // One at a time, so a single bad file doesn't sink the batch.
    for (let i = 0; i < batch.length; i++) {
      try {
        // 1) Ask our server for a one-time Dropbox upload link
        const linkRes = await fetch("/api/upload-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: batch[i].name }),
        });
        if (!linkRes.ok) throw new Error("No upload link");
        const { link } = await linkRes.json();

        // 2) Send the photo straight to Dropbox (skips Vercel's 4.5 MB limit)
        const upRes = await fetch(link, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: batch[i],
        });
        if (!upRes.ok) throw new Error("Upload failed");
      } catch {
        failed.push(batch[i]);
      }
      setProgress({ done: i + 1, total: batch.length });
    }

    setFiles(failed); // anything that failed stays in the list for a retry
    setResult({ saved: batch.length - failed.length, failed: failed.length });
    setStatus(failed.length ? "partial" : "done");
  }

  return (
    <div className="app">
      <div className="sun-glow" />

      <header className="top">
        <div className="top-left">
          <i className="fa-solid fa-umbrella-beach" />
          <span>Est. 2024</span>
        </div>
        <div className="top-right">Shoreline Collection</div>
      </header>

      <main className="hero">
        <div className="badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12c0 4.14 2.52 7.69 6.09 9.17.43.14.89-.13.89-.58v-1.74c0-.33-.19-.63-.48-.77-2.31-1.07-3.8-3.41-3.8-6.08 0-3.69 3.01-6.7 6.7-6.7s6.7 3.01 6.7 6.7c0 2.67-1.49 5.01-3.8 6.08-.29.14-.48.44-.48.77v1.74c0 .45.46.72.89.58C19.48 19.69 22 16.14 22 12c0-5.52-4.48-10-10-10z" />
          </svg>
        </div>

        <h1>
          Dan <span className="amp">&amp;</span> Waine
        </h1>
        <p className="subtitle">Our Beach Memories &bull; Capturing Moments by the Shore</p>

        <div className="cta-wrap">
          <button className="cta" onClick={() => setOpen(true)}>
            <i className="fa-solid fa-cloud-arrow-up" />
            <span>UPLOAD MEMORIES</span>
          </button>
        </div>

        <p className="footnote">Share photos &amp; videos from our seaside getaway</p>
      </main>

      <footer className="bottom">
        <p>&copy; Dan &amp; Waine &bull; Soft Waves &amp; Golden Sands</p>
      </footer>

      <div className="waves" aria-hidden="true">
        {WAVES.map((w) => (
          <svg key={w.cls} className={`wave ${w.cls}`} viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d={w.d} />
          </svg>
        ))}
      </div>

      <div
        className={`overlay ${open ? "open" : ""}`}
        onMouseDown={(e) => e.target === e.currentTarget && closeModal()}
      >
        <div className="card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button className="close" onClick={closeModal} aria-label="Close" disabled={uploading}>
            <i className="fa-solid fa-xmark" />
          </button>

          <div className="card-head">
            <span className="card-icon">
              <i className="fa-solid fa-camera-retro" />
            </span>
            <h3 id="modal-title">Add to Beach Album</h3>
            <p>Upload your favorite moments with Dan &amp; Waine</p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div
            className={`drop ${dragging ? "dragging" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
          >
            <div className="drop-icon">
              <i className="fa-solid fa-images" />
            </div>
            <p className="drop-title">Tap to choose photos or videos</p>
            <p className="drop-sub">or drag &amp; drop them here</p>
            <span className="pill">JPG, PNG, HEIC, MP4, MOV &bull; up to 150 MB each</span>
          </div>

          {files.length > 0 && (
            <ul className="files">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`}>
                  <i className={f.type.startsWith("video/") ? "fa-solid fa-film" : "fa-regular fa-image"} />
                  <span className="fname">{f.name}</span>
                  {!uploading && (
                    <button onClick={() => removeFile(i)} aria-label={`Remove ${f.name}`}>
                      <i className="fa-solid fa-xmark" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {tooBig > 0 && (
            <div className="note warn">
              <i className="fa-solid fa-triangle-exclamation" />
              <p className="note-title">
                {tooBig} file{tooBig > 1 ? "s were" : " was"} too large
              </p>
              <p className="note-sub">Each photo or video can be up to 150 MB.</p>
            </div>
          )}

          <div role="status" aria-live="polite">
            {status === "done" && (
              <div className="note success">
                <i className="fa-solid fa-circle-check" />
                <p className="note-title">Memories uploaded successfully!</p>
                <p className="note-sub">Saved to Dan &amp; Waine’s beach archive.</p>
              </div>
            )}
            {status === "partial" && (
              <div className="note warn">
                <i className="fa-solid fa-triangle-exclamation" />
                <p className="note-title">
                  {result.saved} saved, {result.failed} didn’t go through
                </p>
                <p className="note-sub">Tap Save Memories to try the rest again.</p>
              </div>
            )}
          </div>

          <div className="actions">
            <button className="btn-ghost" onClick={closeModal} disabled={uploading}>
              {status === "done" ? "Close" : "Cancel"}
            </button>
            <button className="btn-save" onClick={save} disabled={!files.length || uploading}>
              {uploading ? `Saving ${progress.done} of ${progress.total}…` : "Save Memories"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}