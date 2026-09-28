import { z } from "zod";

/** The choices offered when a deck is created. Kept small so every combination is one we can write well. */
export const DECK_AUDIENCES = ["INVESTOR", "TEAM", "CUSTOMER"] as const;
export const DECK_TONES = ["CONFIDENT", "PLAIN", "BOLD"] as const;
export const DECK_SLIDE_COUNTS = [5, 7, 10] as const;

/**
 * Every field has a default, so a request that sends only an idea (the landing
 * page does) still gets the deck the app produced before options existed.
 */
export const DeckOptionsSchema = z.object({
  audience: z.enum(DECK_AUDIENCES).default("INVESTOR"),
  tone: z.enum(DECK_TONES).default("CONFIDENT"),
  slideCount: z.union([z.literal(5), z.literal(7), z.literal(10)]).default(7),
});

/**
 * The shape the agent works with. slideCount is a plain number here — the
 * allowed values are enforced once, at the route that accepts the request.
 */
export type DeckOptions = {
  audience: (typeof DECK_AUDIENCES)[number];
  tone: (typeof DECK_TONES)[number];
  slideCount: number;
};
