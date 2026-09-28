import { useState, type FormEvent, type KeyboardEvent } from "react";

import { ApiError, useCreateDeck } from "../lib/api.ts";
import { AUDIENCE_OPTIONS, SLIDE_COUNT_OPTIONS, TONE_OPTIONS } from "../lib/deck-options.ts";
import { takePendingIdea } from "../lib/pending-idea.ts";
import type { DeckAudience, DeckTone } from "../lib/types.ts";

const MIN_LENGTH = 20;

const EXAMPLES = [
  "A marketplace that lets small farmers sell produce directly to city restaurants",
  "An AI tutor that helps students prepare for coding interviews with mock rounds",
  "A subscription service that repairs and refurbishes used smartphones",
];

/** One row of the options block: a label and a set of single-choice chips. */
function OptionRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="option-row" role="group" aria-label={label}>
      <span className="eyebrow option-label">{label}</span>
      <div className="option-choices">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="option"
            data-on={option.value === value}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Composer({ onCreated }: { onCreated: (id: string) => void }) {
  // An idea typed on the landing page before signing in lands here
  const [idea, setIdea] = useState(() => takePendingIdea() ?? "");
  // Defaults are the deck the app produced before options existed
  const [audience, setAudience] = useState<DeckAudience>("INVESTOR");
  const [tone, setTone] = useState<DeckTone>("CONFIDENT");
  const [slideCount, setSlideCount] = useState<number>(7);
  const createDeck = useCreateDeck();

  const length = idea.trim().length;
  const ready = length >= MIN_LENGTH && !createDeck.isPending;

  function submit() {
    if (!ready) return;
    createDeck.mutate(
      { idea: idea.trim(), audience, tone, slideCount },
      {
        onSuccess: ({ id }) => {
          setIdea("");
          onCreated(id);
        },
        onError: (error) => {
          // Deck was saved but couldn't be queued — open it so the FAILED reason is visible
          if (error instanceof ApiError && error.body?.id) onCreated(error.body.id);
        },
      },
    );
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
        placeholder="Describe what you're presenting…"
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

      <div className="composer-options">
        <OptionRow label="For" options={AUDIENCE_OPTIONS} value={audience} onChange={setAudience} />
        <OptionRow label="Tone" options={TONE_OPTIONS} value={tone} onChange={setTone} />
        <OptionRow
          label="Slides"
          options={SLIDE_COUNT_OPTIONS.map((count) => ({ value: count, label: String(count) }))}
          value={slideCount}
          onChange={setSlideCount}
        />
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
