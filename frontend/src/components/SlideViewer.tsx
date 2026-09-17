import { useEffect, useState } from "react";

import { toBullets } from "../lib/format.ts";
import type { Slide } from "../lib/types.ts";

function SlideImage({ slide }: { slide: Slide }) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  // No URL, or the ImageKit URL failed to load — show the prompt instead of a broken image
  if (!slide.imageUrl || state === "error") {
    return (
      <div className="slide-image slide-image-empty">
        <span className="mono">{slide.imageUrl ? "image failed to load" : "no image"}</span>
        <p>{slide.imagePrompt}</p>
      </div>
    );
  }

  return (
    <div className="slide-image" data-loaded={state === "loaded"}>
      <img
        src={slide.imageUrl}
        alt={slide.imagePrompt}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
      />
    </div>
  );
}

function Thumbnail({ slide }: { slide: Slide }) {
  const [failed, setFailed] = useState(false);

  if (!slide.imageUrl || failed) return <span>{slide.order}</span>;

  return <img src={slide.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

type Props = {
  slides: Slide[];
  generating: boolean;
};

export function SlideViewer({ slides, generating }: Props) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  // Clamp: a re-run can shrink the slide list below the stored index
  const position = Math.max(0, Math.min(index, count - 1));
  const current = slides[position];

  // Arrow keys flip slides (ignored while typing in the composer)
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLTextAreaElement || count === 0) return;
      if (event.key === "ArrowRight") setIndex((i) => Math.min(Math.min(i, count - 1) + 1, count - 1));
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(Math.min(i, count - 1) - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);

  if (!current) {
    return (
      <div className="slide slide-placeholder">
        <div className="press-lines" data-active={generating} aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <p className="muted">
          {generating ? "Slides appear here as each one is illustrated and saved." : "This deck has no slides."}
        </p>
      </div>
    );
  }

  return (
    <div className="viewer">
      <article className="slide" key={current.id}>
        <div className="slide-text">
          <span className="mono muted">
            {String(current.order).padStart(2, "0")} / {String(count).padStart(2, "0")}
            {generating && " · more coming"}
          </span>
          <h3 className="slide-title">{current.title}</h3>
          <ul className="slide-bullets">
            {toBullets(current.content).map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        </div>
        <SlideImage key={current.imageUrl ?? current.id} slide={current} />
      </article>

      <div className="viewer-controls">
        <button
          type="button"
          className="button-ghost"
          onClick={() => setIndex(position - 1)}
          disabled={position === 0}
          aria-label="Previous slide"
        >
          ←
        </button>

        <ol className="filmstrip">
          {slides.map((slide, i) => (
            <li key={slide.id}>
              <button
                type="button"
                className="thumb"
                aria-current={i === position}
                aria-label={`Slide ${slide.order}: ${slide.title}`}
                onClick={() => setIndex(i)}
              >
                <Thumbnail slide={slide} />
              </button>
            </li>
          ))}
          {generating && (
            <li>
              <span className="thumb thumb-pending" aria-label="Next slide in progress" />
            </li>
          )}
        </ol>

        <button
          type="button"
          className="button-ghost"
          onClick={() => setIndex(position + 1)}
          disabled={position >= count - 1}
          aria-label="Next slide"
        >
          →
        </button>
      </div>
    </div>
  );
}
