import { describe, expect, it } from "vitest";
import { setTaskDone, setTaskSkipped } from "../services/parcours/actions";
import { addDays, weekdayOf } from "../services/parcours/days";
import { emptyParcours } from "../services/parcours/model";
import type { Objective, ParcoursData } from "../services/parcours/model";
import {
  DEFAULT_SLOT_TIMES,
  PARCOURS_MAX_PENDING,
  defaultReminderSettings,
  planParcoursReminders,
  readReminderSettings,
  slotCounts,
  slotTimeOn,
  taskSlot,
  type ReminderSettings,
} from "../services/parcours/reminders";
import { scheduleContext, tasksForDay } from "../services/parcours/schedule";
import { MAX_PENDING } from "../services/zmanReminderService";
import {
  DEFAULT_PLACE,
  SUNSET_REMINDER_OFFSET_MINUTES,
  computeZmanim,
} from "../services/zmanimService";

/**
 * The reminders of Mon parcours (services/parcours/reminders.ts): each point
 * of the day rings at its hour, fixed or tied to a zman, and only names what
 * is left to do then. What this test holds: a reminder never rings for
 * nothing (all done, set aside, or no objective at that point), the hour
 * tied to the calendar moves with it, and bedtime at midnight still rings
 * for the day that ends.
 */

const chabbat = (day: string) => weekdayOf(day) === 6;
const SUNDAY = "2026-10-11";
/** Sunday morning, before anything rings. */
const MORNING = new Date(2026, 9, 11, 5, 0);

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
const tsedaka: Objective = {
  ...base,
  id: "tsd",
  kind: "habit",
  preset: "tsedaka",
  name: "",
  days: [0, 1, 2, 3, 4, 5],
  moment: "anytime",
  createdAt: 2,
};
const parasha: Objective = { ...base, id: "par", kind: "cycle", cycle: "parasha", createdAt: 3 };

function settings(on: Partial<ReminderSettings>): ReminderSettings {
  return { ...defaultReminderSettings(), ...on };
}

function plan(d: ParcoursData, s: ReminderSettings, now = MORNING, days = 1) {
  const ctx = scheduleContext(d, chabbat);
  return planParcoursReminders({
    settings: s,
    place: DEFAULT_PLACE,
    data: d,
    tasksOn: (day) => tasksForDay(d, day, ctx),
    today: SUNDAY,
    now,
    days,
  });
}

const minhaAtSunset = {
  on: true,
  time: { kind: "zman" as const, zman: "sunset" as const, offset: -20 },
};
const bedtimeAt = (hour: number, minute = 0) => ({
  on: true,
  time: { kind: "fixed" as const, hour, minute },
});

describe("the point of the day of a task", () => {
  const d = data(chema, tefilot, tsedaka, parasha);
  const tasks = tasksForDay(d, SUNDAY, scheduleContext(d, chabbat));
  const slotOf = (id: string) => {
    const task = tasks.find((entry) => entry.id === id)!;
    return taskSlot(task, d.objectives[task.objectiveId]);
  };

  it("gives each office of the three tefilot its own point", () => {
    expect(slotOf("tef:chaharit")).toBe("chaharit");
    expect(slotOf("tef:minha")).toBe("minha");
    expect(slotOf("tef:arvit")).toBe("arvit");
  });

  it("puts Chema al hamita at bedtime, the tsedaka in the day, the parasha nowhere", () => {
    expect(slotOf("chema")).toBe("bedtime");
    expect(slotOf("tsd")).toBeNull();
    expect(slotOf("par")).toBeNull();
  });

  it("counts for the sheet what each point gathers today", () => {
    const counts = slotCounts(tasks, d.objectives);
    expect(counts).toMatchObject({ chaharit: 1, minha: 1, arvit: 1, bedtime: 1, wake: 0 });
    // The day's summary: all the day's tasks, the week's parasha aside.
    expect(counts.day).toBe(5);
  });
});

