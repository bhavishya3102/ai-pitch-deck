import { Composer } from "./components/Composer.tsx";
import { DeckList } from "./components/DeckList.tsx";
import { DeckView } from "./components/DeckView.tsx";
import { EmptyState } from "./components/EmptyState.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { useSelectedDeck } from "./lib/hooks.ts";

export default function App() {
  const [deckId, selectDeck] = useSelectedDeck();

  return (
    <div className="app">
      <header className="masthead">
        <button type="button" className="wordmark" onClick={() => selectDeck(null)}>
          Pitch<em>Press</em>
        </button>
        <span className="mono muted masthead-stack">express · inngest · openai agents · imagekit · postgres</span>
      </header>

      <aside className="sidebar">
        <Composer onCreated={selectDeck} />
        <DeckList selectedId={deckId} onSelect={selectDeck} />
      </aside>

      <main className="main">
        {/* key resets the boundary when switching decks */}
        <ErrorBoundary key={deckId ?? "empty"}>
          {deckId ? <DeckView deckId={deckId} /> : <EmptyState />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
