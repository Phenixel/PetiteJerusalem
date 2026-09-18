import { describe, expect, it } from "vitest";
import {
  EMPTY_STREAK,
  mergeStreak,
  previousDayKey,
  recordDayDone,
  streakExpiresAt,
  streakStatus,
} from "../services/dailyStreak";

/**
 * La série de jours : elle monte d'un cran par jour où tout est fait, tombe
 * à zéro dès qu'un jour manque, et garde son record.
 */
describe("recordDayDone", () => {
  it("commence une série à un", () => {
    expect(recordDayDone(undefined, "2026-09-18")).toEqual({
      current: 1,
      best: 1,
      lastDate: "2026-09-18",
    });
  });

  it("continue la série quand hier était fait", () => {
    const streak = recordDayDone({ current: 4, best: 9, lastDate: "2026-09-17" }, "2026-09-18");
    expect(streak).toEqual({ current: 5, best: 9, lastDate: "2026-09-18" });
  });

  it("bat le record en passant", () => {
    const streak = recordDayDone({ current: 9, best: 9, lastDate: "2026-09-17" }, "2026-09-18");
    expect(streak.best).toBe(10);
  });

  it("repart de un après un jour manqué, sans perdre le record", () => {
    const streak = recordDayDone({ current: 6, best: 6, lastDate: "2026-09-15" }, "2026-09-18");
    expect(streak).toEqual({ current: 1, best: 6, lastDate: "2026-09-18" });
  });

  it("ne compte pas deux fois le même jour", () => {
    const today = { current: 3, best: 3, lastDate: "2026-09-18" };
    expect(recordDayDone(today, "2026-09-18")).toBe(today);
  });

  it("passe les fins de mois et d'année", () => {
    expect(previousDayKey("2026-03-01")).toBe("2026-02-28");
    expect(previousDayKey("2026-01-01")).toBe("2025-12-31");
    expect(
      recordDayDone({ current: 1, best: 1, lastDate: "2025-12-31" }, "2026-01-01").current,
    ).toBe(2);
  });
});

describe("streakStatus", () => {
  it("dit que tout est fait aujourd'hui", () => {
    const status = streakStatus({ current: 5, best: 9, lastDate: "2026-09-18" }, "2026-09-18");
    expect(status).toEqual({ current: 5, best: 9, doneToday: true, atRisk: false });
  });

  it("tient encore aujourd'hui quand hier était fait", () => {
    const status = streakStatus({ current: 5, best: 9, lastDate: "2026-09-17" }, "2026-09-18");
    expect(status).toEqual({ current: 5, best: 9, doneToday: false, atRisk: true });
  });

  it("tombe à zéro après un jour manqué, le record reste", () => {
    const status = streakStatus({ current: 5, best: 9, lastDate: "2026-09-16" }, "2026-09-18");
    expect(status).toEqual({ current: 0, best: 9, doneToday: false, atRisk: false });
  });

  it("vaut zéro sans série", () => {
    expect(streakStatus(undefined, "2026-09-18")).toEqual({
      current: 0,
      best: 0,
      doneToday: false,
      atRisk: false,
    });
  });
});

describe("streakExpiresAt", () => {
  it("expire au minuit qui suit le lendemain du dernier jour fait", () => {
    const expiry = new Date(streakExpiresAt({ current: 2, best: 2, lastDate: "2026-09-18" }));
    // Fait le 18 : tient tout le 19, tombe le 20 à 0 h.
    expect(expiry.getFullYear()).toBe(2026);
    expect(expiry.getMonth()).toBe(8);
    expect(expiry.getDate()).toBe(20);
    expect(expiry.getHours()).toBe(0);
    expect(expiry.getMinutes()).toBe(0);
  });

  it("n'expire jamais sans série", () => {
    expect(streakExpiresAt(EMPTY_STREAK)).toBe(0);
    expect(streakExpiresAt(undefined)).toBe(0);
  });
});

describe("mergeStreak", () => {
  it("retient la série la plus récente et le meilleur record", () => {
    const merged = mergeStreak(
      { current: 3, best: 12, lastDate: "2026-09-17" },
      { current: 4, best: 4, lastDate: "2026-09-18" },
    );
    expect(merged).toEqual({ current: 4, best: 12, lastDate: "2026-09-18" });
  });

  it("garde la plus longue à jour égal", () => {
    const merged = mergeStreak(
      { current: 3, best: 3, lastDate: "2026-09-18" },
      { current: 5, best: 5, lastDate: "2026-09-18" },
    );
    expect(merged).toEqual({ current: 5, best: 5, lastDate: "2026-09-18" });
  });

  it("accepte une série absente d'un côté", () => {
    const only = { current: 1, best: 1, lastDate: "2026-09-18" };
    expect(mergeStreak(undefined, only)).toEqual(only);
    expect(mergeStreak(only, undefined)).toEqual(only);
    expect(mergeStreak(undefined, undefined)).toBeUndefined();
  });
});
