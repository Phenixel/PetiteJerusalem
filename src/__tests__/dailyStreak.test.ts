import { describe, expect, it } from "vitest";
import {
  EMPTY_STREAK,
  MAX_FREEZES,
  mergeStreak,
  milestoneReached,
  previousDayKey,
  recordDayDone,
  streakExpiresAt,
  streakStatus,
} from "../services/dailyStreak";

/**
 * La série de jours : elle monte d'un cran par jour où la journée est
 * réussie, tombe à zéro dès qu'un jour compté manque, traverse les jours de
 * pause, et garde son record. Les jokers, gagnés une semaine à la fois,
 * couvrent un jour manqué.
 */
const shabbat = { isPause: (key: string) => new Date(key + "T12:00:00").getDay() === 6 };

describe("recordDayDone", () => {
  it("commence une série à un", () => {
    expect(recordDayDone(undefined, "2026-09-18")).toEqual({
      current: 1,
      best: 1,
      lastDate: "2026-09-18",
      freezes: 0,
    });
  });

  it("continue la série quand hier était fait", () => {
    const streak = recordDayDone({ current: 4, best: 9, lastDate: "2026-09-17" }, "2026-09-18");
    expect(streak).toMatchObject({ current: 5, best: 9, lastDate: "2026-09-18" });
  });

  it("bat le record en passant", () => {
    const streak = recordDayDone({ current: 9, best: 9, lastDate: "2026-09-17" }, "2026-09-18");
    expect(streak.best).toBe(10);
  });

  it("repart de un après un jour manqué, sans perdre le record", () => {
    const streak = recordDayDone({ current: 6, best: 6, lastDate: "2026-09-15" }, "2026-09-18");
    expect(streak).toMatchObject({ current: 1, best: 6, lastDate: "2026-09-18" });
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

  it("traverse le Chabbat sans le compter", () => {
    // Vendredi 18 fait, dimanche 20 fait : le Chabbat 19 entre les deux est une pause.
    const streak = recordDayDone(
      { current: 3, best: 3, lastDate: "2026-09-18" },
      "2026-09-20",
      shabbat,
    );
    expect(streak.current).toBe(4);
    // Sans la règle de pause, le 19 est un jour manqué.
    expect(
      recordDayDone({ current: 3, best: 3, lastDate: "2026-09-18" }, "2026-09-20").current,
    ).toBe(1);
  });

  it("gagne un joker par semaine entière, deux au plus", () => {
    const seven = recordDayDone({ current: 6, best: 6, lastDate: "2026-09-17" }, "2026-09-18");
    expect(seven.freezes).toBe(1);
    const fourteen = recordDayDone(
      { current: 13, best: 13, lastDate: "2026-09-17", freezes: MAX_FREEZES },
      "2026-09-18",
    );
    expect(fourteen.freezes).toBe(MAX_FREEZES);
  });

  it("consomme un joker pour un jour manqué au lieu de rompre", () => {
    const streak = recordDayDone(
      { current: 8, best: 8, lastDate: "2026-09-16", freezes: 1 },
      "2026-09-18",
    );
    expect(streak).toMatchObject({ current: 9, freezes: 0 });
    // Deux jours manqués pour un seul joker : la série tombe, le joker reste.
    const broken = recordDayDone(
      { current: 8, best: 8, lastDate: "2026-09-14", freezes: 1 },
      "2026-09-18",
    );
    expect(broken).toMatchObject({ current: 1, freezes: 1 });
  });
});

describe("streakStatus", () => {
  it("dit que tout est fait aujourd'hui", () => {
    const status = streakStatus({ current: 5, best: 9, lastDate: "2026-09-18" }, "2026-09-18");
    expect(status).toMatchObject({ current: 5, best: 9, doneToday: true, atRisk: false });
  });

  it("tient encore aujourd'hui quand hier était fait", () => {
    const status = streakStatus({ current: 5, best: 9, lastDate: "2026-09-17" }, "2026-09-18");
    expect(status).toMatchObject({ current: 5, best: 9, doneToday: false, atRisk: true });
  });

  it("tombe à zéro après un jour manqué, le record reste", () => {
    const status = streakStatus({ current: 5, best: 9, lastDate: "2026-09-16" }, "2026-09-18");
    expect(status).toMatchObject({ current: 0, best: 9, doneToday: false, atRisk: false });
  });

  it("tient le Chabbat sans rien faire, et le dit", () => {
    const status = streakStatus(
      { current: 5, best: 9, lastDate: "2026-09-18" },
      "2026-09-19",
      shabbat,
    );
    expect(status).toMatchObject({ current: 5, atRisk: false, pausedToday: true });
    const sunday = streakStatus(
      { current: 5, best: 9, lastDate: "2026-09-18" },
      "2026-09-20",
      shabbat,
    );
    expect(sunday).toMatchObject({ current: 5, atRisk: true, pausedToday: false });
  });

  it("tient grâce à un joker et compte ceux qu'il faudra", () => {
    const status = streakStatus(
      { current: 5, best: 9, lastDate: "2026-09-16", freezes: 1 },
      "2026-09-18",
    );
    expect(status).toMatchObject({ current: 5, atRisk: true, freezes: 1, freezesNeeded: 1 });
  });

  it("vaut zéro sans série", () => {
    expect(streakStatus(undefined, "2026-09-18")).toMatchObject({
      current: 0,
      best: 0,
      doneToday: false,
      atRisk: false,
    });
  });
});

describe("streakExpiresAt", () => {
  it("expire au minuit qui suit le lendemain du dernier jour fait", () => {
    const expiry = new Date(streakExpiresAt({ current: 2, best: 2, lastDate: "2026-09-16" }));
    // Fait le 16 : tient tout le 17, tombe le 18 à 0 h.
    expect(expiry.getDate()).toBe(18);
    expect(expiry.getHours()).toBe(0);
    expect(expiry.getMinutes()).toBe(0);
  });

  it("enjambe le Chabbat et les jokers", () => {
    // Fait le vendredi 18 : le Chabbat ne compte pas, le dimanche 20 oui.
    const expiry = new Date(
      streakExpiresAt({ current: 2, best: 2, lastDate: "2026-09-18" }, shabbat),
    );
    expect(expiry.getDate()).toBe(21);
    // Un joker en réserve couvre le dimanche : l'échéance passe au lundi.
    const withFreeze = new Date(
      streakExpiresAt({ current: 2, best: 2, lastDate: "2026-09-18", freezes: 1 }, shabbat),
    );
    expect(withFreeze.getDate()).toBe(22);
  });

  it("n'expire jamais sans série", () => {
    expect(streakExpiresAt(EMPTY_STREAK)).toBe(0);
    expect(streakExpiresAt(undefined)).toBe(0);
  });
});

describe("mergeStreak", () => {
  it("retient la série la plus récente, le meilleur record et les jokers", () => {
    const merged = mergeStreak(
      { current: 3, best: 12, lastDate: "2026-09-17", freezes: 2 },
      { current: 4, best: 4, lastDate: "2026-09-18" },
    );
    expect(merged).toEqual({ current: 4, best: 12, lastDate: "2026-09-18", freezes: 2 });
  });

  it("garde la plus longue à jour égal", () => {
    const merged = mergeStreak(
      { current: 3, best: 3, lastDate: "2026-09-18" },
      { current: 5, best: 5, lastDate: "2026-09-18" },
    );
    expect(merged).toMatchObject({ current: 5, best: 5, lastDate: "2026-09-18" });
  });

  it("accepte une série absente d'un côté", () => {
    const only = { current: 1, best: 1, lastDate: "2026-09-18" };
    expect(mergeStreak(undefined, only)).toEqual(only);
    expect(mergeStreak(only, undefined)).toEqual(only);
    expect(mergeStreak(undefined, undefined)).toBeUndefined();
  });
});

describe("milestoneReached", () => {
  it("nomme les paliers qu'on fête", () => {
    expect(milestoneReached(7)).toBe(7);
    expect(milestoneReached(8)).toBeNull();
    expect(milestoneReached(365)).toBe(365);
  });
});
