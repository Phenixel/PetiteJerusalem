import { onBeforeUnmount, onMounted } from "vue";
import { isNativeApp } from "./useNativeApp";
import { useReadingSize } from "./useReadingSize";

/**
 * App native : sur une page de texte, pincer agrandit le TEXTE lu, pas la
 * page. Le zoom de la webview est désactivé (voir main.ts) parce qu'il
 * agrandit tout, barres comprises, et laisse la page décalée ; le réflexe du
 * pincement reste le bon, il pilote ici le même réglage que les boutons
 * A− / A+ (useReadingSize).
 *
 * À appeler dans les vues qui portent ce réglage : les écouteurs ne vivent que
 * le temps où elles sont montées, le geste n'a donc aucun effet ailleurs.
 */

/** Écarts relatifs des doigts qui valent un cran de taille (in / out). */
const STEP_IN = 1.22;
const STEP_OUT = 0.82;

function distance(touches: TouchList): number {
  const [a, b] = [touches[0], touches[1]];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function useReadingPinch(): void {
  if (!isNativeApp) return;
  const readingSize = useReadingSize();
  // Écart de départ du geste en cours ; 0 quand aucun pincement n'est actif.
  let baseline = 0;

  // Le repère se reprend à chaque changement de main : sans cela, lever un
  // doigt sur trois laisserait le repère d'une géométrie qui n'existe plus, et
  // le premier mouvement à deux doigts sauterait aussitôt d'un cran.
  function reframe(event: TouchEvent) {
    baseline = event.touches.length === 2 ? distance(event.touches) : 0;
  }

  function onMove(event: TouchEvent) {
    if (event.touches.length !== 2 || baseline === 0) return;
    // Le geste pilote la taille : il ne doit pas aussi faire défiler la page.
    event.preventDefault();
    const current = distance(event.touches);
    const ratio = current / baseline;
    if (ratio > STEP_IN) readingSize.increase();
    else if (ratio < STEP_OUT) readingSize.decrease();
    else return;
    // Nouveau repère : un pincement continu enchaîne les crans un à un.
    baseline = current;
  }

  onMounted(() => {
    document.addEventListener("touchstart", reframe, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", reframe, { passive: true });
    document.addEventListener("touchcancel", reframe, { passive: true });
  });

  onBeforeUnmount(() => {
    document.removeEventListener("touchstart", reframe);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", reframe);
    document.removeEventListener("touchcancel", reframe);
  });
}
