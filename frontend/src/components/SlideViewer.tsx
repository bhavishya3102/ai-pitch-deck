import { useEffect, useState } from "react";

import { useRegenerateSlideImage } from "../lib/api.ts";
import { toBullets } from "../lib/format.ts";
import type { Slide } from "../lib/types.ts";
import { SlideEditor } from "./SlideEditor.tsx";

function SlideImage({ slide, deckId }: { slide: Slide; deckId: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const regenerate = useRegenerateSlideImage(deckId);

  const working = slide.imageStatus === "GENERATING" || regenerate.isPending;
  const missing = !slide.imageUrl || state === "error";

  const actions = (
    <div className="slide-image-actions">
      {slide.imageStatus === "FAILED" && !regenerate.isPending && (
        <span className="mono image-failed">couldn't re-illustrate</span>
      )}
      <button
        type="button"
        className="image-button"
        onClick={() => regenerate.mutate(slide.id)}
        disabled={working}
        title="Generate a new image from the image prompt"
      >
        {working ? "Re-illustrating…" : "Regenerate image"}
      </button>
    </div>
  );

  return (
    <div className="slide-image" data-loaded={state === "loaded" && !missing} data-working={working}>
      {missing ? (
        <div className="slide-image-empty">
          <span className="mono">{slide.imageUrl ? "image failed to load" : "no image"}</span>
          <p>{slide.imagePrompt}</p>
        </div>
      ) : (
        <img
          src={slide.imageUrl ?? ""}
          alt={slide.imagePrompt}
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
        />
      )}

      {working && <span className="mono image-working">new image on the way…</span>}
      {actions}
      {regenerate.isError && (
        <p className="form-error image-error" role="alert">
          {regenerate.error.message}
        </p>
      )}
    </div>
  );
}

function Thumbnail({ slide }: { slide: Slide }) {
  const [failed, setFailed] = useState(false);

  if (!slide.imageUrl || failed) return <span>{slide.order}</span>;

  return <img src={slide.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

type Props = {
  deckId: string;
  slides: Slide[];
  generating: boolean;
  index: number;
  onIndexChange: (index: number) => void;
  /** Off while presenting, so the two views don't fight over the arrow keys */
  keyboardEnabled: boolean;
  onPresent: () => void;
};

export function SlideViewer({ deckId, slides, generating, index, onIndexChange, keyboardEnabled, onPresent }: Props) {
  // Editor is tied to a slide id, so moving to another slide closes it on its own
  const [editingId, setEditingId] = useState<string | null>(null);
  const setIndex = onIndexChange;
  const count = slides.length;
  // Clamp: a re-run can shrink the slide list below the stored index
  const position = Math.max(0, Math.min(index, count - 1));
  const current = slides[position];
  const editing = current ? editingId === current.id : false;

  // Arrow keys flip slides (ignored while typing anywhere)
  useEffect(() => {
    if (!keyboardEnabled || editing) return;

    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement || count === 0) return;
      if (event.key === "ArrowRight") setIndex(Math.min(position + 1, count - 1));
      if (event.key === "ArrowLeft") setIndex(Math.max(position - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, editing, keyboardEnabled, position, setIndex]);

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

          {editing ? (
            <SlideEditor deckId={deckId} slide={current} onClose={() => setEditingId(null)} />
          ) : (
            <>
              <h3 className="slide-title">{current.title}</h3>
              <ul className="slide-bullets">
                {toBullets(current.content).map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
              <button type="button" className="edit-slide" onClick={() => setEditingId(current.id)}>
                Edit slide
              </button>
            </>
          )}
        </div>
        <SlideImage key={current.imageUrl ?? current.id} slide={current} deckId={deckId} />
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

        <button type="button" className="button-primary present-start" onClick={onPresent}>
          Present
          <span aria-hidden>▶</span>
        </button>
      </div>
    </div>
  );
}
