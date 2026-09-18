import { ApiError, useDeck } from "../lib/api.ts";
import { duration } from "../lib/format.ts";
import { useNow } from "../lib/hooks.ts";
import { buildPipeline } from "../lib/pipeline.ts";
import { isFinished } from "../lib/types.ts";
import { DeleteDeckButton } from "./DeleteDeckButton.tsx";
import { Pipeline } from "./Pipeline.tsx";
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
          <DeleteDeckButton deckId={deck.id} running={running} onDeleted={onDeleted} variant="full" />
        </div>
        <h1 className="deck-title">
          {deck.title ?? <em className="writing">{running ? "Writing the deck…" : "Untitled deck"}</em>}
        </h1>
        <p className="deck-idea">“{deck.idea}”</p>
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
          <SlideViewer slides={deck.slides} generating={running} />
        </section>
      </div>
    </div>
  );
}
