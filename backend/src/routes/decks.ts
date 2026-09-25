import { Router } from "express";

import { z } from "zod";

import { authGuard } from "../lib/auth.ts";
import { inngest } from "../inngest/client.ts";
import { buildPdf, buildPptx, toFileName, type ExportDeck } from "../lib/export.ts";
import { prisma } from "../lib/prisma.js";
import { SlideSchema } from "../schemas/pitch-deck.ts";
import type { DeckDetail, DeckListItem } from "../types/deck.ts";

/** Editing is partial: send only the fields you changed, same limits as the agent output. */
const SlideEditSchema = SlideSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Nothing to update",
);

export const decksRouter = Router();

// Every route below belongs to the signed-in user only
decksRouter.use(authGuard);

/** Create a deck and kick off the Inngest "deck/generate" flow. */
decksRouter.post("/", async (req, res) => {
  const idea = typeof req.body?.idea === "string" ? req.body.idea.trim() : "";

  // Same rule as the input guardrail — fail fast before queuing a job
  if (idea.length < 20) {
    res.status(400).json({ error: "Project idea must be at least 20 characters." });
    return;
  }

  const deck = await prisma.deck.create({ data: { idea, userId: req.userId } });

  try {
    await inngest.send({ name: "deck/generate", data: { deckId: deck.id } });
  } catch (error) {
    // Without the event no job will ever run — don't leave the deck stuck in PENDING
    const reason = error instanceof Error ? error.message : String(error);
    await prisma.deck.update({
      where: { id: deck.id },
      data: { status: "FAILED", errorMessage: `Could not queue generation job: ${reason}` },
    });
    res.status(502).json({ error: "Could not reach Inngest. Is the Inngest dev server running?", id: deck.id });
    return;
  }

  res.status(201).json({ id: deck.id });
});

/** The signed-in user's decks, newest first. */
decksRouter.get("/", async (req, res) => {
  const decks = await prisma.deck.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { slides: true } } },
  });

  const items: DeckListItem[] = decks.map(({ _count, createdAt, updatedAt, userId, ...deck }) => ({
    ...deck,
    slideCount: _count.slides,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  }));

  res.json(items);
});

/** Stop a running generation (if any) and delete the deck + its slides. */
decksRouter.delete("/:id", async (req, res) => {
  // findFirst with userId: another user's deck is simply "not found"
  const deck = await prisma.deck.findFirst({
    where: { id: req.params.id, userId: req.userId },
    select: { id: true, status: true },
  });

  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  if (deck.status === "PENDING" || deck.status === "GENERATING") {
    try {
      await inngest.send({ name: "deck/cancel", data: { deckId: deck.id } });
    } catch (error) {
      // Still delete: if Inngest is down the run can't progress, and the function
      // itself stops before generating images for a deck that no longer exists
      console.warn(`Could not send deck/cancel for ${deck.id}:`, error);
    }
  }

  // Slides are removed by the onDelete: Cascade relation
  await prisma.deck.deleteMany({ where: { id: deck.id, userId: req.userId } });

  res.status(204).end();
});

/** Edit one slide's text. */
decksRouter.patch("/:deckId/slides/:slideId", async (req, res) => {
  const parsed = SlideEditSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    res.status(400).json({ error: z.prettifyError(parsed.error) });
    return;
  }

  // updateMany with the deck's userId: another user's slide is never touched
  const { count } = await prisma.slide.updateMany({
    where: { id: req.params.slideId, deck: { id: req.params.deckId, userId: req.userId } },
    data: parsed.data,
  });

  if (count === 0) {
    res.status(404).json({ error: "Slide not found" });
    return;
  }

  res.status(204).end();
});

/** Re-illustrate one slide with its current image prompt. */
decksRouter.post("/:deckId/slides/:slideId/regenerate-image", async (req, res) => {
  const slide = await prisma.slide.findFirst({
    where: { id: req.params.slideId, deck: { id: req.params.deckId, userId: req.userId } },
    select: { id: true },
  });

  if (!slide) {
    res.status(404).json({ error: "Slide not found" });
    return;
  }

  // Mark first, so the UI shows the spinner even before Inngest picks the job up
  await prisma.slide.update({
    where: { id: slide.id },
    data: { imageStatus: "GENERATING" },
  });

  try {
    await inngest.send({
      name: "slide/regenerate-image",
      data: { deckId: req.params.deckId, slideId: slide.id },
    });
  } catch (error) {
    await prisma.slide.update({ where: { id: slide.id }, data: { imageStatus: "FAILED" } });
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`Could not queue slide/regenerate-image for ${slide.id}:`, reason);
    res.status(502).json({ error: "Could not reach Inngest. Is the Inngest dev server running?" });
    return;
  }

  res.status(202).json({ id: slide.id });
});

/** Download the deck as .pptx or .pdf. */
decksRouter.get("/:id/export", async (req, res) => {
  const format = req.query.format === "pdf" ? "pdf" : req.query.format === "pptx" ? "pptx" : null;

  if (!format) {
    res.status(400).json({ error: "Use ?format=pptx or ?format=pdf" });
    return;
  }

  const deck = await prisma.deck.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: { slides: { orderBy: { order: "asc" } } },
  });

  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  if (deck.slides.length === 0) {
    res.status(409).json({ error: "This deck has no slides yet." });
    return;
  }

  const exportDeck: ExportDeck = {
    title: deck.title,
    idea: deck.idea,
    slides: deck.slides.map(({ order, title, content, imageUrl }) => ({ order, title, content, imageUrl })),
  };

  const file = format === "pptx" ? await buildPptx(exportDeck) : await buildPdf(exportDeck);
  const fileName = toFileName(exportDeck, format);

  res.setHeader(
    "Content-Type",
    format === "pptx"
      ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      : "application/pdf",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Content-Length", String(file.length));
  res.send(file);
});

/** One deck with its slides — the UI polls this while the flow runs. */
decksRouter.get("/:id", async (req, res) => {
  const deck = await prisma.deck.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: { slides: { orderBy: { order: "asc" } } },
  });

  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const detail: DeckDetail = {
    id: deck.id,
    idea: deck.idea,
    title: deck.title,
    status: deck.status,
    errorMessage: deck.errorMessage,
    slides: deck.slides.map(({ id, order, title, content, imagePrompt, imageUrl, imageStatus }) => ({
      id,
      order,
      title,
      content,
      imagePrompt,
      imageUrl,
      imageStatus,
    })),
    createdAt: deck.createdAt.toISOString(),
    updatedAt: deck.updatedAt.toISOString(),
  };

  res.json(detail);
});
