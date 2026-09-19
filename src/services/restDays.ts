import { HDate, flags, getHolidaysOnDate } from "@hebcal/core";
import { localDayFrom } from "./dateService";

/**
 * Les jours de pause de la série : le Chabbat et les Yom Tov, où une bonne
 * partie du public n'ouvre pas l'application. Ils ne comptent ni pour ni
 * contre la série (voir dailyStreak) : elle les traverse.
 *
 * Diaspora par défaut, comme la paracha de la semaine (dailyCycles) : le
 * public de l'application est en France. `il` suit le calendrier d'Israël.
 * 'Hol haMoed n'est pas un jour de pause : on y travaille, on y étudie.
 */
export function isRestDay(date: Date, il = false): boolean {
  const hd = new HDate(date);
  if (hd.getDay() === 6) return true;
  return (getHolidaysOnDate(hd, il) ?? []).some(
    (ev) => (ev.getFlags() & flags.CHAG) !== 0 && (ev.getFlags() & flags.EREV) === 0,
  );
}

/** Même chose pour une clé de jour (YYYY-MM-DD). */
export function isRestDayKey(key: string, il = false): boolean {
  const day = localDayFrom(key);
  return day ? isRestDay(day, il) : false;
}

/**
 * La règle de pause telle que la série la reçoit : les jours de repos quand
 * la personne l'a voulu (c'est le défaut), aucun sinon.
 */
export function pauseRule(restDays: boolean, il = false): (key: string) => boolean {
  return restDays ? (key) => isRestDayKey(key, il) : () => false;
}
