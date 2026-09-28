import type { DeckAudience, DeckTone } from "./types.ts";

/** The choices offered in the composer — must match DeckOptionsSchema on the server. */
export const AUDIENCE_OPTIONS = [
  { value: "INVESTOR", label: "Investors" },
  { value: "TEAM", label: "Team" },
  { value: "CUSTOMER", label: "Customers" },
] as const satisfies readonly { value: DeckAudience; label: string }[];

export const TONE_OPTIONS = [
  { value: "CONFIDENT", label: "Confident" },
  { value: "PLAIN", label: "Plain" },
  { value: "BOLD", label: "Bold" },
] as const satisfies readonly { value: DeckTone; label: string }[];

export const SLIDE_COUNT_OPTIONS = [5, 7, 10] as const;

/**
 * One line for the deck header: "for investors · confident · 7 slides".
 *
 * The count is what the deck actually has once slides exist — the agent asks for
 * the chosen length but can land a slide either side of it, and the line should
 * never disagree with the slides on screen.
 */
export function describeOptions(deck: {
  audience: DeckAudience;
  tone: DeckTone;
  slideCount: number;
  slides: unknown[];
}): string {
  const audience = AUDIENCE_OPTIONS.find((option) => option.value === deck.audience)?.label ?? deck.audience;
  const tone = TONE_OPTIONS.find((option) => option.value === deck.tone)?.label ?? deck.tone;
  const count = deck.slides.length || deck.slideCount;
  return `for ${audience.toLowerCase()} · ${tone.toLowerCase()} · ${count} slides`;
}
