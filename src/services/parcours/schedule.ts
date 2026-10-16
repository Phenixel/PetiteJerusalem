import { localDayKey } from "../dateService";
import { addDays, dayRange, weekOf, weekStart, weekdayOf } from "./days";
import { isAlive } from "./model";
import type { DayKey, DayLog, MomentId, Objective, ObjectiveKind, ParcoursData } from "./model";
import {
  ALIYOT_PER_PARASHA,
  aliyotCardDone,
  dueAliyot,
  readsByAliya,
  type AliyotRange,
} from "./aliyot";
import { programPlan, type ProgramPlan, type RestCalendar, type SlotState } from "./plan";

/**
 * Les journées : ce qu'il y a à faire un jour donné, ce qui a été fait, et ce
 * que cela donne sur le mur et dans la série.
 *
 * Une **tâche** est ce qu'un objectif demande un jour : la portion d'un
 * programme, une habitude, la lecture d'un cycle. Une habitude à plusieurs
 * temps (les trois tefilot) en donne une par office. Une tâche **de la
 * semaine** (la paracha, un programme au rythme hebdomadaire) se fait
 * n'importe quel jour de sa semaine : elle ne pèse sur aucun jour en
 * particulier, et compte le jour où on la fait. Le chnei mikra lu montée par
 * montée, lui, a sa carte chaque jour (aliyot.ts).
 *
 * L'état d'un jour ne se garde pas : il se recalcule du journal et des
 * objectifs. Un objectif ne compte qu'à partir de son premier jour et
 * jusqu'au jour où on l'a retiré ou mis en pause.
 */

/** Les trois offices d'une habitude « les trois tefilot », chacun à son moment. */
export const TEFILOT_STEPS = [
  { step: "chaharit", moment: "morning" },
  { step: "minha", moment: "afternoon" },
  { step: "arvit", moment: "evening" },
] as const satisfies readonly { step: string; moment: MomentId }[];

export type TefilaStep = (typeof TEFILOT_STEPS)[number]["step"];

export interface Task {
  /** L'objectif, ou l'objectif et son office (« abc:minha »). */
  id: string;
  objectiveId: string;
  kind: ObjectiveKind;
  moment: MomentId;
  /** L'office, pour une habitude des trois tefilot. */
  step?: TefilaStep;
  /** Se fait n'importe quel jour de la semaine. */
  weekly: boolean;
  /** Programmes : la portion du créneau. */
  slot?: SlotState;
  /** Le chnei mikra montée par montée : les montées que la carte demande. */
  aliyot?: AliyotRange;
}

/** De quoi calculer les journées : le calendrier des repos, et les plans déjà faits. */
export interface ScheduleContext {
  isRest: RestCalendar;
  plans: Map<string, ProgramPlan>;
  /** Le journal : ce qui reste dû du chnei mikra se compte sur les jours d'avant. */
  days: Record<DayKey, DayLog>;
  /** Les montées de la paracha d'une semaine : 7, ou 14 pour une double (calendar.ts). */
  aliyotCount: (day: DayKey) => number;
}

export function scheduleContext(
  data: ParcoursData,
  isRest: RestCalendar,
  aliyotCount: (day: DayKey) => number = () => ALIYOT_PER_PARASHA,
): ScheduleContext {
  const plans = new Map<string, ProgramPlan>();
  for (const objective of Object.values(data.objectives)) {
    if (objective.kind === "program") {
      plans.set(objective.id, programPlan(objective, data.days, isRest));
    }
  }
  return { isRest, plans, days: data.days, aliyotCount };
}

/** Le jour d'un instant enregistré (ms). */
const dayOfMs = (ms: number): DayKey => localDayKey(new Date(ms));

/** L'objectif compte-t-il ce jour-là ? */
export function activeOn(objective: Objective, day: DayKey): boolean {
  if (day < objective.since) return false;
  if (objective.pausedFrom !== undefined && day >= objective.pausedFrom) return false;
  return objective.deletedAt === undefined || day < dayOfMs(objective.deletedAt);
}

