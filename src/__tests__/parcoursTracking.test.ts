import { beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.fn();
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture } }));

const { setTaskDone } = await import("../services/parcours/actions");
const { weekdayOf } = await import("../services/parcours/days");
const { emptyParcours } = await import("../services/parcours/model");
const { scheduleContext, tasksForDay } = await import("../services/parcours/schedule");
const { trackDayViewed, trackTaskMarked } = await import("../services/parcours/tracking");
import type { Objective, ParcoursData } from "../services/parcours/model";

/**
 * Le suivi de Mon parcours (services/parcours/tracking.ts). La lecture du jour
 * d'avant y vit désormais : ses événements continuent de partir, avec leurs
 * propriétés d'alors (docs/tracking-plan.md, « Ce que deviennent ceux de la
 * lecture du jour »), pour ne pas casser les analyses déjà construites.
 */

const TUESDAY = "2026-10-13";
const base = { createdAt: 0, updatedAt: 0, since: TUESDAY, moment: "morning" as const };
const text: Objective = {
  ...base,
  id: "daily-text-103",
  kind: "text",
  textId: 103,
  days: [0, 1, 2, 3, 4, 5, 6],
};
const tsedaka: Objective = {
  ...base,
  id: "tsedaka",
  kind: "habit",
  preset: "tsedaka",
  name: "",
  days: [0, 1, 2, 3, 4, 5],
  createdAt: 1,
};

function data(...objectives: Objective[]): ParcoursData {
  const d = emptyParcours();
  for (const o of objectives) d.objectives[o.id] = o;
  return d;
}

const ctx = (d: ParcoursData) => scheduleContext(d, (day) => weekdayOf(day) === 6);

beforeEach(() => capture.mockClear());

describe("une tâche cochée", () => {
  it("part en parcours_task_marked, d'où qu'on la coche", () => {
    const d = data(tsedaka);
    const [task] = tasksForDay(d, TUESDAY, ctx(d));
    trackTaskMarked(
      setTaskDone(d, task, TUESDAY, true),
      ctx(d),
      task,
      TUESDAY,
      TUESDAY,
      true,
      "journee_row",
    );
    expect(capture).toHaveBeenCalledWith("parcours_task_marked", {
      done: true,
      kind: "habit",
      source: "journee_row",
      days_ago: 0,
    });
    // Une habitude n'était pas de la lecture du jour.
    expect(capture).not.toHaveBeenCalledWith("daily_reading_marked_read", expect.anything());
  });

  it("un texte du jour envoie aussi daily_reading_marked_read, compté sur la journée", () => {
    const d = data(text, tsedaka);
    const task = tasksForDay(d, TUESDAY, ctx(d)).find((t) => t.objectiveId === text.id)!;
    const after = setTaskDone(d, task, TUESDAY, true);
    trackTaskMarked(after, ctx(after), task, TUESDAY, TUESDAY, true, "journee_row");
    expect(capture).toHaveBeenCalledWith("daily_reading_marked_read", {
      marked: true,
      scope: "text",
      done_count: 1,
      total_count: 2,
      all_done: false,
    });
  });

  it("après coup, seul parcours_task_marked part : la lecture du jour ne cochait qu'aujourd'hui", () => {
    const d = data(text);
    const task = tasksForDay(d, TUESDAY, ctx(d))[0];
    trackTaskMarked(
      setTaskDone(d, task, TUESDAY, true),
      ctx(d),
      task,
      TUESDAY,
      "2026-10-15",
      true,
      "parcours_wall",
    );
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(
      "parcours_task_marked",
      expect.objectContaining({ days_ago: 2 }),
    );
  });
});

describe("l'arrivée sur la journée", () => {
  it("part en daily_reading_viewed, avec l'état de la journée", () => {
    trackDayViewed(emptyParcours(), ctx(emptyParcours()), TUESDAY);
    expect(capture).toHaveBeenLastCalledWith("daily_reading_viewed", {
      state: "empty",
      total_count: 0,
      done_count: 0,
    });

    const d = data(text);
    const task = tasksForDay(d, TUESDAY, ctx(d))[0];
    const done = setTaskDone(d, task, TUESDAY, true);
    trackDayViewed(done, ctx(done), TUESDAY);
    expect(capture).toHaveBeenLastCalledWith("daily_reading_viewed", {
      state: "all_done",
      total_count: 1,
      done_count: 1,
    });
  });
});
