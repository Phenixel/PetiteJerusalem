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
import { useParcours } from "./useParcours";

/**
 * What has already been said today, for the home deck, the Sidour page and
 * the end of a service's text alike: a service checked off steps aside for
 * what comes next.
 *
 * A service is done when the « trois tefilot » habit checks it off on the day
 * its window opens, or, without that habit, when it was marked (its card in
 * the deck or on the Sidour page swiped, the ring pulled at the end of its
 * text): the device remembers it with the occasions (the moon, the 'Omer),
 * outside the day's count (services/parcours/occasions.ts). With the habit,
 * marking a service checks the habit's task: the same gesture everywhere.
 */

/** The occasion cards marked done, shared by every screen that reads them. */
const occasionsDone = ref<string[]>(readOccasionsDone());

/** The key a service is remembered by: `tefila:2026-10-18-arvit`. */
export const officeKey = (window: Pick<TefilaWindow, "tefila" | "start">): string =>
  `tefila:${localDayKey(window.start)}-${window.tefila}`;

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
 * this service (Arvit after midnight included), otherwise today's.
 */
export function officeWindow(
  place: ZmanimPlace,
  tefila: TefilaKey,
  now: Date,
): TefilaWindow | null {
  const current = currentTefilaWindow(place, now);
  if (current?.tefila === tefila) return current;
  return tefilaWindowsOfDay(place, now).find((window) => window.tefila === tefila) ?? null;
}

export function useOfficesDone() {
  const store = useParcours();
  const { mark } = useOccasionsDone();

  /** The habit's task for this service, on the day its window opens. */
  function habitTask(window: TefilaWindow): { task: Task; day: string } | null {
    const day = localDayKey(window.start);
    const task = store.tasksOn(day).find((candidate) => candidate.step === window.tefila);
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

  /** What sidourMoment needs to know. */
  const said: SidourSaid = { office: isOfficeDone, moon: isMoonDone };

  return { isOfficeDone, markOffice, isMoonDone, markMoon, said };
}
