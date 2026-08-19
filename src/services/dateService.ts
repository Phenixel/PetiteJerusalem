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
