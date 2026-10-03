/** Free-tier defaults. Override with QUOTA_* in backend/.env — invalid values fall back here. */
export const DEFAULT_LIMITS = {
  decksPerMonth: 5,
  maxConcurrentDecks: 1,
  imagesPerDay: 30,
  rewritesPerDay: 30,
} as const;

export type QuotaLimits = {
  decksPerMonth: number;
  maxConcurrentDecks: number;
  imagesPerDay: number;
  rewritesPerDay: number;
};

/**
 * A missing or garbage env value must not turn into NaN and lock every user out,
 * and 0 must not mean "unlimited". Anything outside 1..10000 keeps the default.
 */
export function parseLimit(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 10_000) return fallback;
  return value;
}

export function limitsFrom(env: Record<string, string | undefined>): QuotaLimits {
  return {
    decksPerMonth: parseLimit(env.QUOTA_DECKS_PER_MONTH, DEFAULT_LIMITS.decksPerMonth),
    maxConcurrentDecks: parseLimit(env.QUOTA_MAX_CONCURRENT_DECKS, DEFAULT_LIMITS.maxConcurrentDecks),
    imagesPerDay: parseLimit(env.QUOTA_IMAGES_PER_DAY, DEFAULT_LIMITS.imagesPerDay),
    rewritesPerDay: parseLimit(env.QUOTA_REWRITES_PER_DAY, DEFAULT_LIMITS.rewritesPerDay),
  };
}

export function currentLimits(): QuotaLimits {
  return limitsFrom(process.env);
}

export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function startOfNextUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function startOfNextUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export function formatUtcDay(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function deckQuotaMessage(limit: number, resetsAt: Date): string {
  return `You've used all ${limit} decks for this month. New decks open again on ${formatUtcDay(resetsAt)} (UTC).`;
}

export function concurrencyMessage(): string {
  return "A deck is already being generated. Wait for it to finish, or delete it, before starting another.";
}

export function imageQuotaMessage(limit: number, resetsAt: Date): string {
  return `You've used all ${limit} image regenerations for today. Try again on ${formatUtcDay(resetsAt)} (UTC).`;
}

export function rewriteQuotaMessage(limit: number, resetsAt: Date): string {
  return `You've used all ${limit} slide rewrites for today. Try again on ${formatUtcDay(resetsAt)} (UTC).`;
}
