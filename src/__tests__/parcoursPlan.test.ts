import { describe, expect, it } from "vitest";
import { addDays, weekdayOf } from "../services/parcours/days";
import type { DayLog, ProgramObjective } from "../services/parcours/model";
import {
  applyCatchUp,
  endForRate,
  portionMinutes,
  programPlan,
  resumeProgram,
  studySlots,
} from "../services/parcours/plan";

/**
 * Le plan d'un programme (services/parcours/plan.ts) : la portion de chaque
 * jour, le retard, et les cinq façons de le rattraper. Les règles tenues ici
 * sont celles de la feuille « Rattraper » : le retard ne grossit jamais la
 * portion de lui-même, et chaque option le fait disparaître.
 */

/** Le samedi seul se repose : assez pour voir le rythme « sauf Chabbat ». */
const chabbat = (day: string) => weekdayOf(day) === 6;

// Dimanche 11 octobre 2026.
const START = "2026-10-11";

function program(overrides: Partial<ProgramObjective> = {}): ProgramObjective {
  return {
    id: "moed",
    kind: "program",
    corpus: "michna",
    parts: ["seder:moed"],
    texts: [],
    total: 10,
    rhythm: "daily",
    since: START,
    end: addDays(START, 9),
    base: { day: START, position: 0 },
    moment: "evening",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const read = (entries: Record<string, number>, id = "moed"): Record<string, DayLog> =>
  Object.fromEntries(
    Object.entries(entries).map(([day, units]) => [
      day,
      { done: [], units: { [id]: units }, at: 1 },
    ]),
  );

describe("le plan d'un programme", () => {
  it("répartit le texte sur les jours, une portion à la suite de l'autre", () => {
    const plan = programPlan(program(), {}, chabbat);
    expect(plan.slotCount).toBe(10);
    expect(plan.state(START)).toMatchObject({ quota: 1, from: 0, to: 1, behind: 0 });
    const days = read({ [START]: 1 });
    expect(programPlan(program(), days, chabbat).state(addDays(START, 1))).toMatchObject({
      from: 1,
      to: 2,
      behind: 0,
    });
  });

  it("ne donne rien un Chabbat au rythme « sauf Chabbat »", () => {
    const plan = programPlan(program({ rhythm: "weekdays", total: 12 }), {}, chabbat);
    // Du dimanche 11 au mardi 20 : neuf jours d'étude, le samedi 17 n'en est pas un.
    expect(plan.slotCount).toBe(9);
    expect(plan.state("2026-10-17").quota).toBe(0);
    expect(plan.state("2026-10-18").quota).toBeGreaterThan(0);
  });

  it("dit le retard sans grossir la portion", () => {
    const state = programPlan(program(), {}, chabbat).state(addDays(START, 3));
    expect(state.behind).toBe(3);
    expect(state.quota).toBe(1);
    expect(state.from).toBe(0);
  });

  it("continue au même pas une fois la date passée, plutôt que de s'arrêter", () => {
    const state = programPlan(program(), read({ [START]: 4 }), chabbat).state(addDays(START, 12));
    expect(state.quota).toBe(1);
    expect(state.behind).toBe(6);
  });

  it("au rythme de la semaine, compte la semaine entière", () => {
    const weekly = program({ rhythm: "weekly", total: 14, end: "2026-10-24" });
    const days = read({ "2026-10-12": 3, "2026-10-14": 4 });
    const plan = programPlan(weekly, days, chabbat);
    expect(plan.slotCount).toBe(2);
    const state = plan.state("2026-10-15");
    expect(state.slot).toBe("2026-10-17");
    expect(state).toMatchObject({ quota: 7, from: 0, done: 7, complete: true });
    expect(plan.state("2026-10-19")).toMatchObject({ from: 7, quota: 7 });
  });
});

describe("rattraper", () => {
  const today = addDays(START, 3); // mercredi, trois jours de retard

  it("« Déjà fait » avance la position du retard", () => {
    const caught = applyCatchUp(program(), "done", today, {}, chabbat, 5);
    expect(caught.credit).toBe(3);
    expect(caught.updatedAt).toBe(5);
    expect(programPlan(caught, {}, chabbat).state(today)).toMatchObject({ from: 3, behind: 0 });
  });

  it("« D'un coup » pose le retard sur le prochain dimanche", () => {
    const caught = applyCatchUp(
      program({ total: 20, end: addDays(START, 19) }),
      "oneDay",
      today,
      {},
      chabbat,
    );
    expect(caught.extra).toEqual({ "2026-10-18": 3 });
    const plan = programPlan(caught, {}, chabbat);
    expect(plan.state(today).behind).toBe(0);
    expect(plan.state("2026-10-18").quota).toBe(4);
  });

  it("« Cette semaine » répartit le retard sur les jours qui restent", () => {
    const caught = applyCatchUp(
      program({ total: 20, end: addDays(START, 19) }),
      "week",
      today,
      {},
      chabbat,
    );
    // Mercredi, jeudi, vendredi, samedi : quatre jours au rythme quotidien.
    expect(Object.values(caught.extra ?? {}).reduce((a, b) => a + b, 0)).toBe(3);
    expect(programPlan(caught, {}, chabbat).state(today).behind).toBe(0);
  });

  it("« D'ici la fin » repart d'aujourd'hui avec le même terme", () => {
    const caught = applyCatchUp(program(), "remaining", today, {}, chabbat);
    expect(caught.base).toEqual({ day: today, position: 0 });
    expect(caught.end).toBe(program().end);
    const plan = programPlan(caught, {}, chabbat);
    expect(plan.state(today).behind).toBe(0);
    expect(plan.slotCount).toBe(7);
  });

  it("« Repousser la fin » garde le pas et décale le terme d'autant", () => {
    const caught = applyCatchUp(program(), "pushEnd", today, {}, chabbat);
    expect(caught.end).toBe(addDays(program().end, 3));
    expect(programPlan(caught, {}, chabbat).state(today)).toMatchObject({ quota: 1, behind: 0 });
  });

  it("ne touche à rien sans retard", () => {
    const ahead = program();
    expect(applyCatchUp(ahead, "week", START, {}, chabbat)).toBe(ahead);
  });
});

describe("les créneaux et le temps", () => {
  it("compte les semaines par leur Chabbat", () => {
    expect(studySlots("weekly", "2026-10-11", "2026-10-31", chabbat)).toEqual([
      "2026-10-17",
      "2026-10-24",
      "2026-10-31",
    ]);
  });

  it("trouve la date de fin d'un pas donné", () => {
    expect(endForRate("daily", START, 10, 2, chabbat)).toBe(addDays(START, 4));
  });

  it("arrondit les minutes d'une portion", () => {
    expect(portionMinutes("mishna", 3)).toBe(12);
    expect(portionMinutes("psalm", 2)).toBe(6);
    expect(portionMinutes("amud", 2)).toBe(30);
  });
});

describe("la reprise après une pause", () => {
  it("recule la fin du temps de la pause, sans compter ce temps en retard", () => {
    // Deux jours lus, puis cinq jours de pause.
    const paused = program({ pausedFrom: addDays(START, 2) });
    const days = read({ [START]: 1, [addDays(START, 1)]: 1 });
    const today = addDays(START, 7);
    const resumed = resumeProgram(paused, today, days, chabbat, 5);
    expect(resumed.pausedFrom).toBeUndefined();
    expect(resumed.end).toBe(addDays(paused.end, 5));
    expect(resumed.base).toEqual({ day: today, position: 2 });
    expect(programPlan(resumed, days, chabbat).state(today)).toMatchObject({
      from: 2,
      to: 3,
      behind: 0,
    });
  });

  it("ne touche à rien d'autre qu'une pause posée aujourd'hui", () => {
    const paused = program({ pausedFrom: START });
    const resumed = resumeProgram(paused, START, {}, chabbat, 5);
    expect(resumed.pausedFrom).toBeUndefined();
    expect(resumed.end).toBe(paused.end);
    expect(resumed.base).toEqual(paused.base);
  });
});
