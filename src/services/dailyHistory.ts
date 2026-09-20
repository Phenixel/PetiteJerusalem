import { localDayFrom, localDayKey } from "./dateService";
import { shiftDayKey } from "./dailyStreak";

/**
 * L'historique des journées : ce qui a été fait chaque jour, gardé quatre
 * mois. C'est la mémoire dont vivent le calendrier du mois, la semaine en
 * cours, les compteurs cumulés (psaumes lus, dafim étudiés, prières), les
 * siyoumim et les objectifs à fréquence (« trois fois par semaine »).
 *
 * Il se range avec le suivi du jour (dailyReadingProgress.history) et suit
 * son chemin : écrit à chaque coche, gardé hors ligne, fusionné au retour du
 * réseau (voir mergeHistory). Une entrée par jour civil, bornée : au-delà de
 * HISTORY_DAYS, les journées les plus anciennes s'effacent.
 *
 * Ce module ne connaît aucun calendrier hébraïque : l'accueil le lit dès le
 * premier rendu, sans hebcal (voir initialBundle.test.ts). Les compteurs qui
 * en ont besoin (psaumes du cycle, siyoumim) vivent dans dailyStats.
 */

/** Une journée, telle qu'elle s'est finie (ou telle qu'elle est en cours). */
export interface DayRecord {
  /** Objectifs faits et objectifs du jour, au dernier enregistrement. */
  done: number;
  total: number;
  /** Journée réussie, selon la règle du moment (voir daySucceeded). */
  ok: boolean;
  /** Tout ce qui a été coché : ids de textes, clés d'options, d'actions, d'objectifs. */
  keys: string[];
  /** Journée manquée que la série a couverte avec un joker (voir dailyStreak). */
  frozen?: boolean;
}

export type DailyHistory = Record<string, DayRecord>;

export const HISTORY_DAYS = 120;

/**
 * La règle de la journée réussie : tout, au moins la moitié, ou au moins une
 * chose. Duolingo compte une série dès une leçon ; exiger tout décourage dès
 * qu'on a huit objectifs. La personne choisit, la série suit.
 */
export type DailyGoalRule = "all" | "half" | "one";
export const DAILY_GOAL_RULES: DailyGoalRule[] = ["all", "half", "one"];

export function daySucceeded(done: number, total: number, rule: DailyGoalRule): boolean {
  if (total === 0 || done === 0) return false;
  switch (rule) {
    case "one":
      return done >= 1;
    case "half":
      return done * 2 >= total;
    default:
      return done >= total;
  }
}

/** Ne garde que les journées des HISTORY_DAYS derniers jours. */
export function pruneHistory(history: DailyHistory, today: string): DailyHistory {
  const floor = shiftDayKey(today, -(HISTORY_DAYS - 1));
  const kept: DailyHistory = {};
  for (const [key, record] of Object.entries(history)) {
    if (key >= floor && key <= today) kept[key] = record;
  }
  return kept;
}

/**
 * Deux historiques, celui du serveur et celui de l'appareil : l'union, et
 * pour un même jour la journée la plus avancée (le « fait » gagne, comme
 * pour le suivi du jour).
 */
export function mergeHistory(
  a: DailyHistory | undefined,
  b: DailyHistory | undefined,
): DailyHistory | undefined {
  if (!a) return b;
  if (!b) return a;
  const merged: DailyHistory = { ...a };
  for (const [key, record] of Object.entries(b)) {
    const other = merged[key];
    if (!other) {
      merged[key] = record;
      continue;
    }
    const keys = [...new Set([...other.keys, ...record.keys])];
    const done = Math.max(other.done, record.done, keys.length);
    merged[key] = {
      done,
      total: Math.max(other.total, record.total),
      ok: other.ok || record.ok,
      keys,
    };
  }
  return merged;
}

/** L'état d'un jour dans le calendrier et la semaine. */
export type DayState = "done" | "partial" | "missed" | "pause" | "future" | "empty";

export interface DayCell {
  key: string;
  /** Quantième civil. */
  day: number;
  /** Jour de la semaine (0 = dimanche), pour la lettre sous la pastille. */
  weekday: number;
  state: DayState;
  today: boolean;
}

/** L'état d'un jour d'après l'historique et la règle de pause. */
export function dayState(
  key: string,
  history: DailyHistory,
  today: string,
  isPause: (key: string) => boolean,
): DayState {
  const record = history[key];
  if (record?.ok) return "done";
  if (record && record.done > 0) return "partial";
  // Un Chabbat à venir se montre déjà en pause : on sait qu'il ne comptera pas.
  if (isPause(key)) return "pause";
  if (key > today) return "future";
  // Avant le premier jour connu, rien n'a été manqué : il n'y avait rien.
  const first = Object.keys(history).sort()[0];
  if (!first || key < first) return "empty";
  return key === today ? "empty" : "missed";
}

