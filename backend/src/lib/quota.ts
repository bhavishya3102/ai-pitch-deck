import type { Prisma } from "../generated/prisma/client.ts";

import { prisma } from "./prisma.js";
import {
  concurrencyMessage,
  currentLimits,
  deckQuotaMessage,
  imageQuotaMessage,
  rewriteQuotaMessage,
  startOfNextUtcDay,
  startOfNextUtcMonth,
  startOfUtcDay,
  startOfUtcMonth,
  type QuotaLimits,
} from "./quota-policy.ts";
import type { DeckOptions } from "../schemas/deck-options.ts";

export class QuotaError extends Error {
  readonly status = 429;
  readonly code: "QUOTA_DECKS" | "QUOTA_CONCURRENCY" | "QUOTA_IMAGES" | "QUOTA_REWRITES";

  constructor(code: QuotaError["code"], message: string) {
    super(message);
    this.name = "QuotaError";
    this.code = code;
  }
}

export type QuotaBucket = {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
};

export type QuotaSnapshot = {
  decks: QuotaBucket;
  concurrent: { active: number; limit: number };
  images: QuotaBucket;
  rewrites: QuotaBucket;
};

type Tx = Prisma.TransactionClient;

/** One lock per user so two clicks at once cannot both slip under the limit. */
async function lockUser(tx: Tx, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}), 481516)`;
}

function bucket(used: number, limit: number, resetsAt: Date): QuotaBucket {
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt: resetsAt.toISOString(),
  };
}

/** What this user has left. Read-only — creating a deck is the call that reserves. */
export async function readQuota(userId: string, now = new Date()): Promise<QuotaSnapshot> {
  const limits = currentLimits();
  const monthStart = startOfUtcMonth(now);
  const dayStart = startOfUtcDay(now);

  const [decksUsed, imagesUsed, rewritesUsed, active] = await Promise.all([
    prisma.usageCharge.count({ where: { userId, kind: "DECK", createdAt: { gte: monthStart } } }),
    prisma.usageCharge.count({ where: { userId, kind: "IMAGE", createdAt: { gte: dayStart } } }),
    prisma.usageCharge.count({ where: { userId, kind: "REWRITE", createdAt: { gte: dayStart } } }),
    prisma.deck.count({ where: { userId, status: { in: ["PENDING", "GENERATING"] } } }),
  ]);

  return {
    decks: bucket(decksUsed, limits.decksPerMonth, startOfNextUtcMonth(now)),
    concurrent: { active, limit: limits.maxConcurrentDecks },
    images: bucket(imagesUsed, limits.imagesPerDay, startOfNextUtcDay(now)),
    rewrites: bucket(rewritesUsed, limits.rewritesPerDay, startOfNextUtcDay(now)),
  };
}

async function assertDecksLeft(tx: Tx, userId: string, limits: QuotaLimits, now: Date) {
  const used = await tx.usageCharge.count({
    where: { userId, kind: "DECK", createdAt: { gte: startOfUtcMonth(now) } },
  });

  if (used >= limits.decksPerMonth) {
    throw new QuotaError("QUOTA_DECKS", deckQuotaMessage(limits.decksPerMonth, startOfNextUtcMonth(now)));
  }

  const active = await tx.deck.count({
    where: { userId, status: { in: ["PENDING", "GENERATING"] } },
  });

  if (active >= limits.maxConcurrentDecks) {
    throw new QuotaError("QUOTA_CONCURRENCY", concurrencyMessage());
  }
}

/**
 * Create the deck and record the charge in one transaction. If anything throws,
 * neither row is kept — a rejected request does not spend the month's decks.
 */
export async function reserveDeck(userId: string, idea: string, options: DeckOptions) {
  const limits = currentLimits();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    await assertDecksLeft(tx, userId, limits, now);

    const deck = await tx.deck.create({
      data: { idea, userId, audience: options.audience, tone: options.tone, slideCount: options.slideCount },
    });
    const charge = await tx.usageCharge.create({ data: { userId, kind: "DECK" } });

    return { deck, chargeId: charge.id };
  });
}

type SlideReserve =
  | { ok: true; chargeId: string }
  | { ok: false; reason: "missing" | "busy" };

async function reserveSlideJob(
  userId: string,
  deckId: string,
  slideId: string,
  kind: "IMAGE" | "REWRITE",
): Promise<SlideReserve> {
  const limits = currentLimits();
  const now = new Date();
  const limit = kind === "IMAGE" ? limits.imagesPerDay : limits.rewritesPerDay;
  const busy = kind === "IMAGE" ? "GENERATING" : "REWRITING";

  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);

    const slide = await tx.slide.findFirst({
      where: { id: slideId, deck: { id: deckId, userId } },
      select: { id: true, imageStatus: true, textStatus: true },
    });

    if (!slide) return { ok: false, reason: "missing" };
    if ((kind === "IMAGE" ? slide.imageStatus : slide.textStatus) === busy) {
      return { ok: false, reason: "busy" };
    }

    const used = await tx.usageCharge.count({
      where: { userId, kind, createdAt: { gte: startOfUtcDay(now) } },
    });

    if (used >= limit) {
      const resetsAt = startOfNextUtcDay(now);
      throw new QuotaError(
        kind === "IMAGE" ? "QUOTA_IMAGES" : "QUOTA_REWRITES",
        kind === "IMAGE" ? imageQuotaMessage(limit, resetsAt) : rewriteQuotaMessage(limit, resetsAt),
      );
    }

    const charge = await tx.usageCharge.create({ data: { userId, kind } });
    await tx.slide.update({
      where: { id: slide.id },
      data: kind === "IMAGE" ? { imageStatus: "GENERATING" } : { textStatus: "REWRITING" },
    });
    return { ok: true, chargeId: charge.id };
  });
}

export function reserveImage(userId: string, deckId: string, slideId: string) {
  return reserveSlideJob(userId, deckId, slideId, "IMAGE");
}

export function reserveRewrite(userId: string, deckId: string, slideId: string) {
  return reserveSlideJob(userId, deckId, slideId, "REWRITE");
}

/** The job never started, so the charge should not count. A missing row is fine. */
export async function refundCharge(chargeId: string) {
  await prisma.usageCharge.deleteMany({ where: { id: chargeId } });
}
