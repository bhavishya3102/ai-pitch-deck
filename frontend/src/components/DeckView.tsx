import { useState } from "react";

import { ApiError, useDeck, useExportDeck } from "../lib/api.ts";
import { duration } from "../lib/format.ts";
import { requestFullscreen } from "../lib/fullscreen.ts";
import { useNow } from "../lib/hooks.ts";
import { buildPipeline } from "../lib/pipeline.ts";
import { isFinished } from "../lib/types.ts";
import { DeleteDeckButton } from "./DeleteDeckButton.tsx";
import { Pipeline } from "./Pipeline.tsx";
import { PresentMode } from "./PresentMode.tsx";
import { SlideViewer } from "./SlideViewer.tsx";
import { StatusBadge } from "./StatusBadge.tsx";

type Props = {
  deckId: string;
  onDeleted: (id: string) => void;
};

export function DeckView({ deckId, onDeleted }: Props) {
  const { data: deck, isPending, isError, error, refetch } = useDeck(deckId);
  const running = deck ? !isFinished(deck.status) : false;
  const now = useNow(running);
  // Index lives here so "Present" starts on the slide you are looking at
  const [slideIndex, setSlideIndex] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const exportDeck = useExportDeck(deckId);

  if (isPending) {
    return <div className="deck-view loading mono muted">Loading deck…</div>;
  }

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="deck-view">
        <p className="form-error" role="alert">
          {notFound ? "This deck doesn't exist anymore." : error.message}
        </p>
        {!notFound && (
          <button type="button" className="button-primary retry" onClick={() => refetch()}>
            Try again
          </button>
        )}
      </div>
    );
  }

  // PENDING means no Inngest function has picked up the event yet
  const stuck = deck.status === "PENDING" && now - new Date(deck.createdAt).getTime() > 30_000;
  const elapsed = duration(deck.createdAt, running ? now : new Date(deck.updatedAt).getTime());

  return (
    <div className="deck-view" key={deck.id}>
      <header className="deck-header">
        <div className="deck-kicker">
          <StatusBadge status={deck.status} />
          <span className="mono muted">
            {running ? "running" : "took"} {elapsed}
          </span>
          {deck.slides.length > 0 && (
            <span className="export-group">
              <span className="mono muted">Export</span>
              <button
                type="button"
                className="export-button"
                onClick={() => exportDeck.mutate("pptx")}
                disabled={exportDeck.isPending}
              >
                {exportDeck.isPending && exportDeck.variables === "pptx" ? "Building…" : "PPTX"}
              </button>
              <button
                type="button"
                className="export-button"
                onClick={() => exportDeck.mutate("pdf")}
                disabled={exportDeck.isPending}
              >
                {exportDeck.isPending && exportDeck.variables === "pdf" ? "Building…" : "PDF"}
              </button>
            </span>
          )}
          <DeleteDeckButton deckId={deck.id} running={running} onDeleted={onDeleted} variant="full" />
        </div>
        <h1 className="deck-title">
          {deck.title ?? <em className="writing">{running ? "Writing the deck…" : "Untitled deck"}</em>}
        </h1>
        <p className="deck-idea">“{deck.idea}”</p>
        {exportDeck.isError && (
          <p className="form-error" role="alert">
            {exportDeck.error.message}
          </p>
        )}
        {stuck && (
          <p className="notice" role="status">
            Still queued after 30 seconds. Make sure the Inngest dev server is running (
            <code>npm run inngest:dev</code> in <code>backend/</code>).
          </p>
        )}
      </header>

      <div className="deck-body">
        <aside className="deck-pipeline">
          <h2 className="eyebrow">Pipeline</h2>
          <Pipeline stages={buildPipeline(deck)} />
        </aside>
        <section className="deck-slides" aria-label="Slides">
          <SlideViewer
            deckId={deck.id}
            slides={deck.slides}
            generating={running}
            index={slideIndex}
            onIndexChange={setSlideIndex}
            keyboardEnabled={!presenting}
            onPresent={() => {
              // Inside the click handler so the browser allows fullscreen
              requestFullscreen();
              setPresenting(true);
            }}
          />
        </section>
      </div>

      {presenting && deck.slides.length > 0 && (
        <PresentMode
          slides={deck.slides}
          startIndex={slideIndex}
          deckTitle={deck.title ?? "Pitch deck"}
          onExit={(lastIndex) => {
            setSlideIndex(lastIndex);
            setPresenting(false);
          }}
        />
      )}
    </div>
  );
}
