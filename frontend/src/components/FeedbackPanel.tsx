import { useState } from "react";

import { useApplyNote, useDeleteNote, useUpdateNote } from "../lib/api.ts";
import { timeAgo } from "../lib/format.ts";
import type { Slide, SlideNote } from "../lib/types.ts";

function NoteRow({ deckId, slide, note }: { deckId: string; slide: Slide; note: SlideNote }) {
  // Rows stay collapsed until you click into one: a meeting can leave half a dozen
  // flags, and a column of open textareas is unreadable. It also means the editor
  // only ever appears from a click, so its autofocus can't steal the arrow keys
  // from a presentation running over this panel.
  const [draft, setDraft] = useState<string | null>(null);
  const updateNote = useUpdateNote(deckId);
  const deleteNote = useDeleteNote(deckId);
  const applyNote = useApplyNote(deckId);
  const editing = draft !== null;
  // One slide is rewritten at a time, so the whole group waits together
  const rewriting = slide.textStatus === "REWRITING" || applyNote.isPending;

  function save() {
    const body = (draft ?? "").trim();
    // Nothing typed yet — leave it as a flag rather than saving an empty edit
    if (!body) return;
    updateNote.mutate({ noteId: note.id, body }, { onSuccess: () => setDraft(null) });
  }

  function handleKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") setDraft(null);
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      save();
    }
  }

  return (
    <li className="note" data-resolved={note.resolved}>
      <input
        type="checkbox"
        className="note-tick"
        checked={note.resolved}
        disabled={updateNote.isPending}
        onChange={(event) => updateNote.mutate({ noteId: note.id, resolved: event.target.checked })}
        aria-label={note.resolved ? "Mark as still open" : "Mark as handled"}
      />

      <div className="note-main">
        {editing ? (
          <>
            <textarea
              className="editor-input editor-area note-input"
              rows={2}
              maxLength={500}
              autoFocus
              placeholder="What needs to change on this slide?"
              value={draft ?? ""}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKey}
            />
            <div className="note-meta mono">
              <button type="button" className="note-link" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="note-link note-save"
                onClick={save}
                disabled={!draft?.trim() || updateNote.isPending}
              >
                {updateNote.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="note-body" data-empty={note.body === ""}>
              {note.body || "Flagged — no detail yet"}
            </p>
            <div className="note-meta mono">
              <span className="muted">{timeAgo(note.createdAt)}</span>
              {note.body && !note.resolved && (
                <button
                  type="button"
                  className="note-link note-apply"
                  onClick={() => applyNote.mutate({ slideId: slide.id, noteId: note.id })}
                  disabled={rewriting}
                  title="Let the agent rewrite this slide from this feedback"
                >
                  {rewriting ? "Rewriting…" : "Apply with AI"}
                </button>
              )}
              <button type="button" className="note-link" onClick={() => setDraft(note.body)}>
                {note.body ? "Edit" : "Add detail"}
              </button>
              <button
                type="button"
                className="note-link note-delete"
                onClick={() => deleteNote.mutate(note.id)}
                disabled={deleteNote.isPending}
              >
                Delete
              </button>
            </div>
          </>
        )}

        {updateNote.isError && (
          <p className="form-error" role="alert">
            {updateNote.error.message}
          </p>
        )}
        {deleteNote.isError && (
          <p className="form-error" role="alert">
            {deleteNote.error.message}
          </p>
        )}
        {applyNote.isError && (
          <p className="form-error" role="alert">
            {applyNote.error.message}
          </p>
        )}
      </div>
    </li>
  );
}

type Props = {
  deckId: string;
  slides: Slide[];
  /** Clicking a slide heading brings it up in the viewer above */
  onJumpToSlide: (index: number) => void;
};

/**
 * Everything the room asked for, grouped by slide. Notes arrive from the
 * presentation (N and M) and are worked through here afterwards.
 */
export function FeedbackPanel({ deckId, slides, onJumpToSlide }: Props) {
  const groups = slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide }) => slide.notes.length > 0);

  const open = groups.reduce(
    (total, { slide }) => total + slide.notes.filter((note) => !note.resolved).length,
    0,
  );

  return (
    <section className="feedback" aria-label="Feedback">
      <header className="feedback-head">
        <h2 className="eyebrow">Feedback from the room</h2>
        {groups.length > 0 && (
          <span className="mono muted">{open > 0 ? `${open} open` : "all handled"}</span>
        )}
      </header>

      {groups.length === 0 ? (
        <p className="feedback-empty muted">
          While presenting, press <kbd>N</kbd> to write down what someone says, or <kbd>M</kbd> to flag
          the slide and fill in the detail later. Notes land here.
        </p>
      ) : (
        <ol className="feedback-list">
          {groups.map(({ slide, index }) => (
            <li key={slide.id} className="feedback-group">
              <div className="feedback-group-head">
                <button type="button" className="feedback-slide" onClick={() => onJumpToSlide(index)}>
                  <span className="mono">{String(slide.order).padStart(2, "0")}</span>
                  {slide.title}
                </button>
                {slide.textStatus === "REWRITING" && (
                  <span className="mono muted">rewriting from feedback…</span>
                )}
                {slide.textStatus === "FAILED" && (
                  <span className="mono note-failed">couldn't rewrite this slide</span>
                )}
              </div>
              <ul className="note-list">
                {/* Unresolved first — the list stays a to-do list */}
                {[...slide.notes]
                  .sort((a, b) => Number(a.resolved) - Number(b.resolved))
                  .map((note) => (
                    <NoteRow key={note.id} deckId={deckId} slide={slide} note={note} />
                  ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
