import { computed, ref } from "vue";
import { devicePreference } from "../services/devicePreference";
import {
  cycleEntries,
  dailyReadings,
  inDailyBook,
  markPsalm,
  psalmsRead,
  rankOf,
  type DailyObjective,
  type DailyReading,
} from "../services/parcours/dailyBook";
import type { DayKey } from "../services/parcours/model";
import { liveObjectives, taskProgress, type Task } from "../services/parcours/schedule";
import { useParcours } from "./useParcours";

/**
 * The daily book for the screens (services/parcours/dailyBook.ts): what it
 * holds, the day's readings, each read or not, and marking one.
 *
 * The volume of the shelf, the card of the home stack, the lamp and the page
 * all read it, so they agree on what is read.
 */

/** The psalms ticked one by one (catalog ids) for the day, by Tehilim cycle. */
interface PsalmsTicked {
  day: DayKey;
  read: Record<string, number[]>;
}

// The key the Tehilim of the day page used when it ticked them (PR #420):
// a tick made there is kept.
const psalmsStore = devicePreference<PsalmsTicked>(
  "pj_tehilim_cycle_read",
  (raw) => {
    try {
      const value = raw ? (JSON.parse(raw) as PsalmsTicked) : null;
      return value &&
        typeof value.day === "string" &&
        value.read &&
        typeof value.read === "object" &&
        !Array.isArray(value.read)
        ? value
        : null;
    } catch {
      return null;
    }
  },
  JSON.stringify,
);

/** Shared by every screen: a tick on the page shows at once on the home volume. */
const ticked = ref<PsalmsTicked | null>(psalmsStore.read());

/** A reading of the day, read or not. */
export interface DailyReadingState extends DailyReading {
  done: boolean;
}

export function useDailyBook() {
  const store = useParcours();
  const today = computed(() => store.today.value);

  /** What the book holds: the daily texts in the order of the catalog, then the cycles. */
  const objectives = computed<DailyObjective[]>(() => {
    const held = liveObjectives(store.data.value).filter(inDailyBook);
    const texts = held
      .flatMap((objective) => (objective.kind === "text" ? [objective] : []))
      .sort((a, b) => rankOf(a.textId) - rankOf(b.textId));
    return [...texts, ...held.filter((objective) => objective.kind === "cycle")];
  });

  /** The day's tasks of the book. */
  const tasks = computed<Task[]>(() =>
    store.todayTasks.value.filter((task) =>
      inDailyBook(store.data.value.objectives[task.objectiveId]),
    ),
  );

  const taskDone = (task: Task): boolean =>
    taskProgress(store.data.value, task, today.value) === "done";

  const tickedToday = computed(() =>
    ticked.value && ticked.value.day === today.value ? ticked.value.read : {},
  );

  /** A cycle's psalms of the day, by catalog id. */
  function psalmsOf(task: Task): number[] {
    const objective = store.data.value.objectives[task.objectiveId];
    return objective?.kind === "cycle" && inDailyBook(objective)
      ? cycleEntries(objective.cycle, today.value).map((entry) => Number(entry.id))
      : [];
  }

  function readFor(task: Task): number[] {
    return psalmsRead(tickedToday.value[task.objectiveId] ?? [], psalmsOf(task), taskDone(task));
  }

  function isDone(reading: DailyReading): boolean {
    if (reading.textTask && !taskDone(reading.textTask)) return false;
    const id = Number(reading.entry.id);
    return reading.cycleTasks.every((task) => readFor(task).includes(id));
  }

  const readings = computed<DailyReadingState[]>(() =>
    dailyReadings(tasks.value, store.data.value.objectives, today.value).map((reading) => ({
      ...reading,
      done: isDone(reading),
    })),
  );

  const doneCount = computed(() => readings.value.filter((reading) => reading.done).length);

  /** Marks a reading read (or not): its daily text, and its psalm in each cycle that gives it. */
  function setRead(reading: DailyReading, read: boolean, source: string): void {
    const day = today.value;
    if (reading.textTask && taskDone(reading.textTask) !== read) {
      store.setDone(reading.textTask, day, read, source);
    }
    if (reading.cycleTasks.length === 0) return;
    const next = { ...tickedToday.value };
    const finished: { task: Task; done: boolean }[] = [];
    for (const task of reading.cycleTasks) {
      const wasDone = taskDone(task);
      const marked = markPsalm(
        next[task.objectiveId] ?? [],
        Number(reading.entry.id),
        psalmsOf(task),
        wasDone,
        read,
      );
      next[task.objectiveId] = marked.read;
      if (marked.taskDone !== wasDone) finished.push({ task, done: marked.taskDone });
    }
    ticked.value = { day, read: next };
    psalmsStore.write(ticked.value);
    for (const { task, done } of finished) store.setDone(task, day, done, source);
  }

  return { objectives, tasks, readings, doneCount, setRead, taskDone, today };
}
