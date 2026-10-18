import { localDayFrom, localDayKey } from "../dateService";
import type { DayKey } from "./model";

/**
 * L'arithmétique des jours de Mon parcours, sur des clés « YYYY-MM-DD ».
 *
 * Toujours en date LOCALE, et toujours par le calendrier, jamais par 24 h :
 * un jour de changement d'heure dure 23 ou 25 heures, et compter en
 * millisecondes y sautait ou doublait un jour.
 */

/**
 * The hour the journey's day begins. Until then, the night still belongs to
 * the evening before: Arvit or the bedtime Chema said at 1 a.m. are the
 * previous day's, as they would be by the Hebrew day, which only gives way
 * to the next one in the morning. The wall keeps civil days; only the turn
 * moves from midnight to here.
 *
 * Not misheyakir: in winter it comes around 7 a.m. in Paris, and a study
 * done at 6 a.m. would have gone to the day before.
 */
export const DAY_START_HOUR = 4;

/** The journey's day at an instant: the previous civil day before {@link DAY_START_HOUR}. */
export function dayKeyAt(now: Date = new Date()): DayKey {
  const today = localDayKey(now);
  return now.getHours() < DAY_START_HOUR ? addDays(today, -1) : today;
}

/** The instant the journey's next day begins: the checks of the day expire then. */
export function nextDayStart(now: Date = new Date()): Date {
  const start = localDayFrom(addDays(dayKeyAt(now), 1)) ?? new Date(now);
  start.setHours(DAY_START_HOUR, 0, 0, 0);
  return start;
}

/** Le jour décalé de `n` jours (négatif pour reculer). */
export function addDays(day: DayKey, n: number): DayKey {
  const date = localDayFrom(day);
  if (!date) return day;
  date.setDate(date.getDate() + n);
  return localDayKey(date);
}

/** Le jour de la semaine, 0 dimanche à 6 Chabbat. */
export function weekdayOf(day: DayKey): number {
  return localDayFrom(day)?.getDay() ?? 0;
}

/** Nombre de jours de `from` à `to` (0 si c'est le même, négatif si `to` est avant). */
export function daysBetween(from: DayKey, to: DayKey): number {
  const a = localDayFrom(from);
  const b = localDayFrom(to);
  if (!a || !b) return 0;
  // Midi : à l'abri des heures sautées ou doublées.
  a.setHours(12);
  b.setHours(12);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * La semaine d'un jour, nommée par son Chabbat : la semaine de la paracha,
 * du dimanche au Chabbat. C'est la clé du rythme à la semaine.
 */
export function weekOf(day: DayKey): DayKey {
  return addDays(day, 6 - weekdayOf(day));
}

/** Le dimanche qui ouvre la semaine d'un jour. */
export function weekStart(day: DayKey): DayKey {
  return addDays(day, -weekdayOf(day));
}

/** Les jours de `from` à `to`, bornes comprises (vide si `to` est avant). */
export function dayRange(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) out.push(day);
  return out;
}

/** Le plus petit des deux jours. */
export const minDay = (a: DayKey, b: DayKey): DayKey => (a <= b ? a : b);

/** Le plus grand des deux jours. */
export const maxDay = (a: DayKey, b: DayKey): DayKey => (a >= b ? a : b);

/** Une clé de jour bien formée. */
export const isDayKey = (value: unknown): value is DayKey =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && localDayFrom(value) !== null;
