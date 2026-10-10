import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { authHeader } from "./auth-token.ts";
import {
  hasSlideInProgress,
  isFinished,
  type DeckAudience,
  type DeckDetail,
  type DeckListItem,
  type DeckTone,
  type SlideNote,
} from "./types.ts";

/**
 * In production the API lives on its own origin (Render), so calls need the
 * absolute URL. Unset — local dev — keeps the path relative and the Vite proxy
 * forwards it to port 4000.
 */
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

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
    response = await fetch(apiUrl(path), {
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

export const quotaKeys = {
  all: ["quota"] as const,
};

/** Mirrors GET /api/decks/quota. */
export type QuotaSnapshot = {
  decks: { used: number; limit: number; remaining: number; resetsAt: string };
  concurrent: { active: number; limit: number };
  images: { used: number; limit: number; remaining: number; resetsAt: string };
  rewrites: { used: number; limit: number; remaining: number; resetsAt: string };
};

/**
 * Remaining allowance. A failed fetch must not disable Generate — the server
 * still enforces the limit, and the error shows up on submit.
 */
export function useQuota(enabled = true) {
  return useQuery({
    queryKey: quotaKeys.all,
    queryFn: () => request<QuotaSnapshot>("/api/decks/quota"),
    enabled,
    staleTime: 15_000,
    retry: 1,
  });
}

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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: deckKeys.all });
      queryClient.invalidateQueries({ queryKey: quotaKeys.all });
    },
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: deckKeys.detail(deckId) });
      queryClient.invalidateQueries({ queryKey: quotaKeys.all });
    },
  });
}

/**
 * Capture feedback on a slide. Called mid-presentation, so it never blocks the
 * view: the note is saved in the background and the deck refetches after.
 */
export function useAddNote(deckId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slideId, body }: { slideId: string; body: string }) =>
      request<{ id: string }>(`/api/decks/${deckId}/slides/${slideId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deckKeys.detail(deckId) }),
  });
}

/**
 * Notes live inside the cached deck, so changing one means patching that deck.
 * Without it the tick box and Delete sit still for the second or two the refetch
 * takes, and the click reads as lost.
 */
function patchCachedNotes(
  queryClient: QueryClient,
  deckId: string,
  apply: (notes: SlideNote[]) => SlideNote[],
) {
  queryClient.setQueryData<DeckDetail>(deckKeys.detail(deckId), (deck) =>
    deck ? { ...deck, slides: deck.slides.map((slide) => ({ ...slide, notes: apply(slide.notes) })) } : deck,
  );
}

/** Fill in a flag's detail after the meeting, or tick it off once handled. */
export function useUpdateNote(deckId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, ...fields }: { noteId: string; body?: string; resolved?: boolean }) =>
      request<null>(`/api/decks/${deckId}/notes/${noteId}`, {
        method: "PATCH",
        body: JSON.stringify(fields),
      }),
    onMutate: async ({ noteId, body, resolved }) => {
      await queryClient.cancelQueries({ queryKey: deckKeys.detail(deckId) });
      const previous = queryClient.getQueryData<DeckDetail>(deckKeys.detail(deckId));
      patchCachedNotes(queryClient, deckId, (notes) =>
        notes.map((note) =>
          note.id === noteId
            ? { ...note, ...(body === undefined ? {} : { body }), ...(resolved === undefined ? {} : { resolved }) }
            : note,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(deckKeys.detail(deckId), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: deckKeys.detail(deckId) }),
  });
}

export function useDeleteNote(deckId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) =>
      request<null>(`/api/decks/${deckId}/notes/${noteId}`, { method: "DELETE" }),
    onMutate: async (noteId) => {
      await queryClient.cancelQueries({ queryKey: deckKeys.detail(deckId) });
      const previous = queryClient.getQueryData<DeckDetail>(deckKeys.detail(deckId));
      patchCachedNotes(queryClient, deckId, (notes) => notes.filter((note) => note.id !== noteId));
      return { previous };
    },
    onError: (_error, _noteId, context) => {
      if (context?.previous) queryClient.setQueryData(deckKeys.detail(deckId), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: deckKeys.detail(deckId) }),
  });
}

/**
 * Hand one note to the agent as an instruction and let it rewrite that slide.
 * The note is ticked off server-side once the new wording lands.
 */
export function useApplyNote(deckId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slideId, noteId }: { slideId: string; noteId: string }) =>
      request<{ id: string }>(`/api/decks/${deckId}/slides/${slideId}/rewrite`, {
        method: "POST",
        body: JSON.stringify({ noteId }),
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: deckKeys.detail(deckId) });
      queryClient.invalidateQueries({ queryKey: quotaKeys.all });
    },
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
      const response = await fetch(apiUrl(`/api/decks/${deckId}/export?format=${format}`), {
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

/** Options are optional — the landing page sends only an idea and takes the defaults. */
export type NewDeck = {
  idea: string;
  audience?: DeckAudience;
  tone?: DeckTone;
  slideCount?: number;
};

export function useCreateDeck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deck: NewDeck) =>
      request<{ id: string }>("/api/decks", {
        method: "POST",
        body: JSON.stringify(deck),
      }),
    // Refresh the list either way — a failed queue still creates a (FAILED) deck.
    // Quota too: a 429 and a successful queue both change what is left.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: deckKeys.all });
      queryClient.invalidateQueries({ queryKey: quotaKeys.all });
    },
  });
}
