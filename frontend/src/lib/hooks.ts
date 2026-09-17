import { useCallback, useEffect, useState } from "react";

function readDeckParam(): string | null {
  return new URLSearchParams(window.location.search).get("deck");
}

/** Selected deck lives in ?deck=<id> so a refresh or shared link opens the same deck. */
export function useSelectedDeck() {
  const [deckId, setDeckId] = useState<string | null>(readDeckParam);

  useEffect(() => {
    const onPopState = () => setDeckId(readDeckParam());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const select = useCallback((id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("deck", id);
    else url.searchParams.delete("deck");
    window.history.pushState(null, "", url);
    setDeckId(id);
  }, []);

  return [deckId, select] as const;
}

/** Current time that ticks every second while `active` is true. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  return now;
}
