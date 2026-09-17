import { useDecks } from "../lib/api.ts";
import { timeAgo } from "../lib/format.ts";
import { StatusBadge } from "./StatusBadge.tsx";

type Props = {
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function DeckList({ selectedId, onSelect }: Props) {
  const { data: decks, isPending, isError, error } = useDecks();

  return (
    <section className="deck-list" aria-label="Your decks">
      <h2 className="eyebrow">
        Archive {decks && <span className="muted">· {decks.length}</span>}
      </h2>

      {isPending && (
        <ul className="deck-items">
          {[0, 1, 2].map((i) => (
            <li key={i} className="deck-item skeleton" />
          ))}
        </ul>
      )}

      {isError && <p className="form-error">Can't reach the API: {error.message}</p>}

      {decks?.length === 0 && <p className="muted small">No decks yet. Your first one will show up here.</p>}

      {decks && decks.length > 0 && (
        <ul className="deck-items">
          {decks.map((deck) => (
            <li key={deck.id}>
              <button
                type="button"
                className="deck-item"
                aria-current={deck.id === selectedId}
                onClick={() => onSelect(deck.id)}
              >
                <span className="deck-item-title">{deck.title ?? deck.idea}</span>
                <span className="deck-item-meta">
                  <StatusBadge status={deck.status} />
                  <span className="mono muted">
                    {deck.slideCount} slides · {timeAgo(deck.createdAt)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
