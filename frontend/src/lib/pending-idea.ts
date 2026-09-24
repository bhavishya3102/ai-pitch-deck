const KEY = "pitchpress:pending-idea";

/**
 * An idea typed on the landing page while signed out. It waits here through the
 * Clerk redirect and pre-fills the composer afterwards. sessionStorage can throw
 * (private mode, blocked cookies), so every call is guarded.
 */
export function savePendingIdea(idea: string) {
  try {
    sessionStorage.setItem(KEY, idea);
  } catch {
    // Not worth failing the sign-in flow over
  }
}

export function takePendingIdea(): string | null {
  try {
    const idea = sessionStorage.getItem(KEY);
    if (idea) sessionStorage.removeItem(KEY);
    return idea;
  } catch {
    return null;
  }
}
