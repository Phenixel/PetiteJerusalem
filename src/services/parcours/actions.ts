import { addDays, weekStart } from "./days";
import type { DayKey, DayLog, Objective, ParcoursData } from "./model";
import type { Task } from "./schedule";

/**
 * Ce qu'on fait de ses données : cocher, décocher, mettre de côté, créer,
 * retirer. Des fonctions pures, qui rendent des données neuves sans toucher
 * aux anciennes ; le store les applique et les garde (store.ts).
 *
 * Chaque écriture date l'entrée qu'elle touche (`at`, `updatedAt`) : c'est ce
 * qui la fait gagner sur l'autre appareil à la fusion.
 */

const emptyLog = (now: number): DayLog => ({ done: [], at: now });

function withDay(
  data: ParcoursData,
  day: DayKey,
  change: (log: DayLog) => DayLog,
  now: number,
): ParcoursData {
  const current = data.days[day] ?? emptyLog(now);
  const next = { ...change({ ...current }), at: now };
  return { ...data, days: { ...data.days, [day]: next } };
}

const without = (list: string[] | undefined, id: string): string[] =>
  (list ?? []).filter((item) => item !== id);

/**
 * Coche (ou décoche) une tâche, ce jour-là. Pour un programme, la portion
 * entière se compte lue ce jour : au rythme de la semaine, ce qu'il restait
 * de la portion de la semaine.
 */
export function setTaskDone(
  data: ParcoursData,
  task: Task,
  day: DayKey,
  done: boolean,
  now: number = Date.now(),
): ParcoursData {
  if (task.slot) {
    const already = data.days[day]?.units?.[task.objectiveId] ?? 0;
    const remaining = Math.max(0, task.slot.to - task.slot.from - task.slot.done);
    return setUnitsRead(data, task.objectiveId, day, done ? already + remaining : 0, now);
  }
  if (!done && task.weekly) {
    // Une tâche de la semaine se décoche le jour où elle a été cochée.
    for (let d = weekStart(day); d <= day; d = addDays(d, 1)) {
      if (data.days[d]?.done.includes(task.id)) {
        data = withDay(data, d, (log) => ({ ...log, done: without(log.done, task.id) }), now);
      }
    }
    return data;
  }
  return withDay(
    data,
    day,
    (log) => ({
      ...log,
      done: done ? [...without(log.done, task.id), task.id] : without(log.done, task.id),
      skipped: log.skipped && without(log.skipped, task.id),
    }),
    now,
  );
}

/** Les unités d'un programme lues ce jour-là (0 efface le jour). */
export function setUnitsRead(
  data: ParcoursData,
  objectiveId: string,
  day: DayKey,
  units: number,
  now: number = Date.now(),
): ParcoursData {
  return withDay(
    data,
    day,
    (log) => {
      const all = { ...log.units };
      if (units > 0) all[objectiveId] = Math.round(units);
      else delete all[objectiveId];
      return { ...log, units: all };
    },
    now,
  );
}

/** « Pas aujourd'hui » (ou son contraire) : la tâche ne compte pas ce jour-là. */
export function setTaskSkipped(
  data: ParcoursData,
  taskId: string,
  day: DayKey,
  skipped: boolean,
  now: number = Date.now(),
): ParcoursData {
  return withDay(
    data,
    day,
    (log) => ({
      ...log,
      skipped: skipped ? [...without(log.skipped, taskId), taskId] : without(log.skipped, taskId),
    }),
    now,
  );
}

/** Crée ou remplace un objectif. */
export function putObjective(
  data: ParcoursData,
  objective: Objective,
  now: number = Date.now(),
): ParcoursData {
  return {
    ...data,
    objectives: { ...data.objectives, [objective.id]: { ...objective, updatedAt: now } },
  };
}

/**
 * Retire un objectif. Il reste gardé, marqué retiré : les journées passées
 * gardent leur état, et le retrait gagne sur l'autre appareil.
 */
export function removeObjective(
  data: ParcoursData,
  id: string,
  now: number = Date.now(),
): ParcoursData {
  const objective = data.objectives[id];
  if (!objective) return data;
  return putObjective(data, { ...objective, deletedAt: now }, now);
}

/** Met un objectif en pause à partir d'un jour, ou l'en sort (`null`). */
export function setPaused(
  data: ParcoursData,
  id: string,
  from: DayKey | null,
  now: number = Date.now(),
): ParcoursData {
  const objective = data.objectives[id];
  if (!objective) return data;
  const next = { ...objective };
  if (from === null) delete next.pausedFrom;
  else next.pausedFrom = from;
  return putObjective(data, next, now);
}
