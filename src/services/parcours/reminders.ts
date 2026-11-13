import { localDayFrom } from "../dateService";
import { computeZmanim, type ZmanimPlace, type ZmanKey } from "../zmanimService";
import { habitAnchor } from "./create";
import { addDays } from "./days";
import {
  HABIT_ANCHORS,
  type DayKey,
  type HabitAnchor,
  type MomentId,
  type Objective,
} from "./model";
import type { ParcoursData } from "./model";
import { isSkipped, taskProgress, type Task } from "./schedule";

/**
 * The reminders of Mon parcours: "the hours of my day".
 *
 * Each point of the day thread (wake, Cha'harit, noon, Min'ha, Arvit,
 * bedtime) can ring at an hour of its own, plus one summary of the day
 * ("day"). The hour is either fixed (bedtime at midnight) or tied to a zman
 * with an offset (Min'ha twenty minutes before the chkia): it then moves with
 * the sun, day after day.
 *
 * A reminder only names what is left to do at that moment: the tasks whose
 * point it is, not done and not set aside. Nothing left, nothing rings.
 *
 * This module only computes (pure functions, see
 * src/__tests__/parcoursReminders.test.ts). The settings live on the device
 * (composables/useParcoursReminders.ts), the notifications are scheduled by
 * services/parcoursReminderService.ts. Overview: docs/parcours.md,
 * "Reminders".
 */

/** A point of the day that can ring: an anchor of the thread, or the day's summary. */
export type ReminderSlot = HabitAnchor | "day";

/** In the order of the day; the summary last. */
export const REMINDER_SLOTS: readonly ReminderSlot[] = [...HABIT_ANCHORS, "day"];

/** When a slot rings: at a fixed hour, or at a zman moved by `offset` minutes (negative: before). */
export type SlotTime =
  | { kind: "fixed"; hour: number; minute: number }
  | { kind: "zman"; zman: ZmanKey; offset: number };

export interface SlotSetting {
  on: boolean;
  time: SlotTime;
}

export type ReminderSettings = Record<ReminderSlot, SlotSetting>;

/**
 * The hour a slot is given before anyone touches it: what most people
 * would answer, so that turning a slot on is often enough.
 */
export const DEFAULT_SLOT_TIMES: Record<ReminderSlot, SlotTime> = {
  wake: { kind: "fixed", hour: 7, minute: 0 },
  chaharit: { kind: "zman", zman: "sunrise", offset: 0 },
  noon: { kind: "zman", zman: "chatzot", offset: 0 },
  minha: { kind: "zman", zman: "sunset", offset: -20 },
  arvit: { kind: "zman", zman: "tzeit", offset: 0 },
  bedtime: { kind: "fixed", hour: 23, minute: 0 },
  day: { kind: "fixed", hour: 21, minute: 0 },
};

/** The zmanim offered for each slot: those around its moment, in the order of the day. */
export const SLOT_ZMANIM: Record<ReminderSlot, readonly ZmanKey[]> = {
  wake: ["alotHaShachar", "misheyakir", "sunrise"],
  chaharit: ["misheyakir", "sunrise", "sofZmanShma", "sofZmanTfilla"],
  noon: ["chatzot", "minchaGedola"],
  minha: ["minchaGedola", "minchaKetana", "plagHaMincha", "sunset"],
  arvit: ["sunset", "tzeit", "chatzotNight"],
  bedtime: ["tzeit", "chatzotNight"],
  day: ["plagHaMincha", "sunset", "tzeit"],
};

/** The offsets offered, in minutes, before or after the zman. */
export const OFFSET_CHOICES: readonly number[] = [0, 5, 10, 15, 20, 30, 45, 60];

/** The furthest an offset can go, either way: three hours. */
const MAX_OFFSET = 180;

/**
 * Before this hour, a fixed time belongs to the night that ends: bedtime at
 * 00:30 rings for the day that was, after midnight (as in moments.ts).
 */
export const NIGHT_END_HOUR = 4;

export function defaultReminderSettings(): ReminderSettings {
  const settings = {} as ReminderSettings;
  for (const slot of REMINDER_SLOTS) {
    settings[slot] = { on: false, time: { ...DEFAULT_SLOT_TIMES[slot] } };
  }
  return settings;
}

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

function readTime(raw: unknown, slot: ReminderSlot): SlotTime {
  const value = raw as Partial<SlotTime> | null;
  if (value?.kind === "fixed" && isInt(value.hour, 0, 23) && isInt(value.minute, 0, 59)) {
    return { kind: "fixed", hour: value.hour, minute: value.minute };
  }
  if (
    value?.kind === "zman" &&
    typeof value.zman === "string" &&
    isInt(value.offset, -MAX_OFFSET, MAX_OFFSET)
  ) {
    return { kind: "zman", zman: value.zman, offset: value.offset };
  }
  return { ...DEFAULT_SLOT_TIMES[slot] };
}

/**
 * The settings as stored, made safe: an unknown slot is dropped, a missing
 * or broken one takes its default (off). A newer version may add slots or
 * kinds of time: they are read as the default here, never as an error.
 */
export function readReminderSettings(raw: unknown): ReminderSettings {
  const settings = defaultReminderSettings();
  if (!raw || typeof raw !== "object") return settings;
  const stored = raw as Record<string, Partial<SlotSetting> | undefined>;
  for (const slot of REMINDER_SLOTS) {
    const entry = stored[slot];
    if (!entry || typeof entry !== "object") continue;
    settings[slot] = { on: entry.on === true, time: readTime(entry.time, slot) };
  }
  return settings;
}

