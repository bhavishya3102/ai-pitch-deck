import { Router } from "express";

import { inngest } from "../inngest/client.ts";
import { prisma } from "../lib/prisma.js";
import type { DeckDetail, DeckListItem } from "../types/deck.ts";

export const decksRouter = Router();

/** Create a deck and kick off the Inngest "deck/generate" flow. */
decksRouter.post("/", async (req, res) => {
  const idea = typeof req.body?.idea === "string" ? req.body.idea.trim() : "";

  // Same rule as the input guardrail — fail fast before queuing a job
  if (idea.length < 20) {
    res.status(400).json({ error: "Project idea must be at least 20 characters." });
    return;
  }

  const deck = await prisma.deck.create({ data: { idea } });

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

/** All decks, newest first. */
decksRouter.get("/", async (_req, res) => {
  const decks = await prisma.deck.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { slides: true } } },
  });

  const items: DeckListItem[] = decks.map(({ _count, createdAt, updatedAt, ...deck }) => ({
    ...deck,
    slideCount: _count.slides,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  }));

  res.json(items);
});

/** One deck with its slides — the UI polls this while the flow runs. */
decksRouter.get("/:id", async (req, res) => {
  const deck = await prisma.deck.findUnique({
    where: { id: req.params.id },
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
    slides: deck.slides.map(({ id, order, title, content, imagePrompt, imageUrl }) => ({
      id,
      order,
      title,
      content,
      imagePrompt,
      imageUrl,
    })),
    createdAt: deck.createdAt.toISOString(),
    updatedAt: deck.updatedAt.toISOString(),
  };

  res.json(detail);
});
