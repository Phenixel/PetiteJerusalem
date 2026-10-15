import { describe, expect, it } from "vitest";
import { setTaskDone } from "../services/parcours/actions";
import { aliyotOfWeekday, aliyotWeekDone, dueAliyot } from "../services/parcours/aliyot";
import { addDays, weekdayOf } from "../services/parcours/days";
import { emptyParcours } from "../services/parcours/model";
import type { Objective, ParcoursData } from "../services/parcours/model";
import { scheduleContext, tasksForDay } from "../services/parcours/schedule";

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
  const task = tasksForDay(d, day, scheduleContext(d, chabbat, () => count))[0];
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
