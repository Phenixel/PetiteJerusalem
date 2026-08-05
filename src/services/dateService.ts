import { i18n } from "../i18n";

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
