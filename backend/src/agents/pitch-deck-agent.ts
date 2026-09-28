import { Agent } from "@openai/agents";

import type { DeckOptions } from "../schemas/deck-options.ts";
import { pitchDeckSchemaFor } from "../schemas/pitch-deck.ts";
import {
  pitchDeckQualityGuardrail,
  validProjectIdeaGuardrail,
} from "./guardrails.ts";

/** Who is in the room, what they are listening for, and the arc that usually works. */
const AUDIENCE_BRIEFS = {
  INVESTOR: {
    reader: "investors deciding whether to fund this",
    cares:
      "the size of the problem, why this wins, the market, how it makes money, and what you are asking for",
    arc: "Title · Problem · Solution · Market · Product · Business Model · The Ask",
  },
  TEAM: {
    reader: "colleagues inside the company who will build or support this",
    cares: "the context, what exactly is being built, why now, the plan, and what is needed from them",
    arc: "Title · Context · What we're building · Why now · How it works · The plan · What we need",
  },
  CUSTOMER: {
    reader: "people who might buy or use this",
    cares:
      "their own problem, what the product does for them, how it works, why to trust it, and what it costs",
    arc: "Title · The problem you have · What it does · How it works · Why trust us · Pricing · Get started",
  },
} as const;

const TONE_BRIEFS = {
  CONFIDENT: "Confident and direct. Short declarative sentences, no hedging.",
  PLAIN: "Plain and factual. No hype words and no superlatives — just what is true.",
  BOLD: "Bold and energetic. Vivid language and a clear point of view, but never dishonest.",
} as const;

/** Instructions are built per deck, because audience, tone and length all change them. */
function buildInstructions({ audience, tone, slideCount }: DeckOptions): string {
  const brief = AUDIENCE_BRIEFS[audience];

  return `You write pitch decks.

Audience: ${brief.reader}. They care about ${brief.cares}.
Tone: ${TONE_BRIEFS[tone]}
Length: the slides array must hold exactly ${slideCount} slides — no more, no fewer.
Count them before you answer.

A deck for this audience usually runs:
${brief.arc}

Use that as a guide, not a rule: add or merge headings so the deck lands on exactly ${slideCount}
slides. Always start with a title slide whose content is a one-line tagline, and end on the slide
that asks the reader to do something.

Field rules:
- content: 2–4 bullet points as plain text, each starting with "• "
- imagePrompt: a short description for a professional slide illustration (no text in the image, clean and modern style)
- Do not use placeholder filler like "TBD" or "lorem ipsum"
- Never invent specific figures, customer names or dates you were not given`;
}

/**
 * Build the deck-writing agent for one set of options.
 *
 * - outputType: forces JSON matching the schema for the requested slide count
 * - inputGuardrails: validate the user's idea before generating
 * - outputGuardrails: validate the deck content before returning
 *
 * Constructing an Agent is just an object — no API call — so one per run is fine.
 */
export function buildPitchDeckAgent(options: DeckOptions) {
  return new Agent({
    name: "PitchDeckGenerator",
    model: "gpt-4o-mini",
    instructions: buildInstructions(options),
    // Zod v4 types differ slightly from the SDK — runtime structured output works fine.
    outputType: pitchDeckSchemaFor(options.slideCount) as any,
    inputGuardrails: [validProjectIdeaGuardrail],
    outputGuardrails: [pitchDeckQualityGuardrail],
  });
}
