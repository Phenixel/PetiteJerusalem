import { describe, expect, it } from "vitest";
import {
  dayState,
  daySucceeded,
  HISTORY_DAYS,
  mergeHistory,
  monthGrid,
  pruneHistory,
  weeklyCount,
  weekOf,
  type DailyHistory,
} from "../services/dailyHistory";
import { historyTotals, siyoumimOf } from "../services/dailyStats";
import { activeChallenge, challengeProgress } from "../services/dailyChallenges";
import { isRestDayKey, pauseRule } from "../services/restDays";

/**
 * L'historique des journées et ce qu'on en tire : la règle de la journée
 * réussie, la semaine, le mois, les compteurs, les siyoumim, les défis.
 */
const shabbatOnly = (key: string) => new Date(key + "T12:00:00").getDay() === 6;

describe("daySucceeded", () => {
  it("juge la journée selon la règle choisie", () => {
    expect(daySucceeded(5, 5, "all")).toBe(true);
    expect(daySucceeded(4, 5, "all")).toBe(false);
    expect(daySucceeded(3, 5, "half")).toBe(true);
    expect(daySucceeded(2, 5, "half")).toBe(false);
    expect(daySucceeded(1, 5, "one")).toBe(true);
    // Rien à faire, ou rien de fait : jamais réussie.
    expect(daySucceeded(0, 0, "one")).toBe(false);
    expect(daySucceeded(0, 3, "one")).toBe(false);
  });
});

describe("pruneHistory et mergeHistory", () => {
  it("ne garde que quatre mois de journées", () => {
    const history: DailyHistory = {
      "2026-01-01": { done: 1, total: 1, ok: true, keys: ["chaharit"] },
      "2026-09-18": { done: 1, total: 1, ok: true, keys: ["chaharit"] },
      "2026-09-30": { done: 1, total: 1, ok: true, keys: ["chaharit"] },
    };
    const kept = pruneHistory(history, "2026-09-18");
    expect(Object.keys(kept)).toEqual(["2026-09-18"]);
    expect(HISTORY_DAYS).toBe(120);
  });

  it("réunit les journées des deux côtés, le fait gagne", () => {
    const merged = mergeHistory(
      { "2026-09-17": { done: 1, total: 3, ok: false, keys: ["chaharit"] } },
      {
        "2026-09-17": { done: 2, total: 3, ok: false, keys: ["minha"] },
        "2026-09-18": { done: 3, total: 3, ok: true, keys: ["chaharit", "minha", "arvit"] },
      },
    );
    expect(merged?.["2026-09-17"]).toEqual({
      done: 2,
      total: 3,
      ok: false,
      keys: ["chaharit", "minha"],
    });
    expect(merged?.["2026-09-18"]?.ok).toBe(true);
  });
});

describe("la semaine et le mois", () => {
  const history: DailyHistory = {
    "2026-09-14": { done: 3, total: 3, ok: true, keys: ["chaharit"] },
    "2026-09-15": { done: 1, total: 3, ok: false, keys: ["chaharit"] },
    "2026-09-17": { done: 3, total: 3, ok: true, keys: ["chaharit"] },
  };

  it("range les sept jours du dimanche au Chabbat, avec leur état", () => {
    // Vendredi 18 septembre 2026 : la semaine va du 13 au 19.
    const week = weekOf("2026-09-18", history, shabbatOnly);
    expect(week.map((c) => c.key)).toEqual([
      "2026-09-13",
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
    ]);
    expect(week.map((c) => c.state)).toEqual([
      "empty", // avant la première journée connue : rien n'a été manqué
      "done",
      "partial",
      "missed",
      "done",
      "empty", // aujourd'hui, rien encore
      "pause", // le Chabbat, à venir mais en pause
    ]);
    expect(week[5].today).toBe(true);
  });

  it("marque les Chabbats en pause et les jours à venir", () => {
    expect(dayState("2026-09-11", history, "2026-09-18", shabbatOnly)).toBe("empty");
    expect(dayState("2026-09-12", history, "2026-09-18", shabbatOnly)).toBe("pause");
    expect(dayState("2026-09-25", history, "2026-09-18", shabbatOnly)).toBe("future");
    // Un Chabbat à venir se montre déjà en pause.
    expect(dayState("2026-09-26", history, "2026-09-18", shabbatOnly)).toBe("pause");
  });

  it("dresse la grille du mois, calée sur le dimanche", () => {
    // Septembre 2026 commence un mardi : deux cases vides avant le 1er.
    const grid = monthGrid(2026, 8, history, "2026-09-18", shabbatOnly);
    expect(grid.slice(0, 2)).toEqual([null, null]);
    expect(grid.filter(Boolean)).toHaveLength(30);
    expect(grid[2]?.day).toBe(1);
  });
});

