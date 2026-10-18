import type { MomentId } from "./model";

/**
 * The moments of the day, and the order in which the home deck presents the
 * tasks.
 *
 * The bounds follow the sun at the place of the times: morning from dawn to
 * 'hatsot, afternoon until the chkia, evening after it, and bedtime from
 * 10 p.m. until dawn (the night belongs to the evening before, dayStart.ts).
 * Without times, midnight, noon and 6 p.m. stand in for them.
 */

/** Les moments qui ont une heure, dans l'ordre de la journée. */
export const TIMED_MOMENTS: readonly MomentId[] = ["morning", "afternoon", "evening", "bedtime"];

/** Les bornes du jour qui comptent ici. */
export interface DayTimes {
  /** Dawn: until then, it is still the previous evening's bedtime (dayStart.ts). */
  dayStart: Date;
  chatzot: Date;
  sunset: Date;
}

const BEDTIME_HOUR = 22;

/** Le moment d'un instant. */
export function momentAt(now: Date, times: DayTimes | null): MomentId {
  if (now.getHours() >= BEDTIME_HOUR) return "bedtime";
  // Before the day begins, it is still the previous evening's bedtime.
  if (now < (times?.dayStart ?? at(now, 0))) return "bedtime";
  const chatzot = times?.chatzot ?? at(now, 12);
  const sunset = times?.sunset ?? at(now, 18);
  if (now < chatzot) return "morning";
  if (now < sunset) return "afternoon";
  return "evening";
}

const at = (day: Date, hour: number): Date =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);

/** Rang d'un moment dans la journée ; « dans la journée » se range avec le moment présent. */
function rank(moment: MomentId, current: MomentId): number {
  const order = TIMED_MOMENTS.indexOf(moment === "anytime" ? current : moment);
  return order < 0 ? 0 : order;
}

/**
 * L'ordre du paquet : d'abord le moment présent (et ce qui se fait dans la
 * journée), puis les moments qui viennent, enfin ceux déjà passés. On ne
 * pousse pas en tête ce qu'on a laissé passer : on le retrouve en tirant le
 * paquet, à sa place dans la journée.
 */
export function deckOrder(moment: MomentId, current: MomentId): number {
  const delta = rank(moment, current) - rank(current, current);
  const anytime = moment === "anytime" ? 0.5 : 0;
  return (delta >= 0 ? delta : TIMED_MOMENTS.length + delta) + anytime;
}

/** L'ordre de la journée, du matin au coucher (le portefeuille). */
export function dayOrder(moment: MomentId): number {
  return moment === "anytime" ? TIMED_MOMENTS.length : TIMED_MOMENTS.indexOf(moment);
}
