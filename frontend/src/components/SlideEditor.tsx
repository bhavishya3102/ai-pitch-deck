import { useState, type FormEvent } from "react";

import { useUpdateSlide } from "../lib/api.ts";
import type { Slide } from "../lib/types.ts";

// Same limits the agent's schema enforces on the backend
const LIMITS = {
  title: { min: 3, max: 80 },
  content: { min: 20, max: 500 },
  imagePrompt: { min: 10, max: 300 },
};

type Props = {
  deckId: string;
  slide: Slide;
  onClose: () => void;
};

export function SlideEditor({ deckId, slide, onClose }: Props) {
  const [title, setTitle] = useState(slide.title);
  const [content, setContent] = useState(slide.content);
  const [imagePrompt, setImagePrompt] = useState(slide.imagePrompt);
  const updateSlide = useUpdateSlide(deckId);

  const problem =
    title.trim().length < LIMITS.title.min
      ? "Title is too short"
      : title.length > LIMITS.title.max
        ? "Title is too long"
        : content.trim().length < LIMITS.content.min
          ? `Content needs ${LIMITS.content.min - content.trim().length} more characters`
          : content.length > LIMITS.content.max
            ? "Content is too long"
            : imagePrompt.trim().length < LIMITS.imagePrompt.min
              ? "Image prompt is too short"
              : imagePrompt.length > LIMITS.imagePrompt.max
                ? "Image prompt is too long"
                : null;

  const changed =
    title !== slide.title || content !== slide.content || imagePrompt !== slide.imagePrompt;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (problem || !changed || updateSlide.isPending) return;

    updateSlide.mutate(
      { slideId: slide.id, title: title.trim(), content: content.trim(), imagePrompt: imagePrompt.trim() },
      { onSuccess: onClose },
    );
  }

  return (
    <form className="slide-editor" onSubmit={handleSubmit}>
      <label className="editor-field">
        <span className="eyebrow">Title</span>
        <input
          className="editor-input"
          value={title}
          maxLength={LIMITS.title.max}
          onChange={(event) => setTitle(event.target.value)}
          autoFocus
        />
      </label>

      <label className="editor-field">
        <span className="eyebrow">
          Bullet points <span className="muted">· one per line</span>
        </span>
        <textarea
          className="editor-input editor-area"
          rows={5}
          value={content}
          maxLength={LIMITS.content.max}
          onChange={(event) => setContent(event.target.value)}
        />
      </label>

      <label className="editor-field">
        <span className="eyebrow">
          Image prompt <span className="muted">· used when you re-illustrate</span>
        </span>
        <textarea
          className="editor-input editor-area"
          rows={2}
          value={imagePrompt}
          maxLength={LIMITS.imagePrompt.max}
          onChange={(event) => setImagePrompt(event.target.value)}
        />
      </label>

      <div className="editor-actions">
        <span className="mono muted">{problem ?? (changed ? "Unsaved changes" : "No changes yet")}</span>
        <div className="editor-buttons">
          <button type="button" className="button-ghost editor-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button-primary" disabled={!!problem || !changed || updateSlide.isPending}>
            {updateSlide.isPending ? "Saving…" : "Save slide"}
          </button>
        </div>
      </div>

      {updateSlide.isError && (
        <p className="form-error" role="alert">
          {updateSlide.error.message}
        </p>
      )}
    </form>
  );
}
