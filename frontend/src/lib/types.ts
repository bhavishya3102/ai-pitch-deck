// Mirrors backend/src/types/deck.ts — the shapes returned by /api/decks

export type DeckStatus = "PENDING" | "GENERATING" | "COMPLETE" | "FAILED";

export type Slide = {
  id: string;
  order: number;
  title: string;
  content: string;
  imagePrompt: string;
  imageUrl: string | null;
};

export type DeckDetail = {
  id: string;
  idea: string;
  title: string | null;
  status: DeckStatus;
  errorMessage: string | null;
  slides: Slide[];
  createdAt: string;
  updatedAt: string;
};

export type DeckListItem = {
  id: string;
  idea: string;
  title: string | null;
  status: DeckStatus;
  errorMessage: string | null;
  slideCount: number;
  createdAt: string;
  updatedAt: string;
};

export function isFinished(status: DeckStatus): boolean {
  return status === "COMPLETE" || status === "FAILED";
}
