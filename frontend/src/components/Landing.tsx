import { useEffect, useRef, useState, type FormEvent } from "react";

import { ApiError, useCreateDeck } from "../lib/api.ts";
import { useScrollReveal } from "../lib/hooks.ts";
import { savePendingIdea, takePendingIdea } from "../lib/pending-idea.ts";

const MIN_LENGTH = 20;

const EXAMPLES = [
  "A marketplace that lets small farmers sell produce directly to city restaurants",
  "An AI tutor that runs mock coding interviews and grades them",
  "A subscription service that repairs and refurbishes used smartphones",
];

const STEPS = [
  {
    step: 'inngest.send("deck/generate")',
    title: "You write one sentence",
    body: "No outline, no slide count, no template gallery. Just the idea, the way you would say it out loud.",
  },
  {
    step: 'step.run("run-agent")',
    title: "The agent writes the deck",
    body: "Problem, solution, market, product, business model, the ask. Guardrails check the draft before anything is saved.",
  },
  {
    step: 'step.run("image-n")',
    title: "Every slide gets its art",
    body: "Each slide is illustrated and stored on ImageKit, appearing on your screen the moment it is ready.",
  },
];

const FEATURES = [
  {
    kicker: "Present",
    title: "Full screen in one click",
    body: "The room sees the deck and nothing else. Arrow keys move, Esc brings you back.",
  },
  {
    kicker: "Focus",
    title: "A highlighter for the room",
    body: "Press H and everything dims except a circle around your cursor. Scroll to resize it.",
  },
  {
    kicker: "Trust",
    title: "Nothing happens off-screen",
    body: "Watch each job step as it runs, and see exactly which one failed if something breaks.",
  },
];

/** Sticky CTA bar appears once the hero scrolls away. */
function useScrolledPastHero() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [past, setPast] = useState(false);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [sentinelRef, past] as const;
}

type Props = {
  isSignedIn: boolean;
  onStart: () => void;
  onCreated: (deckId: string) => void;
  onSignIn: () => void;
};

