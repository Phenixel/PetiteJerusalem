import { localDayFrom, localDayKey } from "./dateService";

/**
 * La série de jours : le compteur qui monte d'un cran chaque jour où la
 * journée est réussie (voir daySucceeded dans dailyHistory), et qui retombe
 * à zéro dès qu'un jour est manqué.
 *
 * Deux choses la rendent tenable :
 *
 * - les **jours de pause** (le Chabbat, les Yom Tov, voir restDays) : ils ne
 *   comptent ni pour ni contre, la série les traverse. C'est l'appelant qui
 *   dit quels jours sont des pauses (`rules.isPause`), la série ne connaît
 *   aucun calendrier ;
 * - les **jokers** : chaque semaine entière de série en donne un (deux au
 *   plus en réserve). Un jour manqué en consomme un au lieu de rompre la
 *   série. Ils se gagnent, ils ne s'achètent pas.
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
  /** Le dernier jour (YYYY-MM-DD) où la journée a été réussie, "" si jamais. */
  lastDate: string;
  /** Jokers en réserve (absent sur les séries d'avant les jokers). */
  freezes?: number;
}

export const EMPTY_STREAK: DailyStreak = { current: 0, best: 0, lastDate: "" };

/** Un joker gagné par semaine entière de série, deux en réserve au plus. */
export const FREEZE_EVERY_DAYS = 7;
export const MAX_FREEZES = 2;
/** Au-delà de deux mois sans rien, on ne cherche plus : la série est rompue. */
const MAX_GAP_DAYS = 60;

export interface StreakRules {
  /** Vrai pour un jour qui ne compte ni pour ni contre (Chabbat, Yom Tov). */
  isPause?: (dayKey: string) => boolean;
}

/** Le jour civil qui précède une clé de jour (YYYY-MM-DD). */
export function previousDayKey(key: string): string {
  return shiftDayKey(key, -1);
}

/** Une clé de jour décalée de `days` jours. */
export function shiftDayKey(key: string, days: number): string {
  const day = localDayFrom(key);
  if (!day) return "";
  day.setDate(day.getDate() + days);
  return localDayKey(day);
}

/** Les jours strictement entre deux clés, dans l'ordre ; vides si trop loin. */
function daysBetween(from: string, to: string): string[] | null {
  const start = localDayFrom(from);
  const end = localDayFrom(to);
  if (!start || !end) return null;
  const span = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (span < 1 || span > MAX_GAP_DAYS) return null;
  const keys: string[] = [];
  for (let i = 1; i < span; i++) keys.push(shiftDayKey(from, i));
  return keys;
}

/** Les jours manqués entre deux jours faits : ceux qui comptent et n'ont pas été faits. */
function missedBetween(from: string, to: string, rules: StreakRules): string[] | null {
  const between = daysBetween(from, to);
  if (between === null) return null;
  const isPause = rules.isPause ?? (() => false);
  return between.filter((key) => !isPause(key));
}

/**
 * Les jours manqués que la série couvrira avec ses jokers si la journée est
 * réussie aujourd'hui : l'appelant les écrit dans l'historique comme gelés,
 * pour que la série se relise pareil plus tard (voir rebuildStreak).
 */
export function frozenDaysBetween(
  streak: DailyStreak | undefined,
  today: string,
  rules: StreakRules = {},
): string[] {
  const base = streak ?? EMPTY_STREAK;
  if (base.lastDate === today || !base.lastDate || base.current === 0 || base.lastDate >= today) {
    return [];
  }
  const missed = missedBetween(base.lastDate, today, rules);
  return missed !== null && missed.length > 0 && missed.length <= (base.freezes ?? 0) ? missed : [];
}

/**
 * La série relue depuis l'historique, après qu'un jour passé a été corrigé
 * (voir dailyHistory) : les journées réussies consécutives jusqu'à la plus
 * récente, les jours de pause enjambés, les jours gelés comptés. Le record
 * ne redescend jamais, les jokers restent ceux d'avant. L'historique ne
 * remonte que quatre mois : une série plus longue se relit à cette hauteur.
 */
export function rebuildStreak(
  history: Record<string, { ok: boolean }>,
  today: string,
  previous: DailyStreak | undefined,
  rules: StreakRules = {},
): DailyStreak {
  const base = previous ?? EMPTY_STREAK;
  const isPause = rules.isPause ?? (() => false);
  const okDays = Object.keys(history)
    .filter((key) => key <= today && history[key].ok)
    .sort();
  const latest = okDays[okDays.length - 1];
  if (!latest) return { ...base, current: 0, lastDate: "" };
  let current = 1;
  let cursor = latest;
  for (let i = 0; i < 400; i++) {
    cursor = shiftDayKey(cursor, -1);
    if (history[cursor]?.ok) current += 1;
    else if (isPause(cursor)) continue;
    else break;
  }
  return {
    current,
    best: Math.max(base.best, current),
    lastDate: latest,
    freezes: base.freezes ?? 0,
  };
}

/**
 * La journée est réussie aujourd'hui : la série continue (les jours d'entre
 * deux étaient des pauses, ou couverts par des jokers), repart de un (un jour
 * a été manqué), ou reste telle quelle (déjà comptée aujourd'hui).
 */