describe("weeklyCount", () => {
  it("compte les fois de la semaine, aujourd'hui compris", () => {
    const history: DailyHistory = {
      "2026-09-14": { done: 1, total: 1, ok: true, keys: ["g-1"] },
      "2026-09-16": { done: 1, total: 1, ok: true, keys: ["g-1"] },
      // La semaine d'avant ne compte pas.
      "2026-09-10": { done: 1, total: 1, ok: true, keys: ["g-1"] },
    };
    expect(weeklyCount("g-1", history, "2026-09-18", false)).toBe(2);
    expect(weeklyCount("g-1", history, "2026-09-18", true)).toBe(3);
  });
});

describe("historyTotals et siyoumimOf", () => {
  it("compte les psaumes, les dafim et les prières", () => {
    const totals = historyTotals({
      // 18 septembre 2026 = 7 Tichri : les psaumes 39 à 43, cinq.
      "2026-09-18": {
        done: 4,
        total: 4,
        ok: true,
        keys: ["tehilim-jour", "103", "daf-yomi", "chaharit"],
      },
      "2026-09-17": { done: 1, total: 2, ok: false, keys: ["g-1"] },
    });
    expect(totals).toEqual({ days: 1, psalms: 6, dafim: 1, prayers: 1, actions: 2 });
  });

  it("repère le siyoum au dernier daf du traité", () => {
    // Le 7 mars 2020, Berakhot 64 ; le lendemain, Chabbat 2.
    const siyoumim = siyoumimOf({
      "2020-03-07": { done: 1, total: 1, ok: true, keys: ["daf-yomi"] },
      "2020-03-08": { done: 1, total: 1, ok: true, keys: ["daf-yomi"] },
    });
    expect(siyoumim).toEqual([{ tractate: "Berakhot", date: "2020-03-07" }]);
  });
});

describe("les défis de saison", () => {
  it("compte les Yamim Noraïm du 1er Eloul à Kippour", () => {
    // 19 septembre 2026 = 8 Tichri 5787 ; 1 Eloul 5786 = 14 août 2026.
    const challenge = activeChallenge(new Date(2026, 8, 19, 12));
    // Eloul 5786 compte 29 jours : 39 jours jusqu'à Kippour compris.
    expect(challenge).toMatchObject({ id: "yamim-noraim", day: 37, total: 39 });
    expect(challenge?.start).toBe("2026-08-14");
  });

  it("compte le 'Omer et 'Hanouka", () => {
    // 2 avril 2026 = 15 Nissan ; le 'Omer commence le lendemain.
    expect(activeChallenge(new Date(2026, 3, 3, 12))).toMatchObject({
      id: "omer",
      day: 1,
      total: 49,
    });
    // 'Hanouka 5787 : le 25 Kislev tombe le 5 décembre 2026.
    expect(activeChallenge(new Date(2026, 11, 6, 12))).toMatchObject({ id: "hanouka", day: 2 });
    expect(activeChallenge(new Date(2026, 6, 15, 12))).toBeNull();
  });

  it("compte les journées réussies dans la fenêtre", () => {
    const challenge = activeChallenge(new Date(2026, 8, 19, 12))!;
    const done = challengeProgress(
      challenge,
      {
        "2026-08-14": { done: 1, total: 1, ok: true, keys: [] },
        "2026-08-13": { done: 1, total: 1, ok: true, keys: [] }, // la veille : hors fenêtre
        "2026-09-18": { done: 1, total: 1, ok: true, keys: [] },
      },
      "2026-09-19",
      true,
    );
    expect(done).toBe(3);
  });
});

describe("restDays", () => {
  it("met en pause le Chabbat et les Yom Tov, pas 'Hol haMoed", () => {
    expect(isRestDayKey("2026-09-19")).toBe(true); // Chabbat
    expect(isRestDayKey("2026-09-21")).toBe(true); // Yom Kippour 5787
    expect(isRestDayKey("2026-09-27")).toBe(true); // Souccot II (diaspora)
    expect(isRestDayKey("2026-09-29")).toBe(false); // 'Hol haMoed
    expect(isRestDayKey("2026-09-18")).toBe(false);
    expect(pauseRule(false)("2026-09-19")).toBe(false);
  });
});
