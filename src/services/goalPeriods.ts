import { HDate } from "@hebcal/core";
import { customWindow, goalPeriod, goalTimes, type DailyGoal } from "./dailyActions";
import { goalDates, type GoalProgress } from "./dailyHistory";
import { shiftDayKey } from "./dailyStreak";
import { localDayFrom } from "./dateService";

/**
 * La clé de période d'un objectif un jour donné : la semaine (son dimanche),
 * le mois et l'année hébraïques (un objectif « une fois par mois » suit le
 * mois de la lune, comme la bénédiction de la lune ; « une fois par an »
 * court de Roch Hachana à Roch Hachana), ou le premier jour d'un programme
 * sur N jours. Deux jours de même clé sont dans la même période.
 */
export function periodKeyOf(goal: DailyGoal, dayKey: string): string {
  const day = localDayFrom(dayKey);
  if (!day) return "";
  switch (goalPeriod(goal)) {
    case "week":
      return shiftDayKey(dayKey, -day.getDay());
    case "month": {
      const hd = new HDate(day);
      return `${hd.getFullYear()}-${String(hd.getMonth()).padStart(2, "0")}`;
    }
    case "year":
      return String(new HDate(day).getFullYear());
    case "custom":
      return goal.start ?? "";
    default:
      return dayKey;
  }
}

/** Où en est un objectif à période, au jour donné. */
export interface GoalStatus {
  /** Fois faites dans la période en cours. */
  done: number;
  /** Fois demandées (ou jours du programme). */
  target: number;
  /** Fait ce jour-là. */
  doneToday: boolean;
  /** Programme sur N jours : le rang du jour dans la fenêtre, 0 hors fenêtre. */
  day: number;
  /** Programme sur N jours : terminé (tous les jours faits, ou fenêtre passée). */
  finished: boolean;
}

export function goalStatus(goal: DailyGoal, progress: GoalProgress, today: string): GoalStatus {
  const period = periodKeyOf(goal, today);
  const dates = goalDates(progress, goal.id, period);
  const target = goalTimes(goal);
  const window = customWindow(goal);
  let day = 0;
  let finished = false;
  if (window) {
    const start = localDayFrom(window.start);
    const now = localDayFrom(today);
    if (start && now) {
      day = Math.round((now.getTime() - start.getTime()) / 86_400_000) + 1;
      if (day < 1 || day > window.days) day = 0;
    }
    finished = dates.length >= window.days || today > window.last;
  }
  return { done: dates.length, target, doneToday: dates.includes(today), day, finished };
}
