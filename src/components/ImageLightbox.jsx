import { useState, useEffect, useCallback } from "react";
import { XIcon } from "../admin/icons.jsx";

/**
 * ImageLightbox — full-screen image viewer with navigation.
 *
 * Props:
 *   images   — string[] of image URLs
 *   initial  — starting index (default 0)
 *   open     — boolean, whether the lightbox is visible
 *   onClose  — () => void
 */
export default function ImageLightbox({ images, initial = 0, open, onClose }) {
  const [idx, setIdx] = useState(initial);

  // Sync index when initial changes or lightbox opens
  useEffect(() => {
    if (open) setIdx(initial);
  }, [open, initial]);

  const count = images?.length ?? 0;
  const hasPrev = idx > 0;
  const hasNext = idx < count - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) setIdx((i) => i - 1);
  }, [hasPrev]);

  const goNext = useCallback(() => {
    if (hasNext) setIdx((i) => i + 1);
  }, [hasNext]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowLeft") { goNext(); return; }   // RTL: left = next
      if (e.key === "ArrowRight") { goPrev(); return; }  // RTL: right = prev
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, goPrev, goNext]);

  if (!open || count === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="عارض الصور"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="إغلاق"
        className="absolute top-4 left-4 z-10 cursor-pointer rounded-full bg-white/90 p-2 text-earth-800 shadow-md transition hover:bg-white hover:text-maroon-700"
      >
        <XIcon className="h-5 w-5" />
      </button>

      {/* Image counter */}
      {count > 1 && (
        <span className="absolute top-4 right-4 z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-earth-700 shadow-md">
          {idx + 1} / {count}
        </span>
      )}

      {/* Previous arrow (RTL: right side) */}
      {hasPrev && (
        <button
          type="button"
          onClick={goPrev}
          aria-label="الصورة السابقة"
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-full bg-white/90 p-2.5 text-earth-800 shadow-md transition hover:bg-white hover:text-maroon-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Next arrow (RTL: left side) */}
      {hasNext && (
        <button
          type="button"
          onClick={goNext}
          aria-label="الصورة التالية"
          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-full bg-white/90 p-2.5 text-earth-800 shadow-md transition hover:bg-white hover:text-maroon-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}

      {/* Main image */}
      <div className="relative z-[1] flex max-h-[85vh] max-w-[90vw] flex-col items-center">
        <img
          key={images[idx]}
          src={images[idx]}
          alt={`صورة ${idx + 1}`}
          className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl transition-opacity duration-200"
        />

        {/* Thumbnail dots */}
        {count > 1 && (
          <div className="mt-3 flex items-center gap-1.5">
            {images.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`الانتقال إلى الصورة ${i + 1}`}
                className={`cursor-pointer rounded-full transition-all duration-200 ${
                  i === idx
                    ? "h-3 w-3 bg-maroon-600 shadow-sm"
                    : "h-2 w-2 bg-white/60 hover:bg-white/90"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