describe("the hour of a point of the day", () => {
  it("follows the zman, moved by its offset, day after day", () => {
    const time = { kind: "zman" as const, zman: "sunset" as const, offset: -20 };
    for (const day of [SUNDAY, addDays(SUNDAY, 30)]) {
      const date = new Date(`${day}T12:00:00`);
      const sunset = computeZmanim(DEFAULT_PLACE, date).find((z) => z.key === "sunset")!;
      expect(slotTimeOn(time, DEFAULT_PLACE, day)!.getTime()).toBe(
        sunset.date.getTime() - 20 * 60_000,
      );
    }
  });

  it("puts a fixed hour past midnight on the night of the day that ends", () => {
    const at = slotTimeOn({ kind: "fixed", hour: 0, minute: 30 }, DEFAULT_PLACE, SUNDAY)!;
    expect(at.getDate()).toBe(12);
    expect(at.getHours()).toBe(0);
    expect(at.getMinutes()).toBe(30);
  });

  it("gives Min'ha by default the old call before the chkia", () => {
    expect(DEFAULT_SLOT_TIMES.minha).toEqual({
      kind: "zman",
      zman: "sunset",
      offset: -SUNSET_REMINDER_OFFSET_MINUTES,
    });
  });
});

describe("what rings", () => {
  it("names at each point what is left to do there", () => {
    const d = data(chema, tefilot);
    const planned = plan(d, settings({ minha: minhaAtSunset, bedtime: bedtimeAt(23) }));
    expect(planned.map((p) => [p.slot, p.tasks.map((t) => t.id)])).toEqual([
      ["minha", ["tef:minha"]],
      ["bedtime", ["chema"]],
    ]);
  });

  it("rings for nothing done, set aside, or without objective", () => {
    let d = data(chema, tefilot);
    const tasks = tasksForDay(d, SUNDAY, scheduleContext(d, chabbat));
    d = setTaskDone(d, tasks.find((t) => t.id === "tef:minha")!, SUNDAY, true);
    d = setTaskSkipped(d, "chema", SUNDAY, true);
    const planned = plan(
      d,
      settings({ minha: minhaAtSunset, bedtime: bedtimeAt(23), wake: bedtimeAt(7) }),
    );
    expect(planned).toEqual([]);
  });

  it("lets the summary name what no later reminder of the day will name", () => {
    const d = data(chema, tefilot, tsedaka);
    const planned = plan(
      d,
      settings({ day: bedtimeAt(21), bedtime: bedtimeAt(23), minha: minhaAtSunset }),
    );
    const summary = planned.find((p) => p.slot === "day")!;
    // Chema has its own reminder at 23:00; Min'ha's has already rung by 21:00.
    expect(summary.tasks.map((t) => t.id)).toEqual([
      "tef:chaharit",
      "tef:minha",
      "tef:arvit",
      "tsd",
    ]);
  });

  it("leaves out what has already rung today", () => {
    const evening = new Date(2026, 9, 11, 22, 0);
    const d = data(chema, tefilot);
    const planned = plan(d, settings({ minha: minhaAtSunset, bedtime: bedtimeAt(23) }), evening);
    expect(planned.map((p) => p.slot)).toEqual(["bedtime"]);
  });

  it("plans the days ahead with stable, distinct ids, within its share", () => {
    const d = data(chema, tefilot, tsedaka);
    const all = Object.fromEntries(
      Object.entries(defaultReminderSettings()).map(([slot, s]) => [slot, { ...s, on: true }]),
    ) as ReminderSettings;
    const first = plan(d, all, MORNING, 3);
    const ids = first.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(plan(d, all, MORNING, 3).map((p) => p.id)).toEqual(ids);
    expect(first.length).toBeLessThanOrEqual(PARCOURS_MAX_PENDING);
    // With the zmanim reminders, under the 64 iOS keeps.
    expect(PARCOURS_MAX_PENDING + MAX_PENDING).toBeLessThanOrEqual(56);
  });
});

describe("the stored settings", () => {
  it("reads what a newer version wrote without losing the rest", () => {
    const read = readReminderSettings({
      minha: { on: true, time: { kind: "zman", zman: "sunset", offset: -20 } },
      bedtime: { on: true, time: { kind: "moon", phase: 3 } },
      future: { on: true },
    });
    expect(read.minha).toEqual(minhaAtSunset);
    expect(read.bedtime).toEqual({ on: true, time: DEFAULT_SLOT_TIMES.bedtime });
    expect(read).not.toHaveProperty("future");
    expect(read.wake.on).toBe(false);
  });
});
