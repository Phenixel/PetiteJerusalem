import { useI18n } from "vue-i18n";

/**
 * « dans 2 h 15 » / « dans 35 min » : le temps qui reste avant un horaire.
 *
 * Partagé par la carte de l'accueil et la page des horaires, qui mettent en
 * avant le même « prochain horaire » et doivent le compter de la même façon.
 * L'appelant fournit `now` — les deux vues le rafraîchissent déjà toutes les
 * 30 secondes pour suivre la journée, la durée se recalcule avec.
 *
 * Chaîne vide quand l'horaire est passé : il n'y a plus rien à annoncer, et
 * les vues n'affichent alors pas la ligne.
 */
export function useZmanCountdown(): (date: Date, now: Date) => string {
  const { t } = useI18n();

  return (date: Date, now: Date): string => {
    const minutes = Math.round((date.getTime() - now.getTime()) / 60_000);
    if (minutes <= 0) return "";
    const duration =
      minutes < 60
        ? t("zmanim.durationM", { m: minutes })
        : t("zmanim.durationHM", {
            h: Math.floor(minutes / 60),
            // « 4 h 02 » et non « 4 h 2 » : les minutes d'une durée se lisent
            // comme celles d'une heure.
            m: String(minutes % 60).padStart(2, "0"),
          });
    return t("zmanim.nextIn", { duration });
  };
}
