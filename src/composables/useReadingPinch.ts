import { onBeforeUnmount, onMounted } from "vue";
import { isNativeApp } from "./useNativeApp";
import { useReadingSizeControl } from "./useReadingSize";

/**
 * Native app: on a text page, pinching enlarges the TEXT being read, not the
 * page. The webview's zoom is disabled (see main.ts) because it enlarges
 * everything, bars included, and leaves the page shifted; the pinch reflex is
 * still the right one, so here it drives the same setting as the A− / A+
 * buttons (useReadingSizeControl: the text's size, or the page form's while
 * one is on screen).
 *
 * To be called in the views that carry this setting: the listeners only live
 * while they are mounted, so the gesture has no effect anywhere else.
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
  const readingSize = useReadingSizeControl();
  // Écart de départ du geste en cours ; 0 quand aucun pincement n'est actif.
  let baseline = 0;

  // L'écouteur de mouvement n'est posé QUE pendant un geste à deux doigts.
  // Non passif (il doit pouvoir empêcher le défilement), il obligerait sinon
  // le navigateur à attendre le script avant chaque défilement à un doigt,
  // pendant toute la lecture : le texte « accroche » sous le doigt sur les
  // petits téléphones. Hors pincement, rien n'est enregistré.
  let listening = false;

  function listen(active: boolean) {
    if (active === listening) return;
    listening = active;
    if (active) document.addEventListener("touchmove", onMove, { passive: false });
    else document.removeEventListener("touchmove", onMove);
  }

  // Le repère se reprend à chaque changement de main : sans cela, lever un
  // doigt sur trois laisserait le repère d'une géométrie qui n'existe plus, et
  // le premier mouvement à deux doigts sauterait aussitôt d'un cran.
  function reframe(event: TouchEvent) {
    const pinching = event.touches.length === 2;
    baseline = pinching ? distance(event.touches) : 0;
    listen(pinching);
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
    document.addEventListener("touchend", reframe, { passive: true });
    document.addEventListener("touchcancel", reframe, { passive: true });
  });

  onBeforeUnmount(() => {
    document.removeEventListener("touchstart", reframe);
    document.removeEventListener("touchend", reframe);
    document.removeEventListener("touchcancel", reframe);
    listen(false);
  });
}
