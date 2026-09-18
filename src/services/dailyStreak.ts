import { localDayFrom, localDayKey } from "./dateService";

/**
 * La série de jours : le compteur qui monte d'un cran chaque jour où tous les
 * objectifs du jour (lectures, actions, objectifs personnels) sont cochés, et
 * qui retombe à zéro dès qu'un jour est manqué.
 *
 * Elle se range avec le suivi de la lecture du jour (dailyReadingProgress),
 * dont elle suit le chemin : enregistrée avec lui, gardée sur l'appareil hors
 * connexion, fusionnée avec le serveur au retour du réseau (voir mergeStreak).
 *
 * Un jour gagné reste gagné : décocher une lecture après avoir tout fini ne
 * retire pas le jour, personne ne décoche pour de vrai, et une série perdue
 * par une fausse manipulation serait plus rageante qu'un jour de trop.
 */
export interface DailyStreak {
  /** Jours consécutifs, `lastDate` compris. */
  current: number;
  /** La plus longue série jamais faite. */
  best: number;
  /** Le dernier jour (YYYY-MM-DD) où tout a été fait, "" si jamais. */
  lastDate: string;
}

export const EMPTY_STREAK: DailyStreak = { current: 0, best: 0, lastDate: "" };

/** Le jour civil qui précède une clé de jour (YYYY-MM-DD). */
export function previousDayKey(key: string): string {
  const day = localDayFrom(key);
  if (!day) return "";
  day.setDate(day.getDate() - 1);
  return localDayKey(day);
}

/**
 * Tout est fait aujourd'hui : la série continue (hier aussi était fait),
 * repart de un (un jour a été manqué), ou reste telle quelle (déjà comptée
 * aujourd'hui).
 */
export function recordDayDone(streak: DailyStreak | undefined, today: string): DailyStreak {
  const base = streak ?? EMPTY_STREAK;
  if (base.lastDate === today) return base;
  const current = base.lastDate === previousDayKey(today) ? base.current + 1 : 1;
  return { current, best: Math.max(base.best, current), lastDate: today };
}

/** Ce que la série vaut aujourd'hui, une fois confrontée au calendrier. */
export interface StreakStatus {
  /** Zéro si le dernier jour fait est plus vieux qu'hier : la série est rompue. */
  current: number;
  best: number;
  /** Tout a déjà été fait aujourd'hui. */
  doneToday: boolean;
  /**
   * Hier était fait, aujourd'hui pas encore : la série tient jusqu'à ce soir,
   * et se perd à minuit si rien n'est fait.
   */
  atRisk: boolean;
}

export function streakStatus(streak: DailyStreak | undefined, today: string): StreakStatus {
  const base = streak ?? EMPTY_STREAK;
  const doneToday = base.lastDate === today && base.current > 0;
  const atRisk = !doneToday && base.lastDate === previousDayKey(today) && base.current > 0;
  return {
    current: doneToday || atRisk ? base.current : 0,
    best: base.best,
    doneToday,
    atRisk,
  };
}

/**
 * L'instant (epoch ms) jusqu'auquel la série courante tient sans rien faire
 * de plus : le minuit qui suit le lendemain du dernier jour fait. Passé cet
 * instant, la série vaut zéro. Zéro quand il n'y a pas de série.
 *
 * C'est ce que les widgets natifs comparent à l'heure qu'il est : ils ne
 * connaissent aucun calendrier, seulement des epochs (voir widgetPayloads).
 */
export function streakExpiresAt(streak: DailyStreak | undefined): number {
  const base = streak ?? EMPTY_STREAK;
  if (base.current === 0 || !base.lastDate) return 0;
  const day = localDayFrom(base.lastDate);
  if (!day) return 0;
  // Le lendemain, à minuit révolu : deux jours après `lastDate` à 0 h.
  day.setDate(day.getDate() + 2);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/**
 * Deux séries, celle du serveur et celle cochée sur l'appareil pendant une
 * coupure : la plus récente l'emporte, et à jour égal la plus longue ; le
 * record, lui, est le plus grand des deux quoi qu'il arrive.
 */
export function mergeStreak(
  a: DailyStreak | undefined,
  b: DailyStreak | undefined,
): DailyStreak | undefined {
  if (!a) return b;
  if (!b) return a;
  const best = Math.max(a.best, b.best);
  if (a.lastDate === b.lastDate) {
    return { current: Math.max(a.current, b.current), best, lastDate: a.lastDate };
  }
  const newer = a.lastDate > b.lastDate ? a : b;
  return { ...newer, best };
}
