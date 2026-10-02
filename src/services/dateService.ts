import { i18n } from "../i18n";

/**
 * Jour civil local (YYYY-MM-DD) : LA clé du suivi quotidien de lecture, qui se
 * remet à zéro à minuit local. Partagée par la page Lecture du jour, l'accueil,
 * la bibliothèque et les payloads des widgets, quatre copies divergentes de
 * cette règle feraient dérailler la comparaison `progress.date === todayKey`.
 */
export function localDayKey(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Une valeur de champ `date` (YYYY-MM-DD) en date LOCALE, ou null si la
 * chaîne n'en est pas une.
 *
 * Jamais `new Date("2026-09-14")` : celui-là lit minuit à Greenwich, soit la
 * veille au soir à l'ouest. Le champ de date, le calendrier et la page des
 * horaires lisent tous le même format, ils le lisent donc d'ici.
 */
export function localDayFrom(key: string): Date | null {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/**
 * Fin de journée LOCALE d'un jour, donné par une valeur de champ `date`
 * (YYYY-MM-DD) ou par une date. `new Date("YYYY-MM-DD")` lirait minuit UTC,
 * soit la veille au soir à l'ouest de Greenwich : une date limite choisie à
 * Montréal reculait d'un jour.
 *
 * C'est LA règle de la date limite d'une chaîne : la journée compte entière,
 * quel que soit l'horaire enregistré (les anciennes chaînes portent minuit,
 * les nouvelles la fin de journée). Création, fin de chaîne et compte des
 * jours restants passent tous par ici.
 */
export function endOfLocalDay(day: string | Date): Date {
  if (day instanceof Date) {
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
  }
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  return new Date(year, month - 1, dayOfMonth, 23, 59, 59, 999);
}

const HOUR_MS = 3600 * 1000;

/**
 * Le jour de la date limite d'une chaîne, tel que son créateur l'a choisi
 * (YYYY-MM-DD).
 *
 * `dateLimit` est un instant : la fin de journée dans le fuseau du créateur.
 * Relu dans un autre fuseau, il tombait un autre jour : une chaîne créée à
 * Paris pour le 5 octobre se lisait « 6 octobre » à Jérusalem et n'y finissait
 * que le 6 ; créée à Montréal, elle se lisait le 6 à Paris, et la modale de
 * modification la réenregistrait au 6 sans qu'on touche à la date.
 *
 * Les chaînes récentes portent donc aussi le jour choisi (`dateLimitDay`). On
 * ne s'y fie que s'il concorde avec l'instant, c'est-à-dire si l'instant est
 * bien la fin de ce jour-là dans un fuseau qui existe (de UTC-12 à UTC+14) :
 * une version publiée de l'app qui modifierait la date réécrit l'instant sans
 * connaître ce champ, et c'est alors l'instant qui fait foi. Sans le champ
 * (anciennes chaînes), le jour se lit dans le fuseau de l'appareil, comme
 * avant.
 */
export function deadlineDayOf(session: {
  dateLimit: Date | string;
  dateLimitDay?: string;
}): string {
  const instant = new Date(session.dateLimit);
  const day = session.dateLimitDay;
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const endUtc = Date.parse(`${day}T23:59:59.999Z`);
    const at = instant.getTime();
    if (at >= endUtc - 14 * HOUR_MS && at <= endUtc + 12 * HOUR_MS) return day;
  }
  return localDayKey(instant);
}

/** La fin, sur l'appareil, du jour limite d'une chaîne : voir {@link deadlineDayOf}. */
export function deadlineOf(session: { dateLimit: Date | string; dateLimitDay?: string }): Date {
  return endOfLocalDay(deadlineDayOf(session));
}

export class DateService {
  /**
   * Date longue dans la langue de l'interface (les dates limites de session
   * étaient auparavant codées en dur en fr-FR et restaient en français dans
   * les interfaces anglaise et hébraïque).
   */
  static formatDate(date: Date): string {
    return new Date(date).toLocaleDateString(i18n.global.locale.value, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}
