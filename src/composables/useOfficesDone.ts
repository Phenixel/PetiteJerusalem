import { ref } from "vue";
import { localDayKey } from "../services/dateService";
import { readOccasionsDone, writeOccasionDone } from "../services/parcours/occasions";
import { taskProgress } from "../services/parcours/schedule";
import type { TefilaWindow } from "../services/sidourService";
import { useParcours } from "./useParcours";

/**
 * What has already been said today, for the home deck and the Sidour page
 * alike: a service checked off steps aside for what comes next.
 *
 * A service is done when the « trois tefilot » habit checks it off on the day
 * its window opens, or, without that habit, when its card in the deck was
 * swiped: the device remembers it with the occasions (the moon, the 'Omer),
 * outside the day's count (services/parcours/occasions.ts).
 */

/** The occasion cards marked done, shared by every screen that reads them. */
const occasionsDone = ref<string[]>(readOccasionsDone());

/** The key a service's card is remembered by: `tefila:2026-10-18-arvit`. */
export const officeKey = (window: Pick<TefilaWindow, "tefila" | "start">): string =>
  `tefila:${localDayKey(window.start)}-${window.tefila}`;

export function useOccasionsDone() {
  function mark(key: string, done: boolean): void {
    occasionsDone.value = writeOccasionDone(occasionsDone.value, key, done);
  }
  return { keys: occasionsDone, mark };
}

export function useOfficesDone() {
  const store = useParcours();

  function isOfficeDone(window: TefilaWindow): boolean {
    if (occasionsDone.value.includes(officeKey(window))) return true;
    const day = localDayKey(window.start);
    const task = store.tasksOn(day).find((task) => task.step === window.tefila);
    return task !== undefined && taskProgress(store.data.value, task, day) === "done";
  }

  return { isOfficeDone };
}
