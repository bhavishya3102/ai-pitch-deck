// Mirrors backend/src/types/deck.ts — the shapes returned by /api/decks

export type DeckStatus = "PENDING" | "GENERATING" | "COMPLETE" | "FAILED";

export type DeckAudience = "INVESTOR" | "TEAM" | "CUSTOMER";

export type DeckTone = "CONFIDENT" | "PLAIN" | "BOLD";

export type SlideImageStatus = "READY" | "GENERATING" | "FAILED";

export type SlideTextStatus = "READY" | "REWRITING" | "FAILED";

/** Feedback captured on a slide — an empty body is a quick flag from a live demo. */
export type SlideNote = {
  id: string;
  body: string;
  resolved: boolean;
  createdAt: string;
};

export type Slide = {
  id: string;
  order: number;
  title: string;
  content: string;
  imagePrompt: string;
  imageUrl: string | null;
  imageStatus: SlideImageStatus;
  textStatus: SlideTextStatus;
  notes: SlideNote[];
};

export type DeckDetail = {
  id: string;
  idea: string;
  title: string | null;
  status: DeckStatus;
  audience: DeckAudience;
  tone: DeckTone;
  slideCount: number;
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

/** Notes still waiting to be acted on, across the whole deck. */
export function openNoteCount(deck: { slides: Slide[] }): number {
  return deck.slides.reduce((total, slide) => total + slide.notes.filter((note) => !note.resolved).length, 0);
}

/** True while any slide is being re-illustrated or rewritten — the deck view keeps polling. */
export function hasSlideInProgress(deck: { slides: Slide[] }): boolean {
  return deck.slides.some(
    (slide) => slide.imageStatus === "GENERATING" || slide.textStatus === "REWRITING",
  );
}
