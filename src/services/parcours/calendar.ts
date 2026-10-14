import { HDate, HebrewCalendar, flags, months } from "@hebcal/core";
import { localDayKey } from "../dateService";
import { weekdayOf } from "./days";
import type { DayKey } from "./model";
import type { RestCalendar } from "./plan";

/**
 * Le calendrier dont Mon parcours a besoin : les jours de repos (Chabbat et
 * les fêtes chômées), et les dates qu'on se donne pour finir (Roch Hachana,
 * Pessa'h). Il tire @hebcal/core : à n'importer que depuis ce qui se charge à
 * la demande (src/__tests__/initialBundle.test.ts).
 *
 * Les fêtes diffèrent hors d'Israël (un second jour) : le lieu des horaires
 * décide (`isIsraelPlace`).
 */

const yomTovCache = new Map<string, Set<DayKey>>();

/** Les jours de fête chômés d'une année civile. */
function yomTovDays(year: number, il: boolean): Set<DayKey> {
  const key = `${year}:${il}`;
  const cached = yomTovCache.get(key);
  if (cached) return cached;
  const events = HebrewCalendar.calendar({ year, isHebrewYear: false, il, noHolidays: false });
  const days = new Set<DayKey>();
  for (const event of events) {
    if (event.getFlags() & flags.CHAG) days.add(localDayKey(event.getDate().greg()));
  }
  yomTovCache.set(key, days);
  return days;
}

/** Chabbat et les fêtes chômées, en Israël ou hors d'Israël. */
export function restCalendar(il: boolean): RestCalendar {
  return (day: DayKey) => weekdayOf(day) === 6 || yomTovDays(Number(day.slice(0, 4)), il).has(day);
}

/** Les dates qu'on se donne pour finir, telles que l'étape « pour quand » les propose. */
export type Milestone = "roshHashana" | "pessah" | "chavouot";

const MILESTONE_DATE: Record<Milestone, { month: number; day: number }> = {
  roshHashana: { month: months.TISHREI, day: 1 },
  pessah: { month: months.NISAN, day: 15 },
  chavouot: { month: months.SIVAN, day: 6 },
};

/**
 * La veille de la prochaine occurrence d'une fête, à partir d'un jour : on
 * finit avant qu'elle n'entre (« d'ici Roch Hachana »).
 */
export function milestoneEve(milestone: Milestone, from: DayKey): DayKey {
  const { month, day } = MILESTONE_DATE[milestone];
  const start = new HDate(new Date(`${from}T12:00:00`));
  for (let year = start.getFullYear(); year <= start.getFullYear() + 2; year++) {
    const feast = new HDate(day, month, year);
    const eve = localDayKey(feast.prev().greg());
    if (eve > from) return eve;
  }
  return from;
}
