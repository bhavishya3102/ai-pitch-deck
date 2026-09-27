import { Inngest } from "inngest";

export type InngestEvents = {
  "deck/generate": {
    data: {
      deckId: string;
    };
  };
  "deck/cancel": {
    data: {
      deckId: string;
    };
  };
  "slide/regenerate-image": {
    data: {
      deckId: string;
      slideId: string;
    };
  };
  "slide/rewrite-text": {
    data: {
      deckId: string;
      slideId: string;
      noteId: string;
    };
  };
};

export const inngest = new Inngest({
  id: "ai-pitch-deck",
});
