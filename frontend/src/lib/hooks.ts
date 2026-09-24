import { useCallback, useEffect, useRef, useState } from "react";

export type Route = {
  /** "landing" = marketing page, "app" = the deck studio, plus the auth pages */
  view: "landing" | "app" | "sign-in" | "sign-up";
  deckId: string | null;
};

/**
 * Routing lives in the query string: "/" is the landing page, "?app=1" is the
 * studio, "?deck=<id>" opens one deck. Old ?deck links keep working.
 */
function readRoute(): Route {
  const params = new URLSearchParams(window.location.search);
  const deckId = params.get("deck");
  const auth = params.get("auth");

  if (auth === "sign-in" || auth === "sign-up") {
    return { view: auth, deckId: null };
  }

  return {
    view: deckId || params.has("app") ? "app" : "landing",
    deckId,
  };
}

function toUrl(route: Route): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("deck");
  url.searchParams.delete("app");
  url.searchParams.delete("auth");
  url.hash = "";

  if (route.view === "sign-in" || route.view === "sign-up") url.searchParams.set("auth", route.view);
  else if (route.deckId) url.searchParams.set("deck", route.deckId);
  else if (route.view === "app") url.searchParams.set("app", "1");

  return url.toString();
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((next: Route) => {
    window.history.pushState(null, "", toUrl(next));
    setRoute(next);
    window.scrollTo({ top: 0 });
  }, []);

  return [route, navigate] as const;
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

/**
 * Reveals elements as they scroll into view. Returns a ref for the section root.
 * If IntersectionObserver is missing, nothing is hidden in the first place.
 */
export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === "undefined") return;

    root.dataset.revealReady = "true";

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "true");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );

    root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return ref;
}
