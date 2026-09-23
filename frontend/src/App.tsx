import { Composer } from "./components/Composer.tsx";
import { DeckList } from "./components/DeckList.tsx";
import { DeckView } from "./components/DeckView.tsx";
import { EmptyState } from "./components/EmptyState.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { Landing } from "./components/Landing.tsx";
import { useRoute } from "./lib/hooks.ts";

export default function App() {
  const [route, navigate] = useRoute();

  const openDeck = (deckId: string) => navigate({ view: "app", deckId });

  // Leave the deck view if the open deck was just deleted, but stay in the studio
  function handleDeleted(id: string) {
    if (route.deckId === id) navigate({ view: "app", deckId: null });
  }

  if (route.view === "landing") {
    return <Landing onStart={() => navigate({ view: "app", deckId: null })} onCreated={openDeck} />;
  }

  return (
    <div className="app">
      <header className="masthead">
        <button
          type="button"
          className="wordmark"
          onClick={() => navigate({ view: "landing", deckId: null })}
          title="Back to the landing page"
        >
          Pitch<em>Press</em>
        </button>
      </header>

      <aside className="sidebar">
        <Composer onCreated={openDeck} />
        <DeckList selectedId={route.deckId} onSelect={openDeck} onDeleted={handleDeleted} />
      </aside>

      <main className="main">
        {/* key resets the boundary when switching decks */}
        <ErrorBoundary key={route.deckId ?? "empty"}>
          {route.deckId ? <DeckView deckId={route.deckId} onDeleted={handleDeleted} /> : <EmptyState />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