/**
 * Les sept derniers jours, aujourd'hui compris : la semaine glissante que la
 * carte du jour montre, et dont chaque jour passé se corrige. Glissante et
 * non calendaire : un dimanche n'aurait sinon rien à corriger.
 */
export function recentDays(
  today: string,
  history: DailyHistory,
  isPause: (key: string) => boolean,
  count = 7,
): DayCell[] {
  return Array.from({ length: count }, (_, i) => {
    const key = shiftDayKey(today, i - (count - 1));
    const day = localDayFrom(key);
    return {
      key,
      day: Number(key.slice(-2)),
      weekday: day ? day.getDay() : 0,
      state: dayState(key, history, today, isPause),
      today: key === today,
    };
  });
}

/**
 * Le mois civil en grille : les cases vides du début (le mois ne commence pas
 * un dimanche), puis un DayCell par jour.
 */
export function monthGrid(
  year: number,
  month: number,
  history: DailyHistory,
  today: string,
  isPause: (key: string) => boolean,
): (DayCell | null)[] {
  const first = new Date(year, month, 1);
  const cells: (DayCell | null)[] = Array.from({ length: first.getDay() }, () => null);
  const days = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const key = localDayKey(new Date(year, month, d));
    cells.push({
      key,
      day: d,
      weekday: new Date(year, month, d).getDay(),
      state: dayState(key, history, today, isPause),
      today: key === today,
    });
  }
  return cells;
}

/**
 * Le suivi des objectifs à période (semaine, mois, an, programme sur N
 * jours) : pour chaque objectif, la période en cours et les jours où il a
 * été fait. Une seule période à la fois, celle qui change remet à zéro : un
 * objectif « trois fois par semaine » ne garde que la semaine en cours. La
 * clé de période est calculée par goalPeriods (le calendrier hébraïque pour
 * le mois et l'année) ; ici on ne fait que ranger.
 */
export interface GoalProgressEntry {
  period: string;
  dates: string[];
  /** Livre à finir : unités lues (voir bookGoals), et celles ajoutées au dernier jour coché. */
  units?: number;
  dayUnits?: number;
}
export type GoalProgress = Record<string, GoalProgressEntry>;

/** Les jours faits de l'objectif dans la période donnée. */
export function goalDates(progress: GoalProgress, goalId: string, period: string): string[] {
  const entry = progress[goalId];
  return entry && entry.period === period ? entry.dates : [];
}

/** Coche ou décoche un jour d'un objectif dans sa période. */
export function setGoalDone(
  progress: GoalProgress,
  goalId: string,
  period: string,
  dayKey: string,
  done: boolean,
): GoalProgress {
  const dates = new Set(goalDates(progress, goalId, period));
  if (done) dates.add(dayKey);
  else dates.delete(dayKey);
  const entry = progress[goalId];
  const kept =
    entry && entry.period === period ? { units: entry.units, dayUnits: entry.dayUnits } : {};
  return { ...progress, [goalId]: { period, dates: [...dates].sort(), ...kept } };
}

/** Unités lues d'un livre dans sa période (voir bookGoals). */
export function goalUnits(progress: GoalProgress, goalId: string, period: string): number {
  const entry = progress[goalId];
  return entry && entry.period === period ? (entry.units ?? 0) : 0;
}

/**
 * Coche ou décoche la portion du jour d'un livre : `portion` unités de plus,
 * ou celles du dernier jour coché de moins.
 */
export function setBookDone(
  progress: GoalProgress,
  goalId: string,
  period: string,
  dayKey: string,
  portion: number,
  done: boolean,
): GoalProgress {
  const next = setGoalDone(progress, goalId, period, dayKey, done);
  const entry = next[goalId];
  const units = goalUnits(progress, goalId, period);
  const dayUnits = progress[goalId]?.period === period ? (progress[goalId].dayUnits ?? 0) : 0;
  return {
    ...next,
    [goalId]: done
      ? { ...entry, units: units + portion, dayUnits: portion }
      : { ...entry, units: Math.max(0, units - dayUnits), dayUnits: 0 },
  };
}

/**
 * Deux suivis, celui du serveur et celui de l'appareil : par objectif, la
 * période la plus récente l'emporte ; à période égale, l'union des jours.
 */
export function mergeGoalProgress(
  a: GoalProgress | undefined,
  b: GoalProgress | undefined,
): GoalProgress | undefined {
  if (!a) return b;
  if (!b) return a;
  const merged: GoalProgress = { ...a };
  for (const [id, entry] of Object.entries(b)) {
    const other = merged[id];
    if (!other || entry.period > other.period) merged[id] = entry;
    else if (entry.period === other.period) {
      merged[id] = {
        period: entry.period,
        dates: [...new Set([...other.dates, ...entry.dates])].sort(),
        // Le livre le plus avancé l'emporte : ce qui est lu est lu.
        ...((other.units ?? 0) >= (entry.units ?? 0)
          ? { units: other.units, dayUnits: other.dayUnits }
          : { units: entry.units, dayUnits: entry.dayUnits }),
      };
    }
  }
  return merged;
}
