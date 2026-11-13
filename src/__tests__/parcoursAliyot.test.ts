import { describe, expect, it } from "vitest";
import { setAliyaChecked, setTaskDone } from "../services/parcours/actions";
import {
  aliyotObjective,
  aliyotOfWeekday,
  aliyotWeekDone,
  checkedAliyot,
  dueAliyot,
  markedAliya,
} from "../services/parcours/aliyot";
import { addDays, weekdayOf } from "../services/parcours/days";
import { parseParcours } from "../services/parcours/merge";
import { emptyParcours } from "../services/parcours/model";
import type { Objective, ParcoursData } from "../services/parcours/model";
import { scheduleContext, taskProgress, tasksForDay } from "../services/parcours/schedule";

/**
 * Le chnei mikra, une montée par jour (services/parcours/aliyot.ts) : une
 * montée du dimanche au jeudi, la sixième et la septième le vendredi ; une
 * montée oubliée revient le lendemain avec la suivante, et ce qui reste le
 * vendredi se lit encore le Chabbat.
 */

const SUNDAY = "2026-10-11";
const chabbat = (day: string) => weekdayOf(day) === 6;

const parasha: Objective = {
  id: "par",
  kind: "cycle",
  cycle: "parasha",
  split: "aliyot",
  since: SUNDAY,
  moment: "morning",
  createdAt: 0,
  updatedAt: 0,
};

function data(): ParcoursData {
  const d = emptyParcours();
  d.objectives[parasha.id] = parasha;
  return d;
}

const due = (d: ParcoursData, day: string, count = 7) => {
  const task = tasksForDay(
    d,
    day,
    scheduleContext(d, chabbat, () => count),
  )[0];
  return task?.aliyot ? [task.aliyot.from, task.aliyot.to] : null;
};

describe("le chnei mikra, une montée par jour", () => {
  it("donne une montée par jour, la sixième et la septième le vendredi", () => {
    const days = [0, 1, 2, 3, 4, 5, 6].map((weekday) => aliyotOfWeekday(7, weekday));
    expect(days.map(({ from, to }) => [from, to])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 7],
      [7, 7],
    ]);
    // Une paracha double : ses quatorze montées sur les six jours.
    expect(aliyotOfWeekday(14, 0)).toEqual({ from: 0, to: 2 });
    expect(aliyotOfWeekday(14, 5)).toEqual({ from: 11, to: 14 });
  });

  it("garde une montée oubliée : le lendemain, la carte en montre deux", () => {
    let d = data();
    expect(due(d, SUNDAY)).toEqual([0, 1]);
    // Dimanche oublié : lundi, la 1re et la 2e.
    expect(due(d, addDays(SUNDAY, 1))).toEqual([0, 2]);
    // Lundi coché : mardi ne demande que la 3e.
    const monday = tasksForDay(d, addDays(SUNDAY, 1), scheduleContext(d, chabbat))[0];
    d = setTaskDone(d, monday, addDays(SUNDAY, 1), true, 1);
    expect(due(d, addDays(SUNDAY, 2))).toEqual([2, 3]);
  });

  it("le Chabbat ne demande que ce qui reste, et rien quand la semaine est lue", () => {
    let d = data();
    expect(due(d, addDays(SUNDAY, 6))).toEqual([0, 7]);
    const friday = tasksForDay(d, addDays(SUNDAY, 5), scheduleContext(d, chabbat))[0];
    d = setTaskDone(d, friday, addDays(SUNDAY, 5), true, 1);
    expect(due(d, addDays(SUNDAY, 6))).toBeNull();
    expect(aliyotWeekDone(d.days, "par", addDays(SUNDAY, 6))).toBe(true);
  });

  it("une semaine commencée en route part du jour où l'on a commencé", () => {
    const wednesday = addDays(SUNDAY, 3);
    expect(dueAliyot("par", wednesday, 7, {}, wednesday)).toEqual({ from: 3, to: 4, count: 7 });
  });
});

/**
 * Les montées cochées une à une (la liste de la page du chnei mikra) : elles
 * s'écrivent dans le journal (« aliya:3 »), font la carte du jour et la
 * suivante, et une carte cochée coche les siennes.
 */
