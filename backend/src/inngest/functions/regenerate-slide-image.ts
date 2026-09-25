import { NonRetriableError } from "inngest";

import { SlideImageStatus } from "../../generated/prisma/client.ts";
import { uploadSlideImage } from "../../lib/imagekit.ts";
import { generateSlideImage, usesPlaceholderImages } from "../../lib/openai.ts";
import { prisma } from "../../lib/prisma.js";
import { inngest } from "../client.ts";

/**
 * Re-illustrate a single slide, using whatever image prompt the slide has now
 * (the user may have edited it). Same shape as the per-slide step in
 * generate-deck, just triggered on its own.
 */
export const regenerateSlideImage = inngest.createFunction(
  {
    id: "regenerate-slide-image",
    triggers: [{ event: "slide/regenerate-image" }],
    // Deleting the deck stops this run too
    cancelOn: [{ event: "deck/cancel", match: "data.deckId" }],
  },
  async ({ event, step }) => {
    const { deckId, slideId } = event.data;

    try {
      const imageUrl = await step.run("image", async () => {
        // Config error — retrying can't fix a missing key
        if (!usesPlaceholderImages() && !process.env.OPENAI_API_KEY) {
          throw new NonRetriableError("OPENAI_API_KEY is not set in backend/.env");
        }

        // The deck (and slide) can be deleted while this waits in the queue
        const slide = await prisma.slide.findFirst({ where: { id: slideId, deckId } });
        if (!slide) {
          throw new NonRetriableError(`Slide was deleted: ${slideId}`);
        }

        const image = await generateSlideImage(slide.imagePrompt);
        // New file name every time, so browsers never show the old cached image
        const fileName = `deck-${deckId}-slide-${slide.order}-${Date.now()}.${image.extension}`;
        return uploadSlideImage(image.buffer, fileName);
      });

      await step.run("save-image", async () => {
        // updateMany: silently does nothing if the slide is gone
        await prisma.slide.updateMany({
          where: { id: slideId, deckId },
          data: { imageUrl, imageStatus: SlideImageStatus.READY },
        });
      });

      return { slideId, imageUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error while regenerating the image";

      // Keep the old image, just mark the attempt as failed
      await step.run("mark-failed", async () => {
        await prisma.slide.updateMany({
          where: { id: slideId, deckId },
          data: { imageStatus: SlideImageStatus.FAILED },
        });
      });

      throw new NonRetriableError(message);
    }
  },
);
