import { computed, type ComputedRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { formatPlaceLabel, type ZmanimPlace } from "../services/zmanimService";

/**
 * Nom affichable du lieu de calcul, partagé par la page des horaires et la
 * carte de l'accueil. La règle elle-même vit dans formatPlaceLabel
 * (zmanimService), elle sert aussi aux widgets, hors de tout composant ; ce
 * composable ne fait que la brancher sur la réactivité de useI18n.
 */
export function useZmanimPlaceLabel(place: Ref<ZmanimPlace>): ComputedRef<string> {
  const { t, locale } = useI18n();
  return computed(() => formatPlaceLabel(place.value, t, locale.value));
}