export function recordDayDone(
  streak: DailyStreak | undefined,
  today: string,
  rules: StreakRules = {},
): DailyStreak {
  const base = streak ?? EMPTY_STREAK;
  if (base.lastDate === today) return base;
  let freezes = base.freezes ?? 0;
  let current = 1;
  if (base.lastDate && base.current > 0 && base.lastDate < today) {
    const missed = missedBetween(base.lastDate, today, rules);
    if (missed !== null && missed.length <= freezes) {
      current = base.current + 1;
      freezes -= missed.length;
    }
  }
  // Une semaine entière de plus : un joker de plus, dans la limite de la réserve.
  if (current % FREEZE_EVERY_DAYS === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
  return { current, best: Math.max(base.best, current), lastDate: today, freezes };
}

/** Ce que la série vaut aujourd'hui, une fois confrontée au calendrier. */
export interface StreakStatus {
  /** Zéro si un jour compté a été manqué sans joker : la série est rompue. */
  current: number;
  best: number;
  /** La journée d'aujourd'hui est déjà réussie. */
  doneToday: boolean;
  /**
   * La série tient encore, mais aujourd'hui compte et n'est pas encore fait :
   * elle se perd à minuit si rien n'est fait (ou coûte un joker).
   */
  atRisk: boolean;
  /** Aujourd'hui est un jour de pause : la série tient sans rien faire. */
  pausedToday: boolean;
  /** Jokers en réserve. */
  freezes: number;
  /** Jokers que la série a besoin de consommer pour tenir jusqu'à aujourd'hui. */
  freezesNeeded: number;
}

export function streakStatus(
  streak: DailyStreak | undefined,
  today: string,
  rules: StreakRules = {},
): StreakStatus {
  const base = streak ?? EMPTY_STREAK;
  const isPause = rules.isPause ?? (() => false);
  const pausedToday = isPause(today);
  const freezes = base.freezes ?? 0;
  const doneToday = base.lastDate === today && base.current > 0;
  if (doneToday) {
    return {
      current: base.current,
      best: base.best,
      doneToday,
      atRisk: false,
      pausedToday,
      freezes,
      freezesNeeded: 0,
    };
  }
  const missed =
    base.current > 0 && base.lastDate && base.lastDate < today
      ? missedBetween(base.lastDate, today, rules)
      : null;
  const holds = missed !== null && missed.length <= freezes;
  return {
    current: holds ? base.current : 0,
    best: base.best,
    doneToday,
    atRisk: holds && !pausedToday,
    pausedToday,
    freezes,
    freezesNeeded: holds ? missed.length : 0,
  };
}

/**
 * L'instant (epoch ms) jusqu'auquel la série courante tient sans rien faire
 * de plus : le minuit qui suit le prochain jour compté (ni pause, ni couvert
 * par un joker) après le dernier jour fait. Passé cet instant, la série vaut
 * zéro. Zéro quand il n'y a pas de série.
 *
 * C'est ce que les widgets natifs comparent à l'heure qu'il est : ils ne
 * connaissent aucun calendrier, seulement des epochs (voir widgetPayloads).
 */
export function streakExpiresAt(streak: DailyStreak | undefined, rules: StreakRules = {}): number {
  const base = streak ?? EMPTY_STREAK;
  if (base.current === 0 || !base.lastDate) return 0;
  const isPause = rules.isPause ?? (() => false);
  let spare = base.freezes ?? 0;
  for (let i = 1; i <= MAX_GAP_DAYS; i++) {
    const key = shiftDayKey(base.lastDate, i);
    if (isPause(key)) continue;
    if (spare > 0) {
      spare -= 1;
      continue;
    }
    // Ce jour-là compte : il faut l'avoir fait avant le minuit qui le clôt.
    const day = localDayFrom(key);
    if (!day) return 0;
    day.setDate(day.getDate() + 1);
    day.setHours(0, 0, 0, 0);
    return day.getTime();
  }
  return 0;
}

/**
 * Deux séries, celle du serveur et celle cochée sur l'appareil pendant une
 * coupure : la plus récente l'emporte, et à jour égal la plus longue ; le
 * record et les jokers, eux, sont les plus grands des deux quoi qu'il arrive.
 */
export function mergeStreak(
  a: DailyStreak | undefined,
  b: DailyStreak | undefined,
): DailyStreak | undefined {
  if (!a) return b;
  if (!b) return a;
  const best = Math.max(a.best, b.best);
  const freezes = Math.max(a.freezes ?? 0, b.freezes ?? 0);
  if (a.lastDate === b.lastDate) {
    return { current: Math.max(a.current, b.current), best, lastDate: a.lastDate, freezes };
  }
  const newer = a.lastDate > b.lastDate ? a : b;
  return { ...newer, best, freezes };
}

/** Les paliers de la série, ceux qu'on fête. */
export const STREAK_MILESTONES = [7, 30, 100, 365] as const;

/** Le palier que `current` vient d'atteindre, ou null. */
export function milestoneReached(current: number): number | null {
  return STREAK_MILESTONES.find((m) => m === current) ?? null;
}
