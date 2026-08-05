import { computed, type ComputedRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { describeNearby, type ZmanimPlace } from "../services/zmanimService";

/**
 * Nom affichable du lieu de calcul, partagé par la page des horaires et la
 * carte de l'accueil.
 *
 * Une ville choisie porte son nom. Une position d'appareil, elle, n'en a pas :
 * afficher « Ma position » et deux nombres ne dit pas à l'utilisateur s'il a
 * bien été localisé. On la nomme donc par la ville connue la plus proche, avec
 * la prudence que commande la distance (voir describeNearby) : « Sarcelles »
 * tout près, « Près de Lyon » à quelques dizaines de kilomètres, et seulement
 * le pays au-delà. Les coordonnées restent affichées à côté, elles disent la
 * précision réelle.
 */
export function useZmanimPlaceLabel(place: Ref<ZmanimPlace>): ComputedRef<string> {
  const { t, locale } = useI18n();

  /** « FR » → « France », dans la langue de l'interface. */
  function countryName(code: string): string | null {
    try {
      return new Intl.DisplayNames([locale.value], { type: "region" }).of(code) ?? null;
    } catch {
      return null; // API absente ou code inconnu : on retombe sur « Ma position »
    }
  }

  return computed(() => {
    if (place.value.city) return place.value.city;
    const naming = describeNearby(place.value.nearby);
    switch (naming.kind) {
      case "city":
        return naming.city;
      case "near":
        return t("zmanim.place.near", { city: naming.city });
      case "country":
        return countryName(naming.country) ?? t("zmanim.place.device");
      default:
        return t("zmanim.place.device");
    }
  });
}
