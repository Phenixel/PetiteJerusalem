import { beforeEach, describe, expect, it } from "vitest";
import {
  markNudgeAnswered,
  markNudgeShown,
  NUDGE_MAX_SHOWS,
  NUDGE_RETRY_DAYS,
  readNudgeState,
  recordUsageDay,
  shouldOfferFeedbackNudge,
  USAGE_DAYS_REQUIRED,
  usageDayCount,
} from "../services/feedbackNudge";

/**
 * La relance « Tout se passe bien ? » : elle compte des jours distincts, se
 * propose après quelques-uns, n'insiste pas, et se tait une fois répondue.
 */

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-09-14T10:00:00Z");

describe("recordUsageDay", () => {
  beforeEach(() => localStorage.clear());

  it("compte les jours distincts, pas les ouvertures", () => {
    expect(recordUsageDay("2026-09-12")).toBe(1);
    expect(recordUsageDay("2026-09-12")).toBe(1);
    expect(recordUsageDay("2026-09-13")).toBe(2);
    expect(usageDayCount()).toBe(2);
  });

  it("ne garde que les derniers jours", () => {
    for (let i = 1; i <= 15; i++) recordUsageDay(`2026-09-${String(i).padStart(2, "0")}`);
    expect(usageDayCount()).toBe(10);
  });

  it("repart de zéro sur une valeur trafiquée", () => {
    localStorage.setItem("pj_usage_days", "pas du json");
    expect(usageDayCount()).toBe(0);
    expect(recordUsageDay("2026-09-14")).toBe(1);
  });
});

describe("shouldOfferFeedbackNudge", () => {
  it("attend assez de jours d'usage", () => {
    expect(shouldOfferFeedbackNudge({ usageDays: USAGE_DAYS_REQUIRED - 1, state: null, now })).toBe(
      false,
    );
    expect(shouldOfferFeedbackNudge({ usageDays: USAGE_DAYS_REQUIRED, state: null, now })).toBe(
      true,
    );
  });

  it("se tait une fois répondue", () => {
    const state = { shows: 1, lastShownAt: null, answered: true };
    expect(shouldOfferFeedbackNudge({ usageDays: 10, state, now })).toBe(false);
  });

  it("n'insiste pas au-delà de quelques propositions", () => {
    const old = new Date(now.getTime() - 30 * DAY).toISOString();
    const state = { shows: NUDGE_MAX_SHOWS, lastShownAt: old, answered: false };
    expect(shouldOfferFeedbackNudge({ usageDays: 10, state, now })).toBe(false);
  });

  it("laisse une semaine entre deux propositions", () => {
    const recent = new Date(now.getTime() - (NUDGE_RETRY_DAYS - 1) * DAY).toISOString();
    const late = new Date(now.getTime() - NUDGE_RETRY_DAYS * DAY).toISOString();
    expect(
      shouldOfferFeedbackNudge({
        usageDays: 10,
        state: { shows: 1, lastShownAt: recent, answered: false },
        now,
      }),
    ).toBe(false);
    expect(
      shouldOfferFeedbackNudge({
        usageDays: 10,
        state: { shows: 1, lastShownAt: late, answered: false },
        now,
      }),
    ).toBe(true);
  });
});

describe("mémoire de la relance", () => {
  beforeEach(() => localStorage.clear());

  it("compte les affichages puis retient la réponse", () => {
    expect(readNudgeState()).toBeNull();
    markNudgeShown(now);
    expect(readNudgeState()).toEqual({
      shows: 1,
      lastShownAt: now.toISOString(),
      answered: false,
    });
    markNudgeAnswered();
    expect(readNudgeState()?.answered).toBe(true);
    expect(readNudgeState()?.shows).toBe(1);
    expect(shouldOfferFeedbackNudge({ usageDays: 10, state: readNudgeState(), now })).toBe(false);
  });
});
