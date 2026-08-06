import { computed, watch, type ComputedRef, type Ref } from "vue";
import { isNativeApp } from "./useNativeApp";

/**
 * Mode recherche des écrans à liste.
 *
 * Dès la première lettre, ce qui précède la barre de recherche s'efface et la
 * page remonte : la barre (collante, voir .app-sticky-search) se retrouve tout
 * en haut, et les résultats occupent la bande d'écran que le clavier laisse
 * libre. Sans ça, le titre de la page pousse la barre vers le milieu, le
 * clavier mange le bas, et il faut faire défiler pour voir ce qu'on cherche.
 *
 * App native seulement : c'est là que le clavier prend la moitié de l'écran,
 * et le site web reste inchangé (même ligne de partage que useNativeApp et que
 * la barre collante).
 */
export function useSearchMode(term: Ref<string>): { searching: ComputedRef<boolean> } {
  const searching = computed(() => isNativeApp && term.value.trim() !== "");

  // `post` : on remonte une fois le contenu au-dessus retiré, sinon on viserait
  // la hauteur d'avant.
  watch(
    searching,
    (active) => {
      if (active) window.scrollTo({ top: 0 });
    },
    { flush: "post" },
  );

  return { searching };
}
