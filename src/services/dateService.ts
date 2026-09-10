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
