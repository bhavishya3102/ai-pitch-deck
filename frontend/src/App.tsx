import { Composer } from "./components/Composer.tsx";
import { DeckList } from "./components/DeckList.tsx";
import { DeckView } from "./components/DeckView.tsx";
import { EmptyState } from "./components/EmptyState.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { useSelectedDeck } from "./lib/hooks.ts";

export default function App() {
  const [deckId, selectDeck] = useSelectedDeck();

  // Leave the deck view if the open deck was just deleted
  function handleDeleted(id: string) {
    const openId = new URLSearchParams(window.location.search).get("deck");
    if (openId === id) selectDeck(null);
  }

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
        <DeckList selectedId={deckId} onSelect={selectDeck} onDeleted={handleDeleted} />
      </aside>

      <main className="main">
        {/* key resets the boundary when switching decks */}
        <ErrorBoundary key={deckId ?? "empty"}>
          {deckId ? <DeckView deckId={deckId} onDeleted={handleDeleted} /> : <EmptyState />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
