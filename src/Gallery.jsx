import { useEffect, useRef, useState } from "react";
import Backdrop from "./Backdrop.jsx";

const PAGE_SIZE = 12;
// Dropbox can only make thumbnails for these (not HEIC or video).
const THUMB_OK = /\.(jpe?g|png|gif|webp|bmp|tiff?|ppm)$/i;

function pageList(page, pages) {
  const nums = [...new Set([1, pages, page - 1, page, page + 1])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push(`gap-${n}`);
    out.push(n);
  });
  return out;
}

export default function Gallery() {
  const [items, setItems] = useState(null); // null while loading
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [thumbs, setThumbs] = useState({}); // id -> data URL, or null if unavailable
  const [viewer, setViewer] = useState(null); // index into items, or null
  const requested = useRef(new Set());

  async function load() {
    setError(false);
    setItems(null);
    try {
      const res = await fetch("/api/gallery");
      if (!res.ok) throw new Error("load failed");
      setItems((await res.json()).items);
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const total = items?.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = items ? items.slice(start, start + PAGE_SIZE) : [];

  // Fetch thumbnails for whichever page is showing
  useEffect(() => {
    const need = pageItems.filter((i) => THUMB_OK.test(i.name) && !requested.current.has(i.id));
    if (!need.length) return;
    need.forEach((i) => requested.current.add(i.id));

    fetch("/api/thumbs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: need.map((i) => i.id) }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("thumbs failed");
        return r.json();
      })
      .then(({ thumbs: t }) => setThumbs((prev) => ({ ...prev, ...t })))
      .catch(() =>
        setThumbs((prev) => ({ ...prev, ...Object.fromEntries(need.map((i) => [i.id, null])) }))
      );
  }, [items, page]);

  function changePage(n) {
    setPage(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function show(index) {
    setViewer(index);
    setPage(Math.floor(index / PAGE_SIZE) + 1); // keep the grid on the same page as the viewer
  }

  function tileFor(item, i) {
    const hasThumb = typeof thumbs[item.id] === "string";
    const loading = !(item.id in thumbs) && THUMB_OK.test(item.name);

    if (loading) return <div key={item.id} className="tile skeleton" aria-hidden="true" />;

    return (
      <button
        key={item.id}
        className={`tile ${hasThumb ? "" : "ph"}`}
        onClick={() => show(start + i)}
        aria-label={`Open ${item.isVideo ? "video" : "photo"} ${start + i + 1} of ${total}`}
      >
        {hasThumb ? (
          <img src={thumbs[item.id]} alt="" loading="lazy" />
        ) : (
          <i className={item.isVideo ? "fa-solid fa-film" : "fa-regular fa-image"} />
        )}
        {item.isVideo && (
          <span className="play">
            <i className="fa-solid fa-play" />
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="gallery-page">
      <Backdrop />

      <header className="g-head">
        <a className="back" href="#">
          <i className="fa-solid fa-arrow-left" /> Back
        </a>
        <div className="g-title">
          <h2>Beach Memories</h2>
          <p>{items ? `${total} moment${total === 1 ? "" : "s"}` : "\u00a0"}</p>
        </div>
        <span />
      </header>

      <main className="g-body">
        {error && (
          <div className="g-msg">
            <p>We couldn’t load the gallery.</p>
            <button className="btn-save" onClick={load}>Try again</button>
          </div>
        )}

        {!error && items === null && (
          <div className="grid" aria-busy="true">
            {Array.from({ length: PAGE_SIZE }, (_, i) => (
              <div key={i} className="tile skeleton" />
            ))}
          </div>
        )}

        {!error && items && total === 0 && (
          <div className="g-msg">
            <p>No memories yet. Be the first to add one!</p>
            <a className="btn-save" href="#">Upload memories</a>
          </div>
        )}

        {!error && items && total > 0 && (
          <>
            <div className="grid">{pageItems.map(tileFor)}</div>

            {pages > 1 && (
              <nav className="pager" aria-label="Pagination">
                <button onClick={() => changePage(page - 1)} disabled={page === 1} aria-label="Previous page">
                  <i className="fa-solid fa-chevron-left" />
                </button>
                {pageList(page, pages).map((p) =>
                  typeof p === "number" ? (
                    <button
                      key={p}
                      className={p === page ? "active" : ""}
                      aria-current={p === page ? "page" : undefined}
                      onClick={() => changePage(p)}
                    >
                      {p}
                    </button>
                  ) : (
                    <span key={p}>…</span>
                  )
                )}
                <button onClick={() => changePage(page + 1)} disabled={page === pages} aria-label="Next page">
                  <i className="fa-solid fa-chevron-right" />
                </button>
              </nav>
            )}
          </>
        )}
      </main>

      {viewer !== null && items && (
        <Lightbox items={items} index={viewer} onChange={show} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}

function Lightbox({ items, index, onChange, onClose }) {
  const item = items[index];
  const [url, setUrl] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | error
  const touchX = useRef(null);
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  // Load the full-size file for the current item
  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setState("loading");
    fetch(`/api/media?id=${encodeURIComponent(item.id)}`)
      .then((r) => {
        if (!r.ok) throw new Error("media failed");
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setUrl(d.url);
        setState("ready");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  // Keyboard: ← → Esc
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onChange(index - 1);
      if (e.key === "ArrowRight" && hasNext) onChange(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Lock page scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (dx > 60 && hasPrev) onChange(index - 1);
        if (dx < -60 && hasNext) onChange(index + 1);
      }}
    >
      <button className="v-close" onClick={onClose} aria-label="Close viewer">
        <i className="fa-solid fa-xmark" />
      </button>

      {hasPrev && (
        <button className="v-nav prev" onClick={() => onChange(index - 1)} aria-label="Previous">
          <i className="fa-solid fa-chevron-left" />
        </button>
      )}
      {hasNext && (
        <button className="v-nav next" onClick={() => onChange(index + 1)} aria-label="Next">
          <i className="fa-solid fa-chevron-right" />
        </button>
      )}

      <div className="v-stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {state === "loading" && <i className="fa-solid fa-circle-notch fa-spin v-spin" />}

        {state === "ready" && url && !item.isVideo && (
          <img src={url} alt={item.name} onError={() => setState("error")} />
        )}
        {state === "ready" && url && item.isVideo && (
          <video key={url} src={url} controls autoPlay playsInline onError={() => setState("error")} />
        )}

        {state === "error" && (
          <div className="v-error">
            <p>This one can’t be previewed here.</p>
            {url && (
              <a href={url} target="_blank" rel="noreferrer">Open original</a>
            )}
          </div>
        )}
      </div>

      <div className="v-count">
        {index + 1} / {items.length}
      </div>
    </div>
  );
}
