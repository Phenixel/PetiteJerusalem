import { computed, ref } from "vue";
import { tehilimOfCycle, type TehilimCycle } from "../services/dailyCycles";
import { localDayFrom } from "../services/dateService";
import { devicePreference } from "../services/devicePreference";
import {
  isAlive,
  isTehilimCycle,
  type CycleObjective,
  type DayKey,
  type Objective,
  type TehilimCycleId,
} from "../services/parcours/model";
import { useParcours } from "./useParcours";
import { useParcoursViews } from "./useParcoursViews";

/**
 * A Tehilim cycle of Mon parcours (the psalms of the day of the month, or of
 * the day of the week) read on the Tehilim of the day page: each psalm is
 * marked read on its own, and the last one marks the day's task, as the last
 * chapter of a text does on the daily reading (LectureDuJourPage).
 *
 * The psalms already marked stay on the device for the day: what Mon
 * parcours keeps and syncs is the task, done or not. A task marked done
 * elsewhere (the home stack) shows every psalm read; unmarking one psalm
 * then unmarks the task, and keeps the others read.
 */

export type TehilimCycleObjective = CycleObjective & { cycle: TehilimCycleId };

/** A live Tehilim cycle of Mon parcours. */
const isLiveTehilimCycle = (objective: Objective | undefined): objective is TehilimCycleObjective =>
  objective?.kind === "cycle" && isTehilimCycle(objective.cycle) && isAlive(objective);

/** The psalms marked read (their catalog ids), for one objective and one day. */
interface PsalmsRead {
  day: DayKey;
  objectiveId: string;
  read: number[];
}

/**
 * The psalms read after one more toggle, and whether the task is then done.
 * A task already done counts every psalm as read.
 */
export function togglePsalm(
  read: readonly number[],
  psalm: number,
  all: readonly number[],
  taskDone: boolean,
): { read: number[]; taskDone: boolean } {
  const base = taskDone ? [...all] : read.filter((one) => all.includes(one));
  if (base.includes(psalm)) return { read: base.filter((one) => one !== psalm), taskDone: false };
  const next = [...base, psalm];
  return { read: next, taskDone: all.length > 0 && all.every((one) => next.includes(one)) };
}

const psalmsStore = devicePreference<PsalmsRead>(
  "pj_tehilim_cycle_read",
  (raw) => {
    try {
      const value = raw ? (JSON.parse(raw) as PsalmsRead) : null;
      return value &&
        typeof value.day === "string" &&
        typeof value.objectiveId === "string" &&
        Array.isArray(value.read)
        ? value
        : null;
    } catch {
      return null;
    }
  },
  JSON.stringify,
);

/** `objectiveId`: the `?objectif=` of the page; anything but a live Tehilim cycle gives nothing. */
export function useTehilimCycleTask(objectiveId: () => string | null) {
  const store = useParcours();
  const views = useParcoursViews();

  const objective = computed<TehilimCycleObjective | null>(() => {
    const id = objectiveId();
    const found = id ? store.data.value.objectives[id] : undefined;
    return isLiveTehilimCycle(found) ? found : null;
  });

  /** The psalms of the objective's day: the day of Mon parcours, which turns at dawn. */
  const cycle = computed<TehilimCycle | null>(() => {
    if (!objective.value) return null;
    const date = localDayFrom(store.today.value) ?? new Date();
    date.setHours(12);
    return tehilimOfCycle(objective.value.cycle, date);
  });

  const task = computed(() =>
    objective.value
      ? (store.todayTasks.value.find((one) => one.objectiveId === objective.value?.id) ?? null)
      : null,
  );
  const taskDone = computed(() =>
    task.value ? views.taskView(task.value, store.today.value).progress === "done" : false,
  );

  const stored = ref<PsalmsRead | null>(psalmsStore.read());
  const read = computed(() => {
    const value = stored.value;
    return value && value.day === store.today.value && value.objectiveId === objective.value?.id
      ? value.read
      : [];
  });

  /** The psalms of the day by their catalog id: what is marked. */
  const ids = computed(() => (cycle.value?.entries ?? []).map((entry) => Number(entry.id)));

  const isRead = (psalm: number): boolean => taskDone.value || read.value.includes(psalm);
  const readCount = computed(() => ids.value.filter(isRead).length);

  /** Marks or unmarks a psalm (its catalog id); returns whether it is now read. */
  function toggle(psalm: number): boolean {
    const all = ids.value;
    const current = task.value;
    if (!objective.value || !current) return false;
    const next = togglePsalm(read.value, psalm, all, taskDone.value);
    stored.value = { day: store.today.value, objectiveId: objective.value.id, read: next.read };
    psalmsStore.write(stored.value);
    if (next.taskDone !== taskDone.value) {
      store.setDone(current, store.today.value, next.taskDone, "tehilim_day_page");
    }
    return next.read.includes(psalm);
  }

  return { objective, cycle, task, taskDone, isRead, readCount, toggle, today: store.today };
}
