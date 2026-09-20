import { describe, expect, it } from "vitest";
import {
  bookCandidates,
  bookPlan,
  bookUnitKind,
  buildBookSections,
  portionLabel,
  portionPath,
  totalUnits,
  unitPlace,
} from "../services/bookGoals";
import { goalUnits, mergeGoalProgress, setBookDone } from "../services/dailyHistory";
import { goalStatus } from "../services/goalPeriods";
import { isDailyGoal, type DailyGoal } from "../services/dailyActions";

/**
 * Finir un livre sur une période : le découpage, la portion du jour, le
 * rattrapage réparti sur la suite, et le siyoum.
 */
const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

// Michna Berakhot (id 41 dans le catalogue) : neuf chapitres, ici raccourcis.
const mishna: DailyGoal = {
  id: "g-b",
  label: "Finir Berakhot",
  createdAt: 1,
  period: "book",
  textId: Number(bookCandidates().find((e) => String(e.type) === "Mishna")!.id),
  days: 10,
  start: "2026-09-01",
  sections: [
    { index: 1, units: 5 },
    { index: 2, units: 8 },
    { index: 3, units: 6 },
  ],
};

// Guemara : deux chapitres de côtés de daf.
const guemara: DailyGoal = {
  id: "g-g",
  label: "Finir Berakhot",
  createdAt: 1,
  period: "book",
  textId: Number(bookCandidates().find((e) => String(e.type) === "Talmud Bavli")!.id),
  days: 7,
  start: "2026-09-01",
  sections: [
    { index: 1, units: 4, firstDaf: "2a" },
    { index: 2, units: 3, firstDaf: "4a" },
  ],
};

describe("le découpage d'un livre", () => {
  it("lit les michnayot et les côtés de daf du texte chargé", () => {
    const sections = buildBookSections({
      title: "x",
      type: "Talmud Bavli",
      sections: [
        {
          index: 1,
          label: "",
          he: ["a", "b", "c"],
          dafBlocks: [
            { daf: "2a", lines: ["a"] },
            { daf: "2b", lines: ["b", "c"] },
          ],
        },
        { index: 2, label: "", he: ["d", "e"] },
        { index: 3, label: "", he: [] },
      ],
    });
    expect(sections).toEqual([
      { index: 1, units: 2, firstDaf: "2a" },
      { index: 2, units: 2 },
    ]);
    expect(totalUnits(mishna)).toBe(19);
    expect(bookUnitKind(mishna)).toBe("mishna");
    expect(bookUnitKind(guemara)).toBe("amud");
  });

  it("place chaque unité dans son chapitre, et nomme le daf", () => {
    expect(unitPlace(mishna, 0)).toEqual({ sectionIndex: 1, offset: 0, daf: undefined });
    expect(unitPlace(mishna, 5)).toEqual({ sectionIndex: 2, offset: 0, daf: undefined });
    expect(unitPlace(mishna, 18)).toEqual({ sectionIndex: 3, offset: 5, daf: undefined });
    expect(unitPlace(mishna, 19)).toBeNull();
    expect(unitPlace(guemara, 3)?.daf).toBe("3b");
    expect(unitPlace(guemara, 5)?.daf).toBe("4b");
  });

  it("dit la portion en clair, et où l'ouvrir", () => {
    expect(portionLabel(mishna, 0, 2, t)).toBe(
      'dailyReading.goals.book.mishnaRange:{"chapter":1,"from":1,"to":2}',
    );
    expect(portionLabel(mishna, 4, 7, t)).toBe(
      'dailyReading.goals.book.mishnaAcross:{"fromChapter":1,"from":5,"toChapter":2,"to":2}',
    );
    expect(portionLabel(mishna, 6, 7, t)).toBe(
      'dailyReading.goals.book.mishnaOne:{"chapter":2,"n":2}',
    );
    expect(portionLabel(guemara, 0, 2, t)).toBe(
      'dailyReading.goals.book.dafRange:{"from":"2a","to":"2b"}',
    );
    expect(portionPath(mishna, 6)).toMatch(/\/bibliotheque\/michna\/[a-z-]+\/2$/);
  });
});

describe("le plan du jour", () => {
  it("répartit ce qui reste sur les jours qui restent", () => {
    // Dix-neuf michnayot sur dix jours : deux par jour, au premier jour.
    expect(bookPlan(mishna, 0, "2026-09-01")).toMatchObject({
      day: 1,
      from: 0,
      to: 2,
      behind: 0,
      finished: false,
    });
    // Au sixième jour, rien de lu : le retard se répartit sur les cinq jours restants.
    expect(bookPlan(mishna, 0, "2026-09-06")).toMatchObject({ day: 6, from: 0, to: 4, behind: 10 });
    // En avance : la portion s'allège.
    expect(bookPlan(mishna, 16, "2026-09-06")).toMatchObject({ from: 16, to: 17, behind: 0 });
    // Fini.
    expect(bookPlan(mishna, 19, "2026-09-06")).toMatchObject({ finished: true, from: 19, to: 19 });
    // Après la période, tout ce qui reste est pour aujourd'hui.
    expect(bookPlan(mishna, 15, "2026-09-20")).toMatchObject({ day: 10, from: 15, to: 19 });
  });

  it("compte dans la journée tant que le livre court, ou reste en retard", () => {
    expect(isDailyGoal(mishna, "2026-08-31")).toBe(false);
    expect(isDailyGoal(mishna, "2026-09-05")).toBe(true);
    expect(isDailyGoal(mishna, "2026-09-20")).toBe(true);
  });

  it("avance de la portion cochée, recule si l'on décoche, et fête la fin", () => {
    let progress = setBookDone({}, "g-b", "2026-09-01", "2026-09-01", 2, true);
    expect(goalUnits(progress, "g-b", "2026-09-01")).toBe(2);
    progress = setBookDone(progress, "g-b", "2026-09-01", "2026-09-02", 2, true);
    expect(goalUnits(progress, "g-b", "2026-09-01")).toBe(4);
    progress = setBookDone(progress, "g-b", "2026-09-01", "2026-09-02", 2, false);
    expect(goalUnits(progress, "g-b", "2026-09-01")).toBe(2);
    expect(progress["g-b"].dates).toEqual(["2026-09-01"]);
    progress = setBookDone(progress, "g-b", "2026-09-01", "2026-09-09", 17, true);
    expect(goalStatus(mishna, progress, "2026-09-09")).toMatchObject({
      done: 19,
      target: 19,
      finished: true,
      doneToday: true,
    });
  });

  it("garde le livre le plus avancé à la fusion", () => {
    const merged = mergeGoalProgress(
      { "g-b": { period: "2026-09-01", dates: ["2026-09-01"], units: 2, dayUnits: 2 } },
      { "g-b": { period: "2026-09-01", dates: ["2026-09-02"], units: 6, dayUnits: 4 } },
    );
    expect(merged?.["g-b"]).toEqual({
      period: "2026-09-01",
      dates: ["2026-09-01", "2026-09-02"],
      units: 6,
      dayUnits: 4,
    });
  });
});