export function Landing({ isSignedIn, onStart, onCreated, onSignIn }: Props) {
  const revealRef = useScrollReveal<HTMLDivElement>();
  const [sentinelRef, scrolled] = useScrolledPastHero();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // An idea typed before signing in comes back here after the redirect
  const [idea, setIdea] = useState(() => takePendingIdea() ?? "");
  const createDeck = useCreateDeck();

  const length = idea.trim().length;
  const ready = length >= MIN_LENGTH && !createDeck.isPending;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;

    // Signed out? Keep the idea and continue after sign-in instead of failing with 401
    if (!isSignedIn) {
      savePendingIdea(idea.trim());
      onSignIn();
      return;
    }

    createDeck.mutate(idea.trim(), {
      onSuccess: ({ id }) => onCreated(id),
      onError: (error) => {
        // The deck was saved but the job could not be queued — open it so the reason shows
        if (error instanceof ApiError && error.body?.id) onCreated(error.body.id);
      },
    });
  }

  function focusInput() {
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  return (
    <div className="landing" ref={revealRef}>
      <header className="landing-bar" data-stuck={scrolled}>
        <span className="wordmark landing-wordmark">
          Pitch<em>Press</em>
        </span>
        <div className="landing-bar-actions">
          <button type="button" className="landing-link" onClick={isSignedIn ? onStart : onSignIn}>
            {isSignedIn ? "Open the studio" : "Sign in"}
          </button>
          <button type="button" className="cta-button cta-small" data-visible={scrolled} onClick={focusInput}>
            Build my deck
            <span aria-hidden>→</span>
          </button>
        </div>
      </header>

      <div ref={sentinelRef} className="scroll-sentinel" aria-hidden />

      <section className="hero">
        <div className="hero-copy">
          <span className="hero-eyebrow">
            <span className="hero-dot" aria-hidden /> One sentence in · a full deck out
          </span>

          <h1 className="hero-title">
            Your idea,
            <br />
            <em>printed</em> as a pitch deck.
          </h1>

          <p className="hero-lede">
            Describe your startup in a line. An AI agent writes the slides, illustrates every one of them, and hands
            you a deck you can put on the projector — in about a minute.
          </p>

          {/* The single call to action: the product itself, right here */}
          <form className="hero-form" onSubmit={submit}>
            <label className="sr-only" htmlFor="landing-idea">
              Describe your startup idea
            </label>
            <div className="hero-field" data-error={createDeck.isError}>
              <textarea
                id="landing-idea"
                ref={inputRef}
                className="hero-input"
                rows={2}
                placeholder="A marketplace that lets small farmers sell produce directly to city restaurants…"
                value={idea}
                onChange={(event) => setIdea(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) submit(event);
                }}
              />
              <button type="submit" className="cta-button" disabled={!ready}>
                {createDeck.isPending ? "Starting…" : "Build my deck"}
                <span aria-hidden>→</span>
              </button>
            </div>

            <div className="hero-form-foot">
              <span className="mono hero-hint" data-ok={length >= MIN_LENGTH}>
                {createDeck.isPending
                  ? "Queuing the job…"
                  : length === 0
                    ? "Press Enter to start"
                    : length < MIN_LENGTH
                      ? `${MIN_LENGTH - length} more characters`
                      : isSignedIn
                        ? "Ready — press Enter"
                        : "Ready — you'll sign in next"}
              </span>
              <span className="mono muted hero-cost">Free to try · nothing to install</span>
            </div>

            {createDeck.isError && (
              <p className="form-error" role="alert">
                {createDeck.error.message}
              </p>
            )}
          </form>

          <div className="hero-examples">
            <span className="mono muted">Try one:</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="chip chip-dark"
                onClick={() => {
                  setIdea(example);
                  inputRef.current?.focus();
                }}
              >
                {example.split(" ").slice(0, 4).join(" ")}…
              </button>
            ))}
          </div>

          <dl className="hero-stats">
            <div>
              <dt className="mono">~60s</dt>
              <dd>from sentence to deck</dd>
            </div>
            <div>
              <dt className="mono">7</dt>
              <dd>investor-ready slides</dd>
            </div>
            <div>
              <dt className="mono">0</dt>
              <dd>slides you design yourself</dd>
            </div>
          </dl>
        </div>

        <div className="hero-art" aria-hidden>
          <div className="hero-slide">
            <span className="mono hero-slide-counter">03 / 07</span>
            <h2 className="hero-slide-title">The Solution</h2>
            <ul className="hero-slide-bullets">
              <li />
              <li />
              <li />
            </ul>
            <div className="hero-slide-image" />
            <div className="hero-slide-progress">
              <span />
            </div>
          </div>

          <ol className="hero-rail">
            <li>Write the deck</li>
            <li>Illustrate slides</li>
            <li>Complete</li>
          </ol>
        </div>
      </section>

      <section className="landing-section" id="how">
        <div className="section-head" data-reveal>
          <span className="eyebrow">How it works</span>
          <h2 className="section-title">Three steps, and the deck is on screen</h2>
        </div>

        <ol className="steps">
          {STEPS.map((step, i) => (
            <li key={step.title} className="step" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <span className="step-number">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="step-title">{step.title}</h3>
              <code className="step-code">{step.step}</code>
              <p className="step-body">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-section demo-section">
        <div className="section-head" data-reveal>
          <span className="eyebrow">In the meeting</span>
          <h2 className="section-title">Point at the one thing that matters</h2>
          <p className="section-lede">
            The highlighter dims the whole slide except a circle around your cursor, so the room looks exactly where
            you are looking.
          </p>
        </div>

        {/* CSS-only preview of the highlighter moving across a slide */}
        <div className="demo" data-reveal aria-hidden>
          <div className="demo-slide">
            <div className="demo-text">
              <span className="mono">05 / 07</span>
              <h3>Key Product Features</h3>
              <ul>
                <li />
                <li />
                <li />
              </ul>
            </div>
            <div className="demo-image" />
            <div className="demo-spot" />
          </div>
          <span className="mono demo-caption">Press H while presenting</span>
        </div>
      </section>

      <section className="landing-section">
        <div className="features">
          {FEATURES.map((feature, i) => (
            <article key={feature.title} className="feature" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <span className="mono feature-kicker">{feature.kicker}</span>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-body">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="closing">
        <div className="closing-inner" data-reveal>
          <h2 className="closing-title">
            So — what are you <em>pitching?</em>
          </h2>
          <p className="closing-lede">One sentence is all it takes. The deck is ready before your coffee is.</p>
          <button type="button" className="cta-button cta-large" onClick={focusInput}>
            Build my deck
            <span aria-hidden>→</span>
          </button>
          <button type="button" className="landing-link closing-secondary" onClick={isSignedIn ? onStart : onSignIn}>
            {isSignedIn ? "or browse decks you already made" : "or sign in to see your decks"}
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <span className="wordmark landing-wordmark footer-mark">
          Pitch<em>Press</em>
        </span>
        <span className="mono muted">Express · Inngest · OpenAI Agents · ImageKit · Postgres</span>
      </footer>
    </div>
  );
}
