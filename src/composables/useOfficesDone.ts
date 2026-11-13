import { ref } from "vue";
import type { HDate } from "@hebcal/core";
import { analyticsService } from "../services/analyticsService";
import { localDayKey } from "../services/dateService";
import { readOccasionsDone, writeOccasionDone } from "../services/parcours/occasions";
import { taskProgress, type Task } from "../services/parcours/schedule";
import type { SidourSaid } from "../services/sidourMoment";
import {
  currentTefilaWindow,
  tefilaWindowsOfDay,
  type TefilaKey,
  type TefilaWindow,
} from "../services/sidourService";
import type { ZmanimPlace } from "../services/zmanimService";
import { liturgicalDay } from "../services/nightBounds";
import { useParcours } from "./useParcours";

/**
 * What has already been said today, for the home deck, the Sidour page and
 * the end of a service's text alike: a service checked off steps aside for
 * what comes next.
 *
 * A service is done when the « trois tefilot » habit checks it off (the window
 * under way on today's task, as in the home deck; past midnight, until
 * dawn, today is still the evening's day, so Arvit counts for it; another
 * on the day it opens; held by officesDone.test.ts), or,
 * without that habit, when it was marked (its card in
 * the deck or on the Sidour page swiped, the ring pulled at the end of its
 * text): the device remembers it with the occasions (the moon, the 'Omer),
 * outside the day's count (services/parcours/occasions.ts). With the habit,
 * marking a service checks the habit's task: the same gesture everywhere.
 * The bedtime Chema goes the same way, with the « Chéma du coucher » habit.
 */

/** The occasion cards marked done, shared by every screen that reads them. */
const occasionsDone = ref<string[]>(readOccasionsDone());

/** The key a service is remembered by: `tefila:2026-10-18-arvit`. */
export const officeKey = (window: Pick<TefilaWindow, "tefila" | "start">): string =>
  `tefila:${localDayKey(window.start)}-${window.tefila}`;

/** The key of an evening's havdala, by its civil day: `havdala:2026-10-24`. */
export const havdalaKey = (evening: Date): string => `havdala:${localDayKey(evening)}`;

/** The key of a night's bedtime Chema, by its evening's civil day: `chema:2026-10-18`. */
export const chemaKey = (evening: Date): string => `chema:${localDayKey(evening)}`;

/** The key of a month's moon, by its last day: `halevana:5787-8`. */
export const halevanaKey = (until: HDate): string =>
  `halevana:${until.getFullYear()}-${until.getMonth()}`;

export function useOccasionsDone() {
  function mark(key: string, done: boolean): void {
    occasionsDone.value = writeOccasionDone(occasionsDone.value, key, done);
  }
  return { keys: occasionsDone, mark };
}

/**
 * The window a service's text is said in now: the one under way if it is
 * this service (Arvit after midnight included), otherwise that of the day
 * under way (before dawn, the evening's).
 */
export function officeWindow(
  place: ZmanimPlace,
  tefila: TefilaKey,
  now: Date,
): TefilaWindow | null {
  const current = currentTefilaWindow(place, now);
  if (current?.tefila === tefila) return current;
  return (
    tefilaWindowsOfDay(place, liturgicalDay(place, now)).find(
      (window) => window.tefila === tefila,
    ) ?? null
  );
}

export function useOfficesDone() {
  const store = useParcours();
  const { mark } = useOccasionsDone();

  // A day's tasks, computed once per day for the data at hand: sidourMoment
  // asks for several windows on every tick of the clock.
  let cache: { data: unknown; context: unknown; days: Map<string, Task[]> } | null = null;
  function tasksOn(day: string): Task[] {
    const data = store.data.value;
    const context = store.context.value;
    if (!cache || cache.data !== data || cache.context !== context) {
      cache = { data, context, days: new Map() };
    }
    let tasks = cache.days.get(day);
    if (!tasks) {
      tasks = store.tasksOn(day);
      cache.days.set(day, tasks);
    }
    return tasks;
  }

  /**
   * The habit's task for this service: the window under way is today's, as
   * in the home deck (Arvit past midnight: the evening's day, which today
   * still is until dawn); another, the day its window opens.
   */
  function habitTask(window: TefilaWindow): { task: Task; day: string } | null {
    const now = Date.now();
    const current = window.start.getTime() <= now && now < window.end.getTime();
    const day = current ? store.today.value : localDayKey(window.start);
    const task = tasksOn(day).find((candidate) => candidate.step === window.tefila);
    return task ? { task, day } : null;
  }

  function isOfficeDone(window: TefilaWindow): boolean {
    if (occasionsDone.value.includes(officeKey(window))) return true;
    const habit = habitTask(window);
    return habit !== null && taskProgress(store.data.value, habit.task, habit.day) === "done";
  }

  /** Marks a service said, or not: the habit's task if it has one, the device otherwise. */
  function markOffice(window: TefilaWindow, done: boolean, source: string): void {
    const habit = habitTask(window);
    if (habit) {
      store.setDone(habit.task, habit.day, done, source);
      if (!done) mark(officeKey(window), false);
      return;
    }
    mark(officeKey(window), done);
    analyticsService.capture("parcours_occasion_marked", { occasion: "tefila", done, source });
  }

  const isMoonDone = (until: HDate): boolean => occasionsDone.value.includes(halevanaKey(until));

  function markMoon(until: HDate, done: boolean, source: string): void {
    mark(halevanaKey(until), done);
    analyticsService.capture("parcours_occasion_marked", { occasion: "halevana", done, source });
  }

  const isHavdalaDone = (evening: Date): boolean =>
    occasionsDone.value.includes(havdalaKey(evening));

  function markHavdala(evening: Date, done: boolean, source: string): void {
    mark(havdalaKey(evening), done);
    analyticsService.capture("parcours_occasion_marked", { occasion: "havdala", done, source });
  }

  /**
   * The « Chéma du coucher » habit's task for a night: the one of its
   * evening's day, past midnight too, as the home deck counts it until
   * dawn (marked at 2:00, it is not the next evening's Chema).
   */
  function chemaTask(evening: Date): { task: Task; day: string } | null {
    const day = localDayKey(evening);
    const objectives = store.data.value.objectives;
    const task = tasksOn(day).find((candidate) => {
      const objective = objectives[candidate.objectiveId];
      return objective?.kind === "habit" && objective.preset === "chema-al-hamita";
    });
    return task ? { task, day } : null;
  }

  function isChemaDone(evening: Date): boolean {
    if (occasionsDone.value.includes(chemaKey(evening))) return true;
    const habit = chemaTask(evening);
    return habit !== null && taskProgress(store.data.value, habit.task, habit.day) === "done";
  }

  /** Marks the bedtime Chema said, or not: the habit's task if it has one, the device otherwise. */
  function markChema(evening: Date, done: boolean, source: string): void {
    const habit = chemaTask(evening);
    if (habit) {
      store.setDone(habit.task, habit.day, done, source);
      if (!done) mark(chemaKey(evening), false);
      return;
    }
    mark(chemaKey(evening), done);
    analyticsService.capture("parcours_occasion_marked", { occasion: "chema", done, source });
  }

  /** What sidourMoment needs to know. */
  const said: SidourSaid = {
    office: isOfficeDone,
    moon: isMoonDone,
    havdala: isHavdalaDone,
    chema: isChemaDone,
  };

  return {
    isOfficeDone,
    markOffice,
    isMoonDone,
    markMoon,
    isHavdalaDone,
    markHavdala,
    isChemaDone,
    markChema,
    said,
  };
}