/** Les tâches d'un objectif un jour donné. */
function objectiveTasks(objective: Objective, day: DayKey, ctx: ScheduleContext): Task[] {
  if (!activeOn(objective, day)) return [];
  const base = { objectiveId: objective.id, kind: objective.kind, moment: objective.moment };
  switch (objective.kind) {
    case "habit":
      if (!objective.days.includes(weekdayOf(day))) return [];
      if (objective.preset === "tefilot") {
        return TEFILOT_STEPS.map(({ step, moment }) => ({
          ...base,
          id: `${objective.id}:${step}`,
          moment,
          step,
          weekly: false,
        }));
      }
      return [{ ...base, id: objective.id, weekly: false }];
    case "text":
      return objective.days.includes(weekdayOf(day))
        ? [{ ...base, id: objective.id, weekly: false }]
        : [];
    case "cycle": {
      if (readsByAliya(objective)) {
        const aliyot = dueAliyot(
          objective.id,
          day,
          ctx.aliyotCount(day),
          ctx.days,
          objective.since,
        );
        return aliyot ? [{ ...base, id: objective.id, weekly: false, aliyot }] : [];
      }
      return [{ ...base, id: objective.id, weekly: objective.cycle === "parasha" }];
    }
    case "program": {
      const plan = ctx.plans.get(objective.id);
      if (!plan) return [];
      const slot = plan.state(day);
      if (slot.quota <= 0 || slot.from >= objective.total) return [];
      return [{ ...base, id: objective.id, weekly: objective.rhythm === "weekly", slot }];
    }
    default:
      // Une sorte d'objectif venue d'une version plus récente : gardée, sans tâche ici.
      return [];
  }
}

/** Les tâches d'un jour, objectif par objectif, dans l'ordre où on les a créés. */
export function tasksForDay(data: ParcoursData, day: DayKey, ctx: ScheduleContext): Task[] {
  return sortedObjectives(data).flatMap((objective) => objectiveTasks(objective, day, ctx));
}

/** Tous les objectifs, retirés compris, dans l'ordre où on les a créés. */
function sortedObjectives(data: ParcoursData): Objective[] {
  return Object.values(data.objectives).sort(
    (a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1),
  );
}

/** Ce qui a été fait d'une tâche ce jour-là : rien, en partie, ou tout. */
export type TaskProgress = "none" | "partial" | "done";

/** Une tâche de la semaine est faite si elle l'a été un jour de sa semaine, jusqu'à ce jour. */
function doneThisWeek(data: ParcoursData, taskId: string, day: DayKey): boolean {
  for (let d = weekStart(day); d <= day; d = addDays(d, 1)) {
    if (data.days[d]?.done.includes(taskId)) return true;
  }
  return false;
}

export function taskProgress(data: ParcoursData, task: Task, day: DayKey): TaskProgress {
  if (task.slot) {
    if (task.slot.complete) return "done";
    return task.slot.done > 0 ? "partial" : "none";
  }
  const done = task.weekly
    ? doneThisWeek(data, task.id, day)
    : (data.days[day]?.done.includes(task.id) ?? false);
  // Le chnei mikra montée par montée : la carte est faite quand ses montées
  // sont cochées une à une, depuis la liste de la semaine.
  if (!done && task.aliyot) return aliyotCardDone(data.days, day, task.aliyot) ? "done" : "none";
  return done ? "done" : "none";
}

/** La tâche est-elle mise de côté ce jour-là (« Pas aujourd'hui ») ? */
export const isSkipped = (log: DayLog | undefined, taskId: string): boolean =>
  log?.skipped?.includes(taskId) ?? false;

/**
 * L'état d'un jour, tel que le mur le dessine :
 *
 *  - `full` : tout ce qui était à faire est fait (une pierre posée) ;
 *  - `partial` : une partie (une pierre à moitié posée) ;
 *  - `rest` : Chabbat, une fête, ou rien de prévu (la pierre blanche) ;
 *  - `none` : rien de coché un jour où il y avait à faire (un creux) ;
 *  - `today` : aujourd'hui, pas encore fini ;
 *  - `future` : à venir ;
 *  - `before` : avant le premier objectif, le mur n'était pas commencé.
 */
