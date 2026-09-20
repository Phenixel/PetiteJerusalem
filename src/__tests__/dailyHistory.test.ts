import { describe, expect, it } from "vitest";
import {
  dayState,
  daySucceeded,
  HISTORY_DAYS,
  mergeHistory,
  monthGrid,
  pruneHistory,
  goalDates,
  mergeGoalProgress,
  setGoalDone,
  recentDays,
  type DailyHistory,
} from "../services/dailyHistory";
import { historyTotals, siyoumimOf } from "../services/dailyStats";
import { activeChallenge, challengeProgress } from "../services/dailyChallenges";
import { isRestDayKey, pauseRule } from "../services/restDays";
import { goalStatus, periodKeyOf } from "../services/goalPeriods";
import { frozenDaysBetween, rebuildStreak } from "../services/dailyStreak";
import { activeActionKeys, customWindow, goalPeriod, isDailyGoal } from "../services/dailyActions";

/**
 * L'historique des journées et ce qu'on en tire : la règle de la journée
 * réussie, la semaine, le mois, les compteurs, les siyoumim, les défis.
 */
const shabbatOnly = (key: string) => new Date(key + "T12:00:00").getDay() === 6;
const shabbat = { isPause: shabbatOnly };

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

  it("donne les sept derniers jours, aujourd'hui compris, avec leur état", () => {
    // Vendredi 18 septembre 2026 : du samedi 12 au vendredi 18.
    const week = recentDays("2026-09-18", history, shabbatOnly);
    expect(week.map((c) => c.key)).toEqual([
      "2026-09-12",
      "2026-09-13",
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
    ]);
    expect(week.map((c) => c.state)).toEqual([
      "pause", // le Chabbat d'avant
      "empty", // avant la première journée connue : rien n'a été manqué
      "done",
      "partial",
      "missed",
      "done",
      "empty", // aujourd'hui, rien encore
    ]);
    expect(week[6].today).toBe(true);
    expect(week.map((c) => c.weekday)).toEqual([6, 0, 1, 2, 3, 4, 5]);
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

describe("les objectifs par période", () => {
  const week = { id: "g-w", label: "Un chiour", createdAt: 1, period: "week" as const, times: 2 };
  const month = { id: "g-m", label: "Birkat halevana", createdAt: 2, period: "month" as const };
  const year = { id: "g-y", label: "Mezouzot", createdAt: 3, period: "year" as const };
  const program = {
    id: "g-p",
    label: "Pérek Chira",
    createdAt: 4,
    period: "custom" as const,
    days: 40,
    start: "2026-09-01",
  };
  const legacy = { id: "g-l", label: "Parents", createdAt: 5, perWeek: 3 };

  it("nomme la période : le dimanche, le mois et l'année hébraïques, le début du programme", () => {
    // Vendredi 18 septembre 2026 = 7 Tichri 5787.
    expect(periodKeyOf(week, "2026-09-18")).toBe("2026-09-13");
    expect(periodKeyOf(month, "2026-09-18")).toBe("5787-07");
    expect(periodKeyOf(year, "2026-09-18")).toBe("5787");
    // Le 11 septembre est encore en 5786, en Eloul (le 6e mois).
    expect(periodKeyOf(year, "2026-09-11")).toBe("5786");
    expect(periodKeyOf(month, "2026-09-11")).toBe("5786-06");
    expect(periodKeyOf(program, "2026-09-18")).toBe("2026-09-01");
  });

  it("lit la forme d'avant comme une fréquence par semaine", () => {
    expect(goalPeriod(legacy)).toBe("week");
    expect(isDailyGoal(legacy)).toBe(false);
    expect(goalPeriod({ id: "g", label: "x", createdAt: 0 })).toBe("day");
  });

  it("compte un programme sur N jours dans la journée tant qu'il court", () => {
    expect(customWindow(program)).toEqual({ start: "2026-09-01", last: "2026-10-10", days: 40 });
    expect(isDailyGoal(program, "2026-09-18")).toBe(true);
    expect(isDailyGoal(program, "2026-10-11")).toBe(false);
    expect(activeActionKeys([], [program, week], "2026-09-18")).toEqual(["g-p"]);
    expect(activeActionKeys([], [program, week], "2026-10-11")).toEqual([]);
  });

  it("coche et décoche un jour dans la période, une période à la fois", () => {
    let progress = setGoalDone({}, "g-w", "2026-09-13", "2026-09-14", true);
    progress = setGoalDone(progress, "g-w", "2026-09-13", "2026-09-16", true);
    expect(goalDates(progress, "g-w", "2026-09-13")).toEqual(["2026-09-14", "2026-09-16"]);
    progress = setGoalDone(progress, "g-w", "2026-09-13", "2026-09-14", false);
    expect(goalDates(progress, "g-w", "2026-09-13")).toEqual(["2026-09-16"]);
    // La semaine suivante repart de zéro.
    expect(goalDates(progress, "g-w", "2026-09-20")).toEqual([]);
    progress = setGoalDone(progress, "g-w", "2026-09-20", "2026-09-21", true);
    expect(goalDates(progress, "g-w", "2026-09-13")).toEqual([]);
  });

  it("dit où en est chaque objectif", () => {
    const progress = {
      "g-w": { period: "2026-09-13", dates: ["2026-09-14", "2026-09-18"] },
      "g-p": {
        period: "2026-09-01",
        dates: Array.from({ length: 17 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`),
      },
    };
    expect(goalStatus(week, progress, "2026-09-18")).toMatchObject({
      done: 2,
      target: 2,
      doneToday: true,
    });
    expect(goalStatus(month, progress, "2026-09-18")).toMatchObject({
      done: 0,
      target: 1,
      doneToday: false,
    });
    expect(goalStatus(program, progress, "2026-09-18")).toMatchObject({
      done: 17,
      target: 40,
      day: 18,
      finished: false,
    });
    expect(goalStatus(program, progress, "2026-10-11")).toMatchObject({ day: 0, finished: true });
  });

  it("fusionne les suivis : la période la plus récente, ou l'union des jours", () => {
    const merged = mergeGoalProgress(
      {
        "g-w": { period: "2026-09-13", dates: ["2026-09-14"] },
        "g-m": { period: "5787-06", dates: ["2026-09-01"] },
      },
      {
        "g-w": { period: "2026-09-13", dates: ["2026-09-16"] },
        "g-m": { period: "5787-07", dates: ["2026-09-15"] },
      },
    );
    expect(merged?.["g-w"].dates).toEqual(["2026-09-14", "2026-09-16"]);
    expect(merged?.["g-m"]).toEqual({ period: "5787-07", dates: ["2026-09-15"] });
  });
});

describe("la série relue depuis l'historique", () => {
  const ok = { done: 1, total: 1, ok: true, keys: [] };
  const ko = { done: 0, total: 1, ok: false, keys: [] };

  it("compte les journées réussies consécutives, pauses enjambées", () => {
    const history: DailyHistory = {
      "2026-09-14": ok,
      "2026-09-15": ok,
      "2026-09-16": ko,
      "2026-09-17": ok,
      "2026-09-18": ok, // vendredi
      "2026-09-20": ok, // dimanche, après le Chabbat
    };
    const streak = rebuildStreak(
      history,
      "2026-09-20",
      { current: 1, best: 9, lastDate: "2026-09-20", freezes: 1 },
      shabbat,
    );
    expect(streak).toEqual({ current: 3, best: 9, lastDate: "2026-09-20", freezes: 1 });
    // Le 16 corrigé : la série remonte jusqu'au 14.
    const fixed = rebuildStreak({ ...history, "2026-09-16": ok }, "2026-09-20", streak, shabbat);
    expect(fixed.current).toBe(6);
  });

  it("compte les jours gelés et vaut zéro sans journée réussie", () => {
    const history: DailyHistory = {
      "2026-09-16": ok,
      "2026-09-17": { ...ko, ok: true, frozen: true },
      "2026-09-18": ok,
    };
    expect(rebuildStreak(history, "2026-09-18", undefined).current).toBe(3);
    expect(
      rebuildStreak({ "2026-09-18": ko }, "2026-09-18", {
        current: 4,
        best: 4,
        lastDate: "2026-09-17",
      }),
    ).toMatchObject({ current: 0, best: 4 });
  });

  it("nomme les jours manqués que les jokers couvriront", () => {
    const streak = { current: 8, best: 8, lastDate: "2026-09-15", freezes: 1 };
    expect(frozenDaysBetween(streak, "2026-09-17")).toEqual(["2026-09-16"]);
    // Deux jours pour un joker : rien n'est couvert, la série tombera.
    expect(frozenDaysBetween(streak, "2026-09-18")).toEqual([]);
    // Le Chabbat entre les deux n'est pas un jour manqué.
    expect(frozenDaysBetween({ ...streak, lastDate: "2026-09-18" }, "2026-09-20", shabbat)).toEqual(
      [],
    );
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
