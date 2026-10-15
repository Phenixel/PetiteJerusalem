import { onScopeDispose } from "vue";
import { haptic } from "../services/haptics";

/**
 * L'appui long, au doigt, sur une zone : l'accueil s'ouvre ainsi en
 * modification, depuis n'importe quel bloc (P2-AccueilModifier). Un doigt qui
 * bouge (on fait défiler la page) l'annule ; le clic qui suit un appui long
 * ne compte pas, et le menu du système ne s'ouvre pas par-dessus.
 *
 * `accept` dit si l'élément touché s'y prête : le paquet du jour a son propre
 * appui long, la fiche de sa carte.
 */
const LONG_PRESS_MS = 600;
const SLOP = 10;

export function useLongPress(accept: (target: Element) => boolean, onPress: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let x0 = 0;
  let y0 = 0;
  let fired = false;

  function clear(): void {
    clearTimeout(timer);
    timer = undefined;
  }

  onScopeDispose(clear);

  return {
    onPointerdown(event: PointerEvent): void {
      if (event.pointerType !== "touch") return;
      const target = event.target as Element | null;
      if (!target || !accept(target)) return;
      x0 = event.clientX;
      y0 = event.clientY;
      fired = false;
      clear();
      timer = setTimeout(() => {
        timer = undefined;
        fired = true;
        haptic("press");
        onPress();
      }, LONG_PRESS_MS);
    },
    onPointermove(event: PointerEvent): void {
      if (timer && (Math.abs(event.clientX - x0) > SLOP || Math.abs(event.clientY - y0) > SLOP)) {
        clear();
      }
    },
    onPointerup: clear,
    onPointercancel: clear,
    onClickCapture(event: MouseEvent): void {
      if (!fired) return;
      fired = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onContextmenu(event: Event): void {
      if (timer || fired) event.preventDefault();
    },
  };
}
