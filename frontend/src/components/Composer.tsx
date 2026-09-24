import { useState, type FormEvent, type KeyboardEvent } from "react";

import { ApiError, useCreateDeck } from "../lib/api.ts";
import { takePendingIdea } from "../lib/pending-idea.ts";

const MIN_LENGTH = 20;

const EXAMPLES = [
  "A marketplace that lets small farmers sell produce directly to city restaurants",
  "An AI tutor that helps students prepare for coding interviews with mock rounds",
  "A subscription service that repairs and refurbishes used smartphones",
];

export function Composer({ onCreated }: { onCreated: (id: string) => void }) {
  // An idea typed on the landing page before signing in lands here
  const [idea, setIdea] = useState(() => takePendingIdea() ?? "");
  const createDeck = useCreateDeck();

  const length = idea.trim().length;
  const ready = length >= MIN_LENGTH && !createDeck.isPending;

  function submit() {
    if (!ready) return;
    createDeck.mutate(idea.trim(), {
      onSuccess: ({ id }) => {
        setIdea("");
        onCreated(id);
      },
      onError: (error) => {
        // Deck was saved but couldn't be queued — open it so the FAILED reason is visible
        if (error instanceof ApiError && error.body?.id) onCreated(error.body.id);
      },
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <label className="eyebrow" htmlFor="idea">
        New deck
      </label>
      <textarea
        id="idea"
        className="composer-input"
        placeholder="Describe your startup idea…"
        rows={4}
        value={idea}
        onChange={(event) => setIdea(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      <div className="composer-examples">
        {EXAMPLES.map((example) => (
          <button key={example} type="button" className="chip" onClick={() => setIdea(example)}>
            {example.split(" ").slice(0, 4).join(" ")}…
          </button>
        ))}
      </div>

      <div className="composer-footer">
        <span className="mono muted" data-ok={length >= MIN_LENGTH}>
          {length < MIN_LENGTH ? `${MIN_LENGTH - length} more characters` : "⌘/Ctrl + Enter"}
        </span>
        <button type="submit" className="button-primary" disabled={!ready}>
          {createDeck.isPending ? "Queuing…" : "Generate deck"}
          <span aria-hidden>→</span>
        </button>
      </div>

      {createDeck.isError && (
        <p className="form-error" role="alert">
          {createDeck.error.message}
        </p>
      )}
    </form>
  );
}
