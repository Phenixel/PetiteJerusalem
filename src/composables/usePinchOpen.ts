import { onBeforeUnmount, watch, type Ref } from "vue";

/**
 * Écarter deux doigts sur un élément, pour ouvrir sa vue en grand : le mur
 * de Mon parcours s'ouvre ainsi sur le mur entier (P2-Parcours). Le geste
 * n'agit qu'une fois, quand l'écart a assez grandi ; la page ne zoome pas
 * pendant ce temps.
 */

/** L'écart relatif des doigts qui vaut « ouvrir ». */
const OPEN_RATIO = 1.3;

function distance(touches: TouchList): number {
  const [a, b] = [touches[0], touches[1]];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function usePinchOpen(target: Ref<HTMLElement | null>, onOpen: () => void): void {
  let baseline = 0;

  function reframe(event: TouchEvent): void {
    baseline = event.touches.length === 2 ? distance(event.touches) : 0;
  }

  function onMove(event: TouchEvent): void {
    if (event.touches.length !== 2 || baseline === 0) return;
    if (event.cancelable) event.preventDefault();
    if (distance(event.touches) / baseline < OPEN_RATIO) return;
    baseline = 0;
    onOpen();
  }

  function bind(el: HTMLElement | null, previous: HTMLElement | null): void {
    previous?.removeEventListener("touchstart", reframe);
    previous?.removeEventListener("touchend", reframe);
    previous?.removeEventListener("touchmove", onMove);
    el?.addEventListener("touchstart", reframe, { passive: true });
    el?.addEventListener("touchend", reframe, { passive: true });
    // Non passif : le geste ne doit pas aussi zoomer la page.
    el?.addEventListener("touchmove", onMove, { passive: false });
  }

  watch(target, (el, previous) => bind(el, previous ?? null), { immediate: true });
  onBeforeUnmount(() => bind(null, target.value));
}
