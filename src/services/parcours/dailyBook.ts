import textStudiesJson from "../../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../../models/models";
import { texteOf } from "../chiourTexte";
import { tehilimOfCycle } from "../dailyCycles";
import { localDayFrom } from "../dateService";
import { isTehilimCycle } from "./model";
import type { CycleObjective, DayKey, Objective, TehilimCycleId, TextObjective } from "./model";
import type { Task } from "./schedule";

/**
 * The daily book: everything read again every day, in a single volume, a
 * single card and a single page (`/bibliotheque/lecture-du-jour`).
 *
 * It holds the daily texts (a psalm, a page one loves) and the psalms already
 * divided up (the Tehilim of the day of the month, of the day of the week).
 * Their psalms change every day, so the cycles stay objectives of their own
 * (the installed versions, the widgets and the evening reminder read the
 * month's one as `daily-tehilim`), but they are read here among the texts:
 * one list, in the order of the book, each psalm marked on its own.
 *
 * A psalm both taken as a text and given by a cycle that day is read once:
 * marking it marks it for both. The last psalm of a cycle marked marks the
 * cycle's task; the psalms marked stay on the device for the day (what
 * Mon parcours keeps and syncs is the task, done or not).
 */

export type TehilimCycleObjective = CycleObjective & { cycle: TehilimCycleId };

export type DailyObjective = TextObjective | TehilimCycleObjective;

/** Is this objective read in the daily book? */
export const inDailyBook = (objective: Objective | undefined): objective is DailyObjective =>
  objective !== undefined &&
  (objective.kind === "text" || (objective.kind === "cycle" && isTehilimCycle(objective.cycle)));

/** One text of the day's reading, and the tasks it fulfills. */
export interface DailyReading {
  /** Stable over the day: the daily text's task, or the psalm. */
  key: string;
  entry: TextStudyJsonEntry;
  /** The daily text this reading is, if it was taken as one. */
  textTask: Task | null;
  /** The Tehilim cycles that give it today. */
  cycleTasks: Task[];
}

/** The order of the catalog: Tehilim 1, 4, 8, then Michna, Talmud, Tanakh. */
const catalogRank = new Map<number, number>(
  (textStudiesJson as TextStudiesJson).textStudies.map((entry, i) => [Number(entry.id), i]),
);

export const rankOf = (textId: number): number => catalogRank.get(textId) ?? Infinity;

/** The psalms a Tehilim cycle gives on a day (noon, so that no time zone shifts it). */
export function cycleEntries(cycle: TehilimCycleId, day: DayKey): TextStudyJsonEntry[] {
  const date = localDayFrom(day) ?? new Date();
  date.setHours(12);
  return tehilimOfCycle(cycle, date).entries;
}

/** The texts of an objective of the daily book, on a day. */
export function dailyEntries(objective: DailyObjective, day: DayKey): TextStudyJsonEntry[] {
  if (objective.kind === "cycle") return cycleEntries(objective.cycle, day);
  const entry = texteOf(objective.textId);
  return entry ? [entry] : [];
}

/**
 * The day's readings, from the day's tasks: each text once, in the order of
 * the catalog (which keeps a corpus together, for the Yehi ratson said once
 * before and after it).
 */
export function dailyReadings(
  tasks: readonly Task[],
  objectives: Record<string, Objective>,
  day: DayKey,
): DailyReading[] {
  const byEntry = new Map<string, DailyReading>();
  for (const task of tasks) {
    const objective = objectives[task.objectiveId];
    if (!inDailyBook(objective)) continue;
    for (const entry of dailyEntries(objective, day)) {
      const id = String(entry.id);
      const reading = byEntry.get(id) ?? { key: "", entry, textTask: null, cycleTasks: [] };
      if (objective.kind === "text") reading.textTask = task;
      else reading.cycleTasks.push(task);
      byEntry.set(id, reading);
    }
  }
  return [...byEntry.values()]
    .map((reading) => ({ ...reading, key: reading.textTask?.id ?? `psalm:${reading.entry.id}` }))
    .sort((a, b) => rankOf(Number(a.entry.id)) - rankOf(Number(b.entry.id)));
}

/**
 * The psalms of a cycle counted as read today (catalog ids): every one once
 * its task is done. Every one ticked while the task is not done means the
 * task was unmarked elsewhere (the home card): none then.
 */
export function psalmsRead(
  ticked: readonly number[],
  all: readonly number[],
  taskDone: boolean,
): number[] {
  if (taskDone) return [...all];
  const kept = ticked.filter((psalm) => all.includes(psalm));
  return all.length > 0 && all.every((psalm) => kept.includes(psalm)) ? [] : kept;
}

/** The psalms ticked after marking one read (or not), and whether the cycle's task is then done. */
export function markPsalm(
  ticked: readonly number[],
  psalm: number,
  all: readonly number[],
  taskDone: boolean,
  read: boolean,
): { read: number[]; taskDone: boolean } {
  const base = psalmsRead(ticked, all, taskDone);
  const next = read
    ? base.includes(psalm)
      ? base
      : [...base, psalm]
    : base.filter((one) => one !== psalm);
  return { read: next, taskDone: all.length > 0 && all.every((one) => next.includes(one)) };
}
