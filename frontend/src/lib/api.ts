import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authHeader } from "./auth-token.ts";
import { hasSlideInProgress, isFinished, type DeckDetail, type DeckListItem } from "./types.ts";

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
      ...init,
      // Clerk session token — the API scopes every deck to this user
      headers: { "Content-Type": "application/json", ...(await authHeader()), ...init?.headers },
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
      const deck = query.state.data;
      if (!deck) return 1500;
      // Poll while the deck runs, and while any single slide is being re-illustrated
      return isFinished(deck.status) && !hasSlideInProgress(deck) ? false : 1500;
    },
  });
}

/** Stops generation (if running) and deletes the deck. Removes it from the list right away. */
// onDeleted is a hook-level callback on purpose: the optimistic update unmounts the list
// item, and callbacks passed to mutate() don't fire after the component unmounts.
export function useDeleteDeck(onDeleted: (id: string) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => request<null>(`/api/decks/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: deckKeys.all });
      const previous = queryClient.getQueryData<DeckListItem[]>(deckKeys.all);
      queryClient.setQueryData<DeckListItem[]>(deckKeys.all, (decks) => decks?.filter((deck) => deck.id !== id));
      return { previous };
    },
    onError: (error, id, context) => {
      // Already gone on the server counts as deleted; anything else — put the deck back
      if (error instanceof ApiError && error.status === 404) {
        queryClient.removeQueries({ queryKey: deckKeys.detail(id) });
        onDeleted(id);
        return;
      }
      queryClient.setQueryData(deckKeys.all, context?.previous);
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: deckKeys.detail(id) });
      onDeleted(id);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: deckKeys.all }),
  });
}

/** Edit one slide's text. */
export function useUpdateSlide(deckId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slideId, ...fields }: { slideId: string; title?: string; content?: string; imagePrompt?: string }) =>
      request<null>(`/api/decks/${deckId}/slides/${slideId}`, {
        method: "PATCH",
        body: JSON.stringify(fields),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deckKeys.detail(deckId) }),
  });
}

/** Queue a new image for one slide; polling picks up the result. */
export function useRegenerateSlideImage(deckId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slideId: string) =>
      request<{ id: string }>(`/api/decks/${deckId}/slides/${slideId}/regenerate-image`, { method: "POST" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: deckKeys.detail(deckId) }),
  });
}

/** Filename the server suggests, e.g. attachment; filename="my-deck.pptx" */
function filenameFrom(header: string | null, fallback: string): string {
  const match = header?.match(/filename="?([^"]+)"?/);
  return match?.[1] ?? fallback;
}

/**
 * Downloads need the Clerk token, so a plain <a href> won't do: fetch the file,
 * then hand the blob to a temporary link.
 */
export function useExportDeck(deckId: string) {
  return useMutation({
    mutationFn: async (format: "pptx" | "pdf") => {
      const response = await fetch(`/api/decks/${deckId}/export?format=${format}`, {
        headers: await authHeader(),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new ApiError(response.status, body);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFrom(response.headers.get("Content-Disposition"), `pitch-deck.${format}`);
      document.body.append(link);
      link.click();
      link.remove();
      // Revoke on the next tick so the download has started
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return format;
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
