import { NonRetriableError } from "inngest";

import {
  generatePitchDeck,
  PitchDeckGenerationError,
} from "../../agents/generate-pitch-deck.ts";
import { prisma } from "../../lib/prisma.js";
import { DeckStatus } from "../../generated/prisma/client.ts";
import { uploadSlideImage } from "../../lib/imagekit.ts";
import { inngest } from "../client.ts";
import { generateSlideImage } from "../../lib/openai.ts";

/**
 * Background job: turn a project idea into a full pitch deck with images.
 *
 * Triggered by the "deck/generate" event (sent from the API in Phase 6).
 * Each step.run() is a separate retryable step visible in the Inngest dev UI.
 */
export const generateDeck = inngest.createFunction(
  {
    id: "generate-deck",
    triggers: [{ event: "deck/generate" }],
  },
  async ({ event, step }) => {
    const { deckId } = event.data;

    // Step 1 — load the deck from the database
    const deck = await step.run("load-deck", async () => {
      const record = await prisma.deck.findUnique({ where: { id: deckId } });

      if (!record) {
        throw new NonRetriableError(`Deck not found: ${deckId}`);
      }

      return record;
    });

    try {
      // Step 2 — tell the UI we are generating (and clear slides from any previous run)
      await step.run("mark-generating", async () => {
        await prisma.$transaction([
          prisma.slide.deleteMany({ where: { deckId } }),
          prisma.deck.update({
            where: { id: deckId },
            data: { status: DeckStatus.GENERATING, errorMessage: null },
          }),
        ]);
      });

      // Step 3 — run the AI agent (guardrails + structured output)
      const pitchDeck = await step.run("run-agent", async () => {
        // Config error — retrying can't fix a missing key, so fail right away
        if (!process.env.OPENAI_API_KEY) {
          throw new NonRetriableError("OPENAI_API_KEY is not set in backend/.env");
        }

        try {
          return await generatePitchDeck(deck.idea);
        } catch (error) {
          // A guardrail block won't pass on retry — stop here instead of paying for more attempts
          if (error instanceof PitchDeckGenerationError) {
            throw new NonRetriableError(error.message);
          }
          throw error;
        }
      });

      // Step 4 — save the generated title
      await step.run("save-title", async () => {
        await prisma.deck.update({
          where: { id: deckId },
          data: { title: pitchDeck.deckTitle },
        });
      });

      // Step 5 — for each slide: generate image → upload to ImageKit → save to DB
      for (let index = 0; index < pitchDeck.slides.length; index++) {
        const slide = pitchDeck.slides[index];
        const order = index + 1;

        const imageUrl = await step.run(`image-${order}`, async () => {
          const imageBuffer = await generateSlideImage(slide.imagePrompt);
          const fileName = `deck-${deckId}-slide-${order}.png`;
          return uploadSlideImage(imageBuffer, fileName);
        });

        // Delete-then-create so a retried step never leaves a duplicate slide
        await step.run(`save-slide-${order}`, async () => {
          await prisma.$transaction([
            prisma.slide.deleteMany({ where: { deckId, order } }),
            prisma.slide.create({
              data: {
                deckId,
                order,
                title: slide.title,
                content: slide.content,
                imagePrompt: slide.imagePrompt,
                imageUrl,
              },
            }),
          ]);
        });
      }

      // Step 6 — done!
      await step.run("mark-complete", async () => {
        await prisma.deck.update({
          where: { id: deckId },
          data: { status: DeckStatus.COMPLETE },
        });
      });

      return { deckId, slideCount: pitchDeck.slides.length };
    } catch (error) {
      // Errors thrown inside step.run arrive here as a StepError, so use the message only
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error during deck generation";

      await step.run("mark-failed", async () => {
        await prisma.deck.update({
          where: { id: deckId },
          data: {
            status: DeckStatus.FAILED,
            errorMessage: message,
          },
        });
      });

      // The failing step already used up its retries — fail the run
      throw new NonRetriableError(message);
    }
  },
);
