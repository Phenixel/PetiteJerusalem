import { analyticsService } from "../analyticsService";
import { daysBetween } from "./days";
import type { DayKey, Objective, ParcoursData } from "./model";
import { daySummary, type ScheduleContext, type Task } from "./schedule";

/**
 * Le suivi d'audience de Mon parcours, là où plusieurs écrans font la même
 * chose (cocher, mettre de côté) : un seul endroit, les mêmes propriétés.
 *
 * La lecture du jour d'avant avait ses événements ; la pile de l'accueil la
 * continue, ils continuent donc de partir (docs/tracking-plan.md) :
 * `daily_reading_viewed` quand on déplie le portefeuille (la journée
 * entière), `daily_reading_marked_read` quand on coche ce qu'elle proposait
 * (un texte du jour, une lecture du calendrier). Les décomptes portent
 * désormais sur toute la journée.
 */

/** La journée, telle que la lecture du jour la comptait. */
function dayCounts(data: ParcoursData, day: DayKey, ctx: ScheduleContext) {
  const { planned, done } = daySummary(data, day, day, ctx);
  return { done_count: done, total_count: planned, all_done: planned > 0 && done >= planned };
}

/** La portée d'une coche, dans les termes de la lecture du jour d'avant. */
function legacyScope(objective: Objective): Record<string, string> | null {
  if (objective.kind === "text") return { scope: "text" };
  if (objective.kind !== "cycle") return null;
  if (objective.cycle === "parasha") return { scope: "parasha_week" };
  // Les Tehilim de la semaine n'étaient pas de la lecture du jour d'avant.
  return objective.cycle === "tehilim-month" ? { scope: "option", option: "tehilim-jour" } : null;
}

/** Une tâche cochée ou décochée ; `data` est l'état d'après. */
export function trackTaskMarked(
  data: ParcoursData,
  ctx: ScheduleContext,
  task: Task,
  day: DayKey,
  today: DayKey,
  done: boolean,
  source: string,
): void {
  analyticsService.capture("parcours_task_marked", {
    done,
    kind: task.kind,
    source,
    days_ago: daysBetween(day, today),
  });
  const objective = data.objectives[task.objectiveId];
  const scope = objective && day === today ? legacyScope(objective) : null;
  if (scope) {
    analyticsService.capture("daily_reading_marked_read", {
      marked: done,
      ...scope,
      ...dayCounts(data, day, ctx),
    });
  }
}

/** « Pas aujourd'hui », ou son contraire. */
export function trackTaskSkipped(task: Task, skipped: boolean, source: string): void {
  analyticsService.capture("parcours_task_skipped", { skipped, kind: task.kind, source });
}

/** La journée d'aujourd'hui, vue entière (le portefeuille déplié). */
export function trackDayViewed(
  data: ParcoursData,
  ctx: ScheduleContext,
  today: DayKey,
  source: "wallet" | "page" = "wallet",
): void {
  const counts = dayCounts(data, today, ctx);
  analyticsService.capture("daily_reading_viewed", {
    state: counts.total_count === 0 ? "empty" : counts.all_done ? "all_done" : "in_progress",
    total_count: counts.total_count,
    done_count: counts.done_count,
    source,
  });
}
