import type { DeckDetail } from "./types.ts";

export type StageState = "done" | "active" | "waiting" | "failed";

export type Stage = {
  id: string;
  label: string;
  step: string;
  detail: string;
  state: StageState;
};

/** The stages of backend/src/inngest/functions/generate-deck.ts, in order. */
const STAGES = [
  {
    id: "queued",
    label: "Queued",
    step: 'inngest.send("deck/generate")',
    detail: "Deck saved, event sent to Inngest",
  },
  {
    id: "load",
    label: "Load deck",
    step: 'step.run("load-deck")',
    detail: "Find the idea in Postgres",
  },
  {
    id: "agent",
    label: "Write the deck",
    step: 'step.run("run-agent")',
    detail: "Agent writes slides, guardrails check input and output",
  },
  {
    id: "images",
    label: "Illustrate slides",
    step: 'step.run("image-n")',
    detail: "OpenAI image → ImageKit upload → save URL",
  },
  {
    id: "complete",
    label: "Complete",
    step: 'step.run("mark-complete")',
    detail: "Deck marked COMPLETE",
  },
] as const;

/**
 * The backend only stores status, title and slides, so we infer the running
 * step from them: title appears after run-agent, slides appear one by one.
 */
function currentStageIndex(deck: DeckDetail): number {
  if (deck.status === "COMPLETE") return STAGES.length;
  if (deck.status === "PENDING") return 1;
  return deck.title ? 3 : 2;
}

export function buildPipeline(deck: DeckDetail | null): Stage[] {
  if (!deck) {
    return STAGES.map((stage) => ({ ...stage, state: "waiting" }));
  }

  const current = currentStageIndex(deck);
  const failed = deck.status === "FAILED";
  const slides = deck.slides.length;

  return STAGES.map((stage, index) => {
    let state: StageState = "waiting";
    if (index < current) state = "done";
    else if (index === current) state = failed ? "failed" : "active";

    let detail: string = stage.detail;
    if (stage.id === "images" && slides > 0) {
      detail = state === "done" ? `${slides} slides illustrated and saved` : `${slides} slides saved so far`;
    }
    if (state === "failed" && deck.errorMessage) {
      detail = deck.errorMessage;
    }

    return { ...stage, detail, state };
  });
}
