import { NonRetriableError } from "inngest";

import { reviseSlide } from "../../agents/revise-slide.ts";
import { SlideTextStatus } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/prisma.js";
import { inngest } from "../client.ts";

/**
 * Rewrite one slide from a single piece of feedback captured while presenting.
 * Same per-slide shape as regenerate-slide-image: one slide, one step, and the
 * rest of the deck is never touched.
 */
export const rewriteSlideText = inngest.createFunction(
  {
    id: "rewrite-slide-text",
    triggers: [{ event: "slide/rewrite-text" }],
    // Deleting the deck stops this run too
    cancelOn: [{ event: "deck/cancel", match: "data.deckId" }],
  },
  async ({ event, step }) => {
    const { deckId, slideId, noteId } = event.data;

    try {
      const revised = await step.run("revise", async () => {
        // Config error — retrying can't fix a missing key
        if (!process.env.OPENAI_API_KEY) {
          throw new NonRetriableError("OPENAI_API_KEY is not set in backend/.env");
        }

        // The slide (or the whole deck) can be deleted while this waits in the queue
        const slide = await prisma.slide.findFirst({
          where: { id: slideId, deckId },
          include: { deck: { select: { idea: true } } },
        });
        if (!slide) {
          throw new NonRetriableError(`Slide was deleted: ${slideId}`);
        }

        // Read the note here rather than trusting the event: it may have been
        // edited or deleted between the click and this run
        const note = await prisma.slideNote.findFirst({ where: { id: noteId, slideId } });
        if (!note?.body.trim()) {
          throw new NonRetriableError("That note no longer has anything to apply.");
        }

        return reviseSlide({
          idea: slide.deck.idea,
          title: slide.title,
          content: slide.content,
          instruction: note.body,
        });
      });

      await step.run("save-text", async () => {
        // updateMany: silently does nothing if the slide is gone
        await prisma.slide.updateMany({
          where: { id: slideId, deckId },
          data: { title: revised.title, content: revised.content, textStatus: SlideTextStatus.READY },
        });

        // The feedback has been acted on — tick it off so the list stays a to-do list
        await prisma.slideNote.updateMany({ where: { id: noteId, slideId }, data: { resolved: true } });
      });

      return { slideId, title: revised.title };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error while rewriting the slide";

      // Keep the old wording, just mark the attempt as failed
      await step.run("mark-failed", async () => {
        await prisma.slide.updateMany({
          where: { id: slideId, deckId },
          data: { textStatus: SlideTextStatus.FAILED },
        });
      });

      throw new NonRetriableError(message);
    }
  },
);
