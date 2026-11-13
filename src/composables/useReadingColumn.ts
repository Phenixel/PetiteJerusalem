import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";

/**
 * La colonne de lecture et la place libre autour d'elle, pour la loupe de la
 * forme de la page (pageZoom.ts). Mesurées sur un repère sans hauteur, posé
 * par le composant en tête de son contenu : `ruler`.
 *
 * La colonne peut changer de place sans changer de largeur (le volet des
 * commentaires la pousse vers la gauche, on règle sa largeur en tirant son
 * bord) : on la remesure donc aussi quand la page de lecture change de classe
 * et quand la largeur du volet change (`--study-width`, sur la racine).
 */

/** L'écart gardé entre la page agrandie et le bord de l'écran, ou le volet. */
const GUTTER = 16;

export function useReadingColumn(): {
  ruler: Ref<HTMLElement | null>;
  column: Ref<number>;
  free: Ref<{ left: number; right: number }>;
} {
  const ruler = ref<HTMLElement | null>(null);
  const column = ref(0);
  const free = ref({ left: 0, right: 0 });

  function measure(): void {
    const rect = ruler.value?.getBoundingClientRect();
    if (!rect?.width) return;
    // Le volet des commentaires, rangé à droite sur un écran large, borne la place.
    const panel = document.querySelector(".commentary-panel.sheet-docked")?.getBoundingClientRect();
    const edge =
      panel?.width && panel.left >= rect.right ? panel.left : document.documentElement.clientWidth;
    column.value = rect.width;
    free.value = { left: rect.left - GUTTER, right: edge - rect.right - GUTTER };
  }

  let frame = 0;
  const remeasure = (): void => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  };
  let resizes: ResizeObserver | null = null;
  let moves: MutationObserver | null = null;

  onMounted(() => {
    measure();
    window.addEventListener("resize", remeasure);
    if (typeof ResizeObserver !== "undefined" && ruler.value) {
      resizes = new ResizeObserver(remeasure);
      resizes.observe(ruler.value);
    }
    if (typeof MutationObserver !== "undefined") {
      moves = new MutationObserver(remeasure);
      const page = ruler.value?.closest("main");
      if (page) moves.observe(page, { attributes: true, attributeFilter: ["class"] });
      moves.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    }
  });

  onBeforeUnmount(() => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", remeasure);
    resizes?.disconnect();
    moves?.disconnect();
  });

  return { ruler, column, free };
}
