import type { QuotaSnapshot } from "./api.ts";

/** UTC, same clock the server uses, so the hint and the 429 message name the same day. */
function formatUtcDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Short line under the composer. Null while the quota has not loaded — the button stays usable. */
export function deckQuotaHint(quota: QuotaSnapshot | undefined): string | null {
  if (!quota) return null;

  if (quota.decks.remaining <= 0) {
    return `Monthly limit reached · new decks on ${formatUtcDay(quota.decks.resetsAt)}`;
  }

  if (quota.concurrent.active >= quota.concurrent.limit) {
    return "A deck is already generating — wait for it, or delete it, before starting another.";
  }

  return `${quota.decks.remaining} of ${quota.decks.limit} decks left this month`;
}

/** True only once we know the server will reject the next deck. A loading quota does not block. */
export function deckQuotaBlocked(quota: QuotaSnapshot | undefined): boolean {
  if (!quota) return false;
  return quota.decks.remaining <= 0 || quota.concurrent.active >= quota.concurrent.limit;
}
