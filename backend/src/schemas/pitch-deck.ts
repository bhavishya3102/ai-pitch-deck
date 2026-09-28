import { z } from "zod";

export const SlideSchema = z.object({
  title: z.string().min(3).max(80),
  content: z.string().min(20).max(500),
  imagePrompt: z.string().min(10).max(300),
});

/**
 * A rewrite only touches the words — the illustration keeps its own button —
 * and reuses the slide limits so a revised slide still exports cleanly.
 */
export const RevisedSlideSchema = SlideSchema.pick({ title: true, content: true });

/**
 * The deck shape the agent must return, for a requested number of slides.
 *
 * The count is a range rather than exact: OpenAI's structured output can't
 * enforce array length, so a model that returns one slide too many would fail
 * the whole run. The instructions ask for the exact number; this only stops a
 * near miss from throwing away a finished deck.
 */
export function pitchDeckSchemaFor(slideCount: number) {
  return z.object({
    deckTitle: z.string().min(3).max(100),
    slides: z.array(SlideSchema).min(Math.max(3, slideCount - 1)).max(slideCount + 1),
  });
}

export type Slide = z.infer<typeof SlideSchema>;
export type RevisedSlide = z.infer<typeof RevisedSlideSchema>;
export type PitchDeck = { deckTitle: string; slides: Slide[] };
