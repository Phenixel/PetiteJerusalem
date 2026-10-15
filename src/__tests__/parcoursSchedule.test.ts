import { describe, expect, it } from "vitest";
import {
  setTaskDone,
  setTaskSkipped,
  removeObjective,
  setPaused,
} from "../services/parcours/actions";
import { addDays, weekdayOf } from "../services/parcours/days";
import { emptyParcours } from "../services/parcours/model";
import type { Objective, ParcoursData } from "../services/parcours/model";
import {
  daySummary,
  scheduleContext,
  streakOf,
  tasksForDay,
  wallWeeks,
} from "../services/parcours/schedule";

/**
 * Les journées de Mon parcours (services/parcours/schedule.ts) : ce qu'il y a
 * à faire un jour, l'état de ce jour sur le mur, et la série. Ce que ce test
 * tient, c'est la promesse « on n'est pas comme Jolingo » : Chabbat et les
 * fêtes ne coupent pas la série, « Pas aujourd'hui » ne compte pas contre
 * soi, et aujourd'hui ne la coupe pas tant qu'il n'est pas fini.
 */

const chabbat = (day: string) => weekdayOf(day) === 6;
const SUNDAY = "2026-10-11";

const base = { createdAt: 0, updatedAt: 0, since: SUNDAY, moment: "evening" as const };

function data(...objectives: Objective[]): ParcoursData {
  const d = emptyParcours();
  for (const o of objectives) d.objectives[o.id] = o;
  return d;
}

const chema: Objective = {
  ...base,
  id: "chema",
  kind: "habit",
  preset: "chema-al-hamita",
  name: "",
  days: [0, 1, 2, 3, 4, 5],
  moment: "bedtime",
};
const tefilot: Objective = {
  ...base,
  id: "tef",
  kind: "habit",
  preset: "tefilot",
  name: "",
  days: [0, 1, 2, 3, 4, 5, 6],
  createdAt: 1,
};
const parasha: Objective = { ...base, id: "par", kind: "cycle", cycle: "parasha", createdAt: 2 };

const ctx = (d: ParcoursData) => scheduleContext(d, chabbat);

describe("les tâches d'un jour", () => {
  it("suit les jours d'une habitude, et donne un office par moment aux trois tefilot", () => {
    const d = data(chema, tefilot);
    const sunday = tasksForDay(d, SUNDAY, ctx(d)).map((t) => [t.id, t.moment]);
    expect(sunday).toEqual([
      ["chema", "bedtime"],
      ["tef:chaharit", "morning"],
      ["tef:minha", "afternoon"],
      ["tef:arvit", "evening"],
    ]);
    // Chabbat : pas de Chema al hamita réglé ce jour-là, les tefilot oui.
    expect(tasksForDay(d, "2026-10-17", ctx(d)).map((t) => t.id)).not.toContain("chema");
  });

  it("ne donne plus rien après une pause ou un retrait, sans effacer le passé", () => {
    let d = data(chema);
    d = setPaused(d, "chema", "2026-10-14", 1);
    expect(tasksForDay(d, "2026-10-13", ctx(d))).toHaveLength(1);
    expect(tasksForDay(d, "2026-10-14", ctx(d))).toHaveLength(0);
    d = removeObjective(data(chema), "chema", new Date(2026, 9, 15, 12).getTime());
    expect(tasksForDay(d, "2026-10-14", ctx(d))).toHaveLength(1);
    expect(tasksForDay(d, "2026-10-15", ctx(d))).toHaveLength(0);
  });

  it("garde une tâche de la semaine faite pour toute la semaine", () => {
    let d = data(parasha);
    const [task] = tasksForDay(d, "2026-10-13", ctx(d));
    expect(task.weekly).toBe(true);
    d = setTaskDone(d, task, "2026-10-13", true, 1);
    const later = daySummary(d, "2026-10-15", "2026-10-16", ctx(d));
    expect(later.planned).toBe(0);
    expect(daySummary(d, "2026-10-13", "2026-10-16", ctx(d)).status).toBe("full");
  });
});

describe("l'état des journées", () => {
  const today = "2026-10-14";

  it("dessine chaque état du mur", () => {
    let d = data(chema);
    const task = (day: string) => tasksForDay(d, day, ctx(d))[0];
    d = setTaskDone(d, task(SUNDAY), SUNDAY, true, 1);
    const summary = (day: string) => daySummary(d, day, today, ctx(d)).status;
    expect(summary(addDays(SUNDAY, -1))).toBe("before");
    expect(summary(SUNDAY)).toBe("full");
    expect(summary("2026-10-12")).toBe("none");
    expect(summary(today)).toBe("today");
    expect(summary("2026-10-15")).toBe("future");
  });

  it("compte une habitude à moitié faite comme une journée en partie", () => {
    let d = data(tefilot);
    const [chaharit] = tasksForDay(d, "2026-10-12", ctx(d));
    d = setTaskDone(d, chaharit, "2026-10-12", true, 1);
    expect(daySummary(d, "2026-10-12", "2026-10-14", ctx(d))).toMatchObject({
      status: "partial",
      planned: 3,
      done: 1,
    });
  });

  it("ne compte pas « Pas aujourd'hui » contre soi", () => {
    let d = data(chema);
    d = setTaskSkipped(d, "chema", "2026-10-12", true, 1);
    expect(daySummary(d, "2026-10-12", "2026-10-14", ctx(d)).status).toBe("rest");
  });

  it("range le mur par semaines, du dimanche au Chabbat", () => {
    const d = data(chema);
    const weeks = wallWeeks(d, "2026-10-13", "2026-10-21", "2026-10-21", ctx(d));
    expect(weeks.map((w) => w.week)).toEqual(["2026-10-17", "2026-10-24"]);
    expect(weeks[0].days).toHaveLength(7);
    expect(weeks[0].days[6].status).toBe("rest");
  });
});

describe("la série", () => {
  it("passe Chabbat et les jours sans rien, se coupe au jour oublié, garde son record", () => {
    const s = (status: string) => ({ day: "", status, planned: 1, done: 0 }) as never;
    expect(streakOf([s("full"), s("partial"), s("rest"), s("full"), s("today")])).toEqual({
      current: 3,
      best: 3,
      held: 3,
    });
    expect(streakOf([s("full"), s("full"), s("none"), s("full")])).toEqual({
      current: 1,
      best: 2,
      held: 3,
    });
  });
});
