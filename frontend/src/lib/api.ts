import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isFinished, type DeckDetail, type DeckListItem } from "./types.ts";

export class ApiError extends Error {
  readonly status: number;
  readonly body: { error?: string; id?: string } | null;

  constructor(status: number, body: { error?: string; id?: string } | null) {
    super(body?.error ?? `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(0, { error: "Can't reach the server. Is the backend running on port 4000?" });
  }

  // A proxy error page or empty body is not JSON — treat it as no body
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    if (!body?.error && response.status >= 500) {
      throw new ApiError(response.status, { error: "Backend is not responding. Is it running on port 4000?" });
    }
    throw new ApiError(response.status, body);
  }

  return body as T;
}

export const deckKeys = {
  all: ["decks"] as const,
  detail: (id: string) => ["decks", id] as const,
};

/** Deck list — keeps polling only while some deck is still being generated. */
export function useDecks() {
  return useQuery({
    queryKey: deckKeys.all,
    queryFn: () => request<DeckListItem[]>("/api/decks"),
    refetchInterval: (query) =>
      query.state.data?.some((deck) => !isFinished(deck.status)) ? 3000 : false,
  });
}

/** One deck — polls fast while the Inngest flow runs, stops once it finishes. */
export function useDeck(id: string | null) {
  return useQuery({
    queryKey: deckKeys.detail(id ?? ""),
    queryFn: () => request<DeckDetail>(`/api/decks/${id}`),
    enabled: id !== null,
    // A deleted/unknown deck is not coming back — don't retry or keep polling it
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 2,
    refetchInterval: (query) => {
      if (query.state.status === "error") return false;
      const status = query.state.data?.status;
      return status && isFinished(status) ? false : 1500;
    },
  });
}

export function useCreateDeck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (idea: string) =>
      request<{ id: string }>("/api/decks", {
        method: "POST",
        body: JSON.stringify({ idea }),
      }),
    // Refresh the list either way — a failed queue still creates a (FAILED) deck
    onSettled: () => queryClient.invalidateQueries({ queryKey: deckKeys.all }),
  });
}
