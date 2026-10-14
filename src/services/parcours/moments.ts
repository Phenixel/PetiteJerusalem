import type { MomentId } from "./model";

/**
 * Les moments de la journée, et l'ordre dans lequel le paquet de l'accueil
 * présente les tâches.
 *
 * Les bornes suivent le soleil quand on connaît le lieu : le matin jusqu'à
 * 'hatsot, l'après-midi jusqu'à la chkia, le soir ensuite, et le coucher à
 * partir de 22 h. Sans horaires, midi et 18 h en tiennent lieu.
 */

/** Les moments qui ont une heure, dans l'ordre de la journée. */
export const TIMED_MOMENTS: readonly MomentId[] = ["morning", "afternoon", "evening", "bedtime"];

/** Les deux bornes du jour qui comptent ici. */
export interface DayTimes {
  chatzot: Date;
  sunset: Date;
}

const BEDTIME_HOUR = 22;
/** Avant 4 h, on est encore au coucher de la veille. */
const NIGHT_END_HOUR = 4;

/** Le moment d'un instant. */
export function momentAt(now: Date, times: DayTimes | null): MomentId {
  const hour = now.getHours();
  if (hour >= BEDTIME_HOUR || hour < NIGHT_END_HOUR) return "bedtime";
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
