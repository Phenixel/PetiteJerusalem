import { localDayFrom, localDayKey } from "../dateService";
import { computeZmanim, type ZmanKey, type ZmanimPlace } from "../zmanimService";
import { addDays } from "./days";
import type { DayKey } from "./model";

/**
 * When the journey's day begins: at dawn, at the place of the times, not at
 * midnight.
 *
 * Until dawn, the night still belongs to the evening before: Arvit or the
 * bedtime Chema said at 1 a.m. are the previous day's, as they are by the
 * Hebrew day, whose night only ends at alot hachahar. The wall keeps civil
 * days; only the turn moves from midnight to dawn.
 *
 * Dawn is the one the times page shows, by the opinion chosen in the
 * settings. Where that opinion has none (Rav Posen counts in degrees, and
 * north of Lille the sky never gets dark enough for 16.1° some summer
 * nights), misheyakir, then sunrise, which marks the morning at the latest.
 * Only where the sun does not rise at all does the day turn at midnight.
 *
 * Held by parcoursCalendar.test.ts.
 */

/** The times that can open the day, the first one that exists wins. */
const DAY_START_KEYS: readonly ZmanKey[] = ["alotHaShachar", "misheyakir", "sunrise"];

/** The instant the journey's day `day` (a civil day, YYYY-MM-DD) begins. */
export function dayStartOf(place: ZmanimPlace, day: DayKey): Date {
  const midnight = localDayFrom(day) ?? new Date();
  const noon = new Date(midnight);
  noon.setHours(12);
  const times = computeZmanim(place, noon);
  for (const key of DAY_START_KEYS) {
    const time = times.find((zman) => zman.key === key);
    if (time) return time.date;
  }
  return midnight;
}

/** The journey's day at an instant: the previous civil day until dawn. */
export function dayKeyAt(now: Date, place: ZmanimPlace): DayKey {
  const today = localDayKey(now);
  return now < dayStartOf(place, today) ? addDays(today, -1) : today;
}

/** The instant the journey's next day begins: the checks of the day expire then. */
export function nextDayStart(now: Date, place: ZmanimPlace): Date {
  return dayStartOf(place, addDays(dayKeyAt(now, place), 1));
}