describe("le chnei mikra, montée par montée dans la liste", () => {
  const CHABBAT = addDays(SUNDAY, 6);
  const ctx = (d: ParcoursData, count = 7) => scheduleContext(d, chabbat, () => count);
  const card = (d: ParcoursData, day: string) => tasksForDay(d, day, ctx(d))[0];
  const check = (d: ParcoursData, aliya: number, today: string, checked = true, count = 7) =>
    setAliyaChecked(d, CHABBAT, aliya, count, checked, today, 1);
  const listed = (d: ParcoursData, count = 7) =>
    [...checkedAliyot(d.days, CHABBAT, count, aliyotObjective(d))].sort((a, b) => a - b);

  it("une montée cochée s'écrit au jour où on la coche, sous un nom à part", () => {
    const d = check(data(), 0, SUNDAY);
    expect(d.days[SUNDAY].done).toEqual(["aliya:1"]);
    expect(markedAliya("aliya:1")).toBe(0);
    expect(markedAliya("par")).toBeNull();
    expect(listed(d)).toEqual([0]);
  });

  it("cocher la montée du jour fait la carte, et le lendemain passe à la suivante", () => {
    const d = check(data(), 0, SUNDAY);
    expect(taskProgress(d, card(d, SUNDAY), SUNDAY)).toBe("done");
    expect(due(d, addDays(SUNDAY, 1))).toEqual([1, 2]);
  });

  it("les montées se cochent dans l'ordre qu'on veut : la carte part de la première qui manque", () => {
    let d = check(data(), 3, SUNDAY);
    d = check(d, 4, SUNDAY);
    expect(taskProgress(d, card(d, SUNDAY), SUNDAY)).toBe("none");
    expect(due(d, addDays(SUNDAY, 1))).toEqual([0, 2]);
    // Tout coché d'avance : plus de carte jusqu'au Chabbat.
    for (const aliya of [0, 1, 2, 5, 6]) d = check(d, aliya, SUNDAY);
    expect(due(d, addDays(SUNDAY, 1))).toBeNull();
    expect(due(d, CHABBAT)).toBeNull();
  });

  it("une carte cochée coche ses montées dans la liste", () => {
    const monday = addDays(SUNDAY, 1);
    let d = data();
    d = setTaskDone(d, card(d, monday), monday, true, 1);
    expect(listed(d)).toEqual([0, 1]);
  });

  it("décocher une montée cochée par une carte défait la carte, et garde les autres", () => {
    const monday = addDays(SUNDAY, 1);
    let d = data();
    d = setTaskDone(d, card(d, monday), monday, true, 1);
    d = check(d, 0, addDays(SUNDAY, 2), false);
    expect(d.days[monday].done).toEqual(["aliya:2"]);
    expect(listed(d)).toEqual([1]);
    expect(due(d, addDays(SUNDAY, 2))).toEqual([0, 3]);
  });

  it("décocher la carte d'un jour décoche les montées qui la faisaient", () => {
    let d = check(data(), 0, SUNDAY);
    d = setTaskDone(d, card(d, SUNDAY), SUNDAY, false, 2);
    expect(listed(d)).toEqual([]);
    expect(taskProgress(d, card(d, SUNDAY), SUNDAY)).toBe("none");
  });

  it("une autre semaine s'écrit à son Chabbat, ou au dimanche de la paracha qui s'ouvre", () => {
    // Samedi soir, la paracha suivante : sa coche attend le dimanche.
    const before = check(data(), 0, addDays(SUNDAY, -1));
    expect(before.days[SUNDAY].done).toEqual(["aliya:1"]);
    // Feuilleté vers une paracha passée : son Chabbat.
    const after = check(data(), 0, addDays(SUNDAY, 9));
    expect(after.days[CHABBAT].done).toEqual(["aliya:1"]);
  });

  it("sans objectif, la liste se tient seule", () => {
    let d = emptyParcours();
    d = check(d, 2, SUNDAY);
    d = check(d, 2, SUNDAY, false);
    d = check(d, 5, SUNDAY);
    expect([...checkedAliyot(d.days, CHABBAT, 7, aliyotObjective(d))]).toEqual([5]);
  });

  it("la semaine est lue quand toutes ses montées le sont, quatorze pour une paracha double", () => {
    let d = data();
    for (let aliya = 0; aliya < 7; aliya++) d = check(d, aliya, SUNDAY, true, 14);
    expect(aliyotWeekDone(d.days, "par", CHABBAT, 7)).toBe(true);
    expect(aliyotWeekDone(d.days, "par", CHABBAT, 14)).toBe(false);
    for (let aliya = 7; aliya < 14; aliya++) d = check(d, aliya, SUNDAY, true, 14);
    expect(aliyotWeekDone(d.days, "par", CHABBAT, 14)).toBe(true);
  });

  it("une version d'avant garde les coches en cochant autre chose le même jour", () => {
    let d = check(data(), 0, SUNDAY);
    // Ce qu'une version d'avant relit, puis écrit : `done` reste tel quel.
    d = parseParcours(JSON.parse(JSON.stringify(d)));
    d = setTaskDone(d, { ...card(d, SUNDAY), id: "autre", aliyot: undefined }, SUNDAY, true, 3);
    expect(d.days[SUNDAY].done).toEqual(["aliya:1", "autre"]);
  });
});
