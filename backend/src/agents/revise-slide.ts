import { Agent, run } from "@openai/agents";

import { RevisedSlideSchema, type RevisedSlide } from "../schemas/pitch-deck.ts";

/**
 * Rewriting one slide is a much narrower job than writing a deck, so this agent
 * gets its own instructions: change what the feedback asks for and nothing else.
 */
const REVISE_INSTRUCTIONS = `You revise a single slide of an investor pitch deck.

You are given the deck's idea, the slide as it stands, and one piece of feedback
someone gave while the deck was being presented. Rewrite the slide so that the
feedback is addressed.

Rules:
- Change only what the feedback asks for. Leave the rest of the slide as it was.
- Keep the slide's job: a Problem slide stays a Problem slide.
- content: 2–4 bullet points as plain text, each starting with "• "
- Keep language clear, confident and investor-friendly.
- Never invent specific figures, customer names or dates that you were not given.
  If the feedback asks for a number you do not have, write the point so the number
  can be dropped in later.`;

const slideReviserAgent = new Agent({
  name: "SlideReviser",
  model: "gpt-4o-mini",
  instructions: REVISE_INSTRUCTIONS,
  // Zod v4 types differ slightly from the SDK — runtime structured output works fine.
  outputType: RevisedSlideSchema as any,
});

type ReviseInput = {
  idea: string;
  title: string;
  content: string;
  instruction: string;
};

/** Rewrite one slide from a single piece of feedback. */
export async function reviseSlide({ idea, title, content, instruction }: ReviseInput): Promise<RevisedSlide> {
  const prompt = [
    `Deck idea: ${idea}`,
    ``,
    `Slide title: ${title}`,
    `Slide content:`,
    content,
    ``,
    `Feedback to address: ${instruction}`,
  ].join("\n");

  const result = await run(slideReviserAgent, prompt);
  return RevisedSlideSchema.parse(result.finalOutput);
}
