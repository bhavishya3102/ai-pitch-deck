import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  concurrencyMessage,
  deckQuotaMessage,
  limitsFrom,
  parseLimit,
  startOfNextUtcDay,
  startOfNextUtcMonth,
  startOfUtcDay,
  startOfUtcMonth,
} from "./quota-policy.ts";

describe("parseLimit", () => {
  it("keeps a whole number inside the allowed range", () => {
    assert.equal(parseLimit("8", 5), 8);
    assert.equal(parseLimit(" 12 ", 5), 12);
  });

  it("falls back when the value is missing, zero, or not a whole number", () => {
    assert.equal(parseLimit(undefined, 5), 5);
    assert.equal(parseLimit("", 5), 5);
    assert.equal(parseLimit("0", 5), 5);
    assert.equal(parseLimit("-3", 5), 5);
    assert.equal(parseLimit("1.5", 5), 5);
    assert.equal(parseLimit("nope", 5), 5);
    assert.equal(parseLimit("10001", 5), 5);
  });
});

describe("limitsFrom", () => {
  it("uses the free-tier defaults when nothing is set", () => {
    assert.deepEqual(limitsFrom({}), {
      decksPerMonth: 5,
      maxConcurrentDecks: 1,
      imagesPerDay: 30,
      rewritesPerDay: 30,
    });
  });

  it("reads each quota independently and ignores a bad one", () => {
    assert.deepEqual(
      limitsFrom({
        QUOTA_DECKS_PER_MONTH: "10",
        QUOTA_MAX_CONCURRENT_DECKS: "0",
        QUOTA_IMAGES_PER_DAY: "4",
        QUOTA_REWRITES_PER_DAY: "lots",
      }),
      {
        decksPerMonth: 10,
        maxConcurrentDecks: 1,
        imagesPerDay: 4,
        rewritesPerDay: 30,
      },
    );
  });
});

describe("utc windows", () => {
  // 28 Sep 2026, 14:40 IST is still 28 Sep in UTC
  const afternoonIst = new Date("2026-09-28T09:10:00.000Z");

  it("counts a calendar month in UTC", () => {
    assert.equal(startOfUtcMonth(afternoonIst).toISOString(), "2026-09-01T00:00:00.000Z");
    assert.equal(startOfNextUtcMonth(afternoonIst).toISOString(), "2026-10-01T00:00:00.000Z");
  });

  it("counts a calendar day in UTC, including just before midnight", () => {
    const justBeforeUtcMidnight = new Date("2026-09-30T23:59:00.000Z");
    assert.equal(startOfUtcDay(justBeforeUtcMidnight).toISOString(), "2026-09-30T00:00:00.000Z");
    assert.equal(startOfNextUtcDay(justBeforeUtcMidnight).toISOString(), "2026-10-01T00:00:00.000Z");
  });
});

describe("quota messages", () => {
  it("names the limit and the UTC reset day", () => {
    const resetsAt = new Date("2026-10-01T00:00:00.000Z");
    assert.match(deckQuotaMessage(5, resetsAt), /all 5 decks/);
    assert.match(deckQuotaMessage(5, resetsAt), /1 Oct/);
    assert.match(concurrencyMessage(), /already being generated/);
  });
});
