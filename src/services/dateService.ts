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
 * Valeur d'un champ `datetime-local` pour une date : l'heure LOCALE, au format
 * YYYY-MM-DDTHH:mm que le champ attend. `toISOString()` donnerait l'heure UTC,
 * que le champ réinterprète ensuite comme locale : chaque enregistrement sans
 * toucher la date la décalait du fuseau horaire (deux heures en France).
 */
export function toDateTimeLocal(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${localDayKey(date)}T${hours}:${minutes}`;
}

/**
 * Fin de journée LOCALE d'une date de champ `date` (YYYY-MM-DD). `new Date("YYYY-MM-DD")`
 * lirait minuit UTC, soit la veille au soir à l'ouest de Greenwich : une date
 * limite choisie à Montréal reculait d'un jour.
 */
export function endOfLocalDay(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
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
