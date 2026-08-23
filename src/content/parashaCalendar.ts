/**
 * Le calendrier des parachiot : quel Chabbat lit quelle paracha.
 *
 * Module partagé entre la vue ParashaPage (qui l'affiche en direct) et le
 * prérendu SEO (parashaSeoPages.ts, qui date les pages de textes et bâtit le
 * hub). Il ne dépend que de dailyCycles, déjà dans le bundle : rien de neuf
 * n'arrive dans les chunks des vues.
 *
 * Les Chabbats de fête n'ont pas de paracha ordinaire : ils sont simplement
 * absents de la liste, comme ils le sont du cycle.
 */

import { getParashaForShabbat, type WeeklyParasha } from "../services/dailyCycles";

/** La route du hub, partagée entre la vue, le prérendu et le routeur. */
export const PARASHA_PATH = "/paracha";

/** Un Chabbat et la paracha qu'on y lit. */
export type ParashaWeek = {
  /** Le samedi, à midi dans le repère local (comme shabbatOfWeek). */
  shabbat: Date;
  parasha: WeeklyParasha;
};

/** Le prochain samedi (aujourd'hui s'il l'est déjà), à midi. */
function nextSaturday(from: Date): Date {
  const saturday = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  saturday.setDate(saturday.getDate() + ((6 - saturday.getDay() + 7) % 7));
  return saturday;
}

/**
 * Les Chabbats à venir qui portent une paracha, sur `weeks` semaines. Deux
 * cycles complets (110 semaines) suffisent à donner à chaque paracha sa date
 * de cette année et celle de l'année suivante.
 */
export function parashaWeeks(now: Date, weeks: number): ParashaWeek[] {
  const found: ParashaWeek[] = [];
  const saturday = nextSaturday(now);
  for (let i = 0; i < weeks; i++) {
    const parasha = getParashaForShabbat(saturday);
    if (parasha) found.push({ shabbat: new Date(saturday), parasha });
    saturday.setDate(saturday.getDate() + 7);
  }
  return found;
}

/**
 * Les dates de lecture de chaque texte du catalogue, par identifiant
 * d'entrée. Une paracha double (Nitzavim - Vayelekh) date ses deux entrées du
 * même Chabbat : c'est bien ce jour-là qu'on les lit.
 */
export function readingDatesByEntry(weeks: ParashaWeek[]): Map<string, Date[]> {
  const dates = new Map<string, Date[]>();
  for (const week of weeks) {
    for (const entry of week.parasha.entries) {
      const key = String(entry.id);
      const known = dates.get(key);
      if (known) known.push(week.shabbat);
      else dates.set(key, [week.shabbat]);
    }
  }
  return dates;
}

/** « Ki Tétsé », ou « Nitzavim - Vayelekh » pour une paracha double. */
export const parashaLabel = (parasha: WeeklyParasha): string =>
  parasha.entries.map((entry) => entry.name).join(" - ");
