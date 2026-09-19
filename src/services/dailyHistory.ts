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

/** Les sept jours de la semaine de `today`, du dimanche au Chabbat. */
export function weekOf(
  today: string,
  history: DailyHistory,
  isPause: (key: string) => boolean,
): DayCell[] {
  const day = localDayFrom(today);
  if (!day) return [];
  const sunday = shiftDayKey(today, -day.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const key = shiftDayKey(sunday, i);
    return {
      key,
      day: Number(key.slice(-2)),
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
      state: dayState(key, history, today, isPause),
      today: key === today,
    });
  }
  return cells;
}

/**
 * Combien de fois un objectif à fréquence a été fait dans la semaine de
 * `today` (du dimanche au Chabbat), le jour même compris quand il est coché.
 */
export function weeklyCount(
  goalId: string,
  history: DailyHistory,
  today: string,
  doneToday: boolean,
): number {
  const day = localDayFrom(today);
  if (!day) return 0;
  const sunday = shiftDayKey(today, -day.getDay());
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const key = shiftDayKey(sunday, i);
    if (key === today) {
      if (doneToday) count += 1;
    } else if (history[key]?.keys.includes(goalId)) count += 1;
  }
  return count;
}
