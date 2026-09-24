import { useAuth, UserButton } from "@clerk/react";

import { AuthPage } from "./components/AuthPage.tsx";
import { Composer } from "./components/Composer.tsx";
import { DeckList } from "./components/DeckList.tsx";
import { DeckView } from "./components/DeckView.tsx";
import { EmptyState } from "./components/EmptyState.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { Landing } from "./components/Landing.tsx";
import { useRoute } from "./lib/hooks.ts";

export default function App() {
  const [route, navigate] = useRoute();
  const { isLoaded, isSignedIn } = useAuth();

  const goHome = () => navigate({ view: "landing", deckId: null });
  const goSignIn = () => navigate({ view: "sign-in", deckId: null });
  const openDeck = (deckId: string) => navigate({ view: "app", deckId });

  // Leave the deck view if the open deck was just deleted, but stay in the studio
  function handleDeleted(id: string) {
    if (route.deckId === id) navigate({ view: "app", deckId: null });
  }

  // Clerk is still restoring the session — showing anything now would flicker
  if (!isLoaded) {
    return <div className="boot mono muted">Loading…</div>;
  }

  if (route.view === "sign-in" || route.view === "sign-up") {
    // Already signed in? The auth page has nothing to do.
    if (isSignedIn) {
      return <Studio route={route} navigate={navigate} openDeck={openDeck} onDeleted={handleDeleted} goHome={goHome} />;
    }
    return <AuthPage mode={route.view} onHome={goHome} />;
  }

  if (route.view === "landing") {
    return (
      <Landing
        isSignedIn={isSignedIn}
        onStart={() => (isSignedIn ? navigate({ view: "app", deckId: null }) : goSignIn())}
        onCreated={openDeck}
        onSignIn={goSignIn}
      />
    );
  }

  // The studio itself is for signed-in users only
  if (!isSignedIn) {
    return <AuthPage mode="sign-in" onHome={goHome} />;
  }

  return <Studio route={route} navigate={navigate} openDeck={openDeck} onDeleted={handleDeleted} goHome={goHome} />;
}

type StudioProps = {
  route: ReturnType<typeof useRoute>[0];
  navigate: ReturnType<typeof useRoute>[1];
  openDeck: (id: string) => void;
  onDeleted: (id: string) => void;
  goHome: () => void;
};

function Studio({ route, openDeck, onDeleted, goHome }: StudioProps) {
  return (
    <div className="app">
      <header className="masthead">
        <button type="button" className="wordmark" onClick={goHome} title="Back to the home page">
          Pitch<em>Press</em>
        </button>
        <UserButton />
      </header>

      <aside className="sidebar">
        <Composer onCreated={openDeck} />
        <DeckList selectedId={route.deckId} onSelect={openDeck} onDeleted={onDeleted} />
      </aside>

      <main className="main">
        {/* key resets the boundary when switching decks */}
        <ErrorBoundary key={route.deckId ?? "empty"}>
          {route.deckId ? <DeckView deckId={route.deckId} onDeleted={onDeleted} /> : <EmptyState />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
