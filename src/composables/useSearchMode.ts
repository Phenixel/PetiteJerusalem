import { computed, watch, type ComputedRef, type Ref } from "vue";
import { isNativeApp } from "./useNativeApp";

/**
 * Mode recherche des écrans à liste.
 *
 * Dès la première lettre, ce qui précède la barre de recherche se replie et la
 * page remonte : la barre (collante, voir .app-sticky-search) glisse tout en
 * haut, et les résultats occupent la bande d'écran que le clavier laisse
 * libre. Sans ça, le titre de la page pousse la barre vers le milieu, le
 * clavier mange le bas, et il faut faire défiler pour voir ce qu'on cherche.
 *
 * Le mouvement est animé des deux côtés, repli du contenu au-dessus
 * (CollapseTransition, côté vues) et remontée en douceur ici, pour qu'on voie
 * la barre monter plutôt que l'écran sauter.
 *
 * App native seulement : c'est là que le clavier prend la moitié de l'écran,
 * et le site web reste inchangé (même ligne de partage que useNativeApp et que
 * la barre collante).
 */
export function useSearchMode(term: Ref<string>): { searching: ComputedRef<boolean> } {
  const searching = computed(() => isNativeApp && term.value.trim() !== "");

  // `post` : on remonte une fois le repli enclenché, sinon on viserait la
  // hauteur d'avant. Le haut de page ne bouge pas pendant que le contenu se
  // replie, la cible reste donc valable du début à la fin du mouvement.
  watch(
    searching,
    (active) => {
      if (!active) return;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    },
    { flush: "post" },
  );

  return { searching };
}
