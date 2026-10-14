import { onScopeDispose, ref, type Ref } from "vue";

/**
 * Les gestes d'une carte ou d'une ligne : glisser de côté, tirer vers le bas,
 * appuyer longtemps. Au doigt comme à la souris (événements pointeur) : le
 * site les reçoit aussi.
 *
 * Les règles sont celles des lignes des horaires (docs/design.md, « Une ligne
 * de liste peut devenir une commande ») :
 *
 *  - le premier mouvement franc arbitre entre défiler et glisser : un pouce
 *    qui parcourt la page ne déclenche rien au passage ;
 *  - lâché avant le seuil, l'élément revient ; au-delà, ou d'un coup sec, le
 *    geste agit ;
 *  - le clic qui suit un glissé ne compte pas : toucher et glisser sont deux
 *    gestes, et le premier ouvre la page.
 *
 * L'élément qui glisse de côté porte `touch-action: pan-y` : le navigateur
 * garde le défilement vertical, et nous laisse le côté.
 */

export type SwipeDirection = "left" | "right" | "up" | "down";

export interface SwipeOptions {
  /** Les axes que le geste peut prendre. */
  x?: boolean;
  y?: boolean;
  /** Distance (px) au-delà de laquelle le geste agit en lâchant. */
  threshold?: number;
  /** Le geste a abouti. */
  onSwipe(direction: SwipeDirection): void;
  /** L'appui long : la fiche. */
  onLongPress?(): void;
}

/** En deçà, on ne sait pas encore si le doigt défile ou glisse. */
const AXIS_SLOP = 8;
/** Un coup sec agit avant le seuil (px par ms). */
const FLICK_VELOCITY = 0.5;
const LONG_PRESS_MS = 550;
const CLICK_AFTER_GESTURE_MS = 400;

export function useSwipe(options: SwipeOptions) {
  const dx = ref(0);
  const dy = ref(0);
  /** Le geste a pris un axe : l'élément suit le doigt. */
  const dragging = ref(false);
  const axis: Ref<"x" | "y" | null> = ref(null);

  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let lastAt = 0;
  let velocity = 0;
  let pointerId: number | null = null;
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let gestureEndedAt = 0;

  function reset(): void {
    clearTimeout(pressTimer);
    dragging.value = false;
    axis.value = null;
    dx.value = 0;
    dy.value = 0;
    pointerId = null;
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || pointerId !== null) return;
    pointerId = event.pointerId;
    startX = lastX = event.clientX;
    startY = lastY = event.clientY;
    lastAt = event.timeStamp;
    velocity = 0;
    if (options.onLongPress) {
      pressTimer = setTimeout(() => {
        gestureEndedAt = Date.now();
        options.onLongPress?.();
        reset();
      }, LONG_PRESS_MS);
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return;
    const moveX = event.clientX - startX;
    const moveY = event.clientY - startY;
    if (axis.value === null) {
      if (Math.abs(moveX) < AXIS_SLOP && Math.abs(moveY) < AXIS_SLOP) return;
      clearTimeout(pressTimer);
      const horizontal = Math.abs(moveX) > Math.abs(moveY);
      if ((horizontal && !options.x) || (!horizontal && !options.y)) {
        // Le doigt défile : ce n'est pas notre geste.
        pointerId = null;
        return;
      }
      axis.value = horizontal ? "x" : "y";
      dragging.value = true;
      (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    }
    const elapsed = Math.max(1, event.timeStamp - lastAt);
    velocity =
      axis.value === "x" ? (event.clientX - lastX) / elapsed : (event.clientY - lastY) / elapsed;
    lastX = event.clientX;
    lastY = event.clientY;
    lastAt = event.timeStamp;
    if (axis.value === "x") dx.value = moveX;
    else dy.value = moveY;
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return;
    clearTimeout(pressTimer);
    if (dragging.value) {
      gestureEndedAt = Date.now();
      const threshold = options.threshold ?? 96;
      const distance = axis.value === "x" ? dx.value : dy.value;
      const flicked =
        Math.abs(velocity) > FLICK_VELOCITY && Math.sign(velocity) === Math.sign(distance);
      if (Math.abs(distance) > threshold || (flicked && Math.abs(distance) > AXIS_SLOP * 3)) {
        const direction: SwipeDirection =
          axis.value === "x" ? (distance > 0 ? "right" : "left") : distance > 0 ? "down" : "up";
        reset();
        options.onSwipe(direction);
        return;
      }
    }
    reset();
  }

  /** À poser en capture sur le clic : celui qui suit un geste ne compte pas. */
  function onClickCapture(event: MouseEvent): void {
    if (Date.now() - gestureEndedAt < CLICK_AFTER_GESTURE_MS) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  onScopeDispose(() => clearTimeout(pressTimer));

  return {
    dx,
    dy,
    dragging,
    axis,
    /** Les écouteurs à poser sur l'élément. */
    listeners: {
      onPointerdown: onPointerDown,
      onPointermove: onPointerMove,
      onPointerup: onPointerUp,
      onPointercancel: () => reset(),
      onClickCapture,
      // Un menu contextuel sur un appui long viendrait par-dessus la fiche.
      onContextmenu: (event: Event) => {
        if (options.onLongPress) event.preventDefault();
      },
    },
  };
}