export type DayStatus = "full" | "partial" | "rest" | "none" | "today" | "future" | "before";

export interface DaySummary {
  day: DayKey;
  status: DayStatus;
  /** Tâches du jour (hors tâches de la semaine et hors « Pas aujourd'hui »). */
  planned: number;
  done: number;
}

/** Le premier jour du parcours : celui du plus ancien objectif. */
export function firstDay(data: ParcoursData): DayKey | null {
  let first: DayKey | null = null;
  for (const objective of Object.values(data.objectives)) {
    if (first === null || objective.since < first) first = objective.since;
  }
  return first;
}

export function daySummary(
  data: ParcoursData,
  day: DayKey,
  today: DayKey,
  ctx: ScheduleContext,
  first: DayKey | null = firstDay(data),
): DaySummary {
  if (first === null || day < first) return { day, status: "before", planned: 0, done: 0 };
  if (day > today) return { day, status: "future", planned: 0, done: 0 };
  const log = data.days[day];
  const tasks = tasksForDay(data, day, ctx).filter((task) => !isSkipped(log, task.id));
  const daily = tasks.filter((task) => !task.weekly);
  let done = 0;
  let started = false;
  for (const task of daily) {
    const progress = taskProgress(data, task, day);
    if (progress === "done") done++;
    if (progress !== "none") started = true;
  }
  // Une tâche de la semaine faite ce jour-là compte pour ce jour.
  const weeklyToday = tasks.some(
    (task) =>
      task.weekly &&
      (log?.done.includes(task.id) || (task.slot && (log?.units?.[task.objectiveId] ?? 0) > 0)),
  );
  const planned = daily.length;
  let status: DayStatus;
  if (planned === 0) status = weeklyToday ? "full" : day === today ? "today" : "rest";
  else if (done === planned) status = "full";
  else if (started || done > 0 || weeklyToday) status = day === today ? "today" : "partial";
  else if (day === today) status = "today";
  else status = ctx.isRest(day) ? "rest" : "none";
  return { day, status, planned, done };
}

/** Les états de jours successifs, de `from` à `to`. */
export function daySummaries(
  data: ParcoursData,
  from: DayKey,
  to: DayKey,
  today: DayKey,
  ctx: ScheduleContext,
): DaySummary[] {
  const first = firstDay(data);
  return dayRange(from, to).map((day) => daySummary(data, day, today, ctx, first));
}

/** La série : les jours tenus d'affilée, le record, et tous les jours tenus. */
export interface Streak {
  current: number;
  best: number;
  held: number;
}

/**
 * Un jour est tenu quand on y a fait quelque chose. Chabbat, les fêtes et
 * les jours sans rien de prévu ne coupent pas la série, et ne la font pas
 * monter : ce sont des pauses. Aujourd'hui ne la coupe pas tant qu'il n'est
 * pas fini.
 */
export function streakOf(summaries: DaySummary[]): Streak {
  let current = 0;
  let best = 0;
  let held = 0;
  for (const { status } of summaries) {
    if (status === "full" || status === "partial") {
      current++;
      held++;
      best = Math.max(best, current);
    } else if (status === "none") current = 0;
  }
  return { current, best, held };
}

/** Le mur : une colonne par semaine, du dimanche au Chabbat. */
export interface WallWeek {
  /** Le Chabbat de la semaine. */
  week: DayKey;
  days: DaySummary[];
}

/** Les semaines de `from` à `to`, complétées du dimanche au Chabbat. */
export function wallWeeks(
  data: ParcoursData,
  from: DayKey,
  to: DayKey,
  today: DayKey,
  ctx: ScheduleContext,
): WallWeek[] {
  const summaries = daySummaries(data, weekStart(from), weekOf(to), today, ctx);
  const weeks: WallWeek[] = [];
  for (let i = 0; i < summaries.length; i += 7) {
    const days = summaries.slice(i, i + 7);
    weeks.push({ week: days[days.length - 1].day, days });
  }
  return weeks;
}

/** Les objectifs encore là, dans l'ordre de création. */
export const liveObjectives = (data: ParcoursData): Objective[] =>
  sortedObjectives(data).filter(isAlive);