/** A moment without anchor rings with the office of its part of the day. */
const MOMENT_SLOT: Record<MomentId, HabitAnchor | null> = {
  morning: "chaharit",
  afternoon: "minha",
  evening: "arvit",
  bedtime: "bedtime",
  anytime: null,
};

/**
 * The point of the day a task rings at: its office for the three tefilot,
 * the anchor chosen on the thread, otherwise its moment. Null: during the
 * day, only the summary names it. A task of the week (the parasha, a weekly
 * program) weighs on no day: it has no point either.
 */
export function taskSlot(task: Task, objective: Objective): HabitAnchor | null {
  if (task.weekly) return null;
  if (task.step) return task.step;
  if (objective.kind === "habit") {
    return habitAnchor(objective) ?? MOMENT_SLOT[objective.moment];
  }
  if (objective.kind === "program" && objective.anchor) return objective.anchor;
  return MOMENT_SLOT[task.moment];
}

/** When a slot rings on a given day (device time), or null if its zman cannot be computed. */
export function slotTimeOn(time: SlotTime, place: ZmanimPlace, day: DayKey): Date | null {
  const date = localDayFrom(day);
  if (!date) return null;
  if (time.kind === "fixed") {
    // Past midnight, it is still the evening of `day`: the next calendar day.
    if (time.hour < NIGHT_END_HOUR) date.setDate(date.getDate() + 1);
    date.setHours(time.hour, time.minute, 0, 0);
    return date;
  }
  date.setHours(12);
  const zman = computeZmanim(place, date).find((entry) => entry.key === time.zman);
  return zman ? new Date(zman.date.getTime() + time.offset * 60_000) : null;
}

/** A reminder placed in time, with what it will name. */
export interface PlannedSlot {
  /** System id, stable for a day offset and a slot. */
  id: number;
  at: Date;
  slot: ReminderSlot;
  day: DayKey;
  /** What is left to do, in the order of the day's tasks. */
  tasks: Task[];
}

/** Ids reserved for these reminders: what is cancelled is ours. */
export const PARCOURS_ID_BASE = 42_000_000;
const ID_DAY_STRIDE = 10;
export const PARCOURS_ID_LAST = PARCOURS_ID_BASE + 1_000;

/** Days scheduled ahead, today included; refreshed each time the app comes back. */
export const REMINDER_HORIZON_DAYS = 3;

/**
 * What these reminders may keep pending. iOS keeps 64 per app, all
 * reminders together: this share and the zmanim's (MAX_PENDING in
 * zmanReminderService) stay under it with some room.
 */
export const PARCOURS_MAX_PENDING = 20;

/**
 * The notifications to schedule, in the order they will ring.
 *
 * `tasksOn` gives a day's tasks (useParcours().tasksOn); the log of `data`
 * says what is done. Days ahead have nothing done yet: their reminders name
 * everything, and are redone as soon as something is checked.
 */
export function planParcoursReminders(options: {
  settings: ReminderSettings;
  place: ZmanimPlace;
  data: ParcoursData;
  tasksOn: (day: DayKey) => Task[];
  today: DayKey;
  now?: Date;
  days?: number;
  budget?: number;
}): PlannedSlot[] {
  const { settings, place, data, tasksOn, today } = options;
  const now = options.now ?? new Date();
  const days = options.days ?? REMINDER_HORIZON_DAYS;
  const budget = options.budget ?? PARCOURS_MAX_PENDING;
  if (!REMINDER_SLOTS.some((slot) => settings[slot].on)) return [];

  const planned: PlannedSlot[] = [];
  for (let offset = 0; offset < days; offset++) {
    const day = addDays(today, offset);
    const log = data.days[day];
    const left = tasksOn(day).filter((task) => {
      if (isSkipped(log, task.id)) return false;
      return taskProgress(data, task, day) !== "done";
    });
    if (left.length === 0) continue;

    const slotOf = new Map<Task, HabitAnchor | null>();
    for (const task of left) {
      const objective = data.objectives[task.objectiveId];
      slotOf.set(task, objective ? taskSlot(task, objective) : null);
    }
    const times = new Map<ReminderSlot, Date | null>();
    for (const slot of REMINDER_SLOTS) {
      times.set(slot, settings[slot].on ? slotTimeOn(settings[slot].time, place, day) : null);
    }

    for (const [index, slot] of REMINDER_SLOTS.entries()) {
      const at = times.get(slot);
      if (!at || at.getTime() <= now.getTime()) continue;
      const tasks =
        slot === "day"
          ? // The summary names what is left, except what its own reminder,
            // later that day, will name.
            left.filter((task) => {
              const own = slotOf.get(task);
              const ownAt = own ? times.get(own) : null;
              return !ownAt || ownAt.getTime() <= at.getTime();
            })
          : left.filter((task) => slotOf.get(task) === slot);
      if (tasks.length === 0) continue;
      planned.push({ id: PARCOURS_ID_BASE + offset * ID_DAY_STRIDE + index, at, slot, day, tasks });
    }
  }
  return planned.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, budget);
}

/** How many of a day's tasks each slot gathers (the counts of the sheet). */
export function slotCounts(
  tasks: Task[],
  objectives: Record<string, Objective>,
): Record<ReminderSlot, number> {
  const counts = Object.fromEntries(REMINDER_SLOTS.map((slot) => [slot, 0])) as Record<
    ReminderSlot,
    number
  >;
  for (const task of tasks) {
    if (task.weekly) continue;
    counts.day++;
    const objective = objectives[task.objectiveId];
    const slot = objective ? taskSlot(task, objective) : null;
    if (slot) counts[slot]++;
  }
  return counts;
}
