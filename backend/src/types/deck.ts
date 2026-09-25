export type DeckStatus = "PENDING" | "GENERATING" | "COMPLETE" | "FAILED";

export type SlideImageStatus = "READY" | "GENERATING" | "FAILED";

export type Slide = {
  id: string;
  order: number;
  title: string;
  content: string;
  imagePrompt: string;
  imageUrl: string | null;
  imageStatus: SlideImageStatus;
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
