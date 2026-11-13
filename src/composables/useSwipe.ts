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
  /** Les axes que le geste peut prendre ; `y: "down"`, seulement tirer vers le bas. */
  x?: boolean;
  y?: boolean | "down";
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
      const vertical = options.y === "down" ? moveY > 0 : Boolean(options.y);
      if ((horizontal && !options.x) || (!horizontal && !vertical)) {
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
      // Not only the parents: the element's own click listeners (a page
      // opened, its audience event) must not take it for a touch.
      event.stopImmediatePropagation();
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
      // Tirer vers le bas : l'élément porte `touch-action: pan-y`, et le
      // navigateur ferait défiler la page. Une fois le geste à nous (le doigt
      // est parti vers le bas), on le lui retire ; vers le haut, la page
      // défile comme d'habitude.
      onTouchmove: (event: TouchEvent) => {
        if (dragging.value && axis.value === "y" && event.cancelable) event.preventDefault();
      },
      // Un menu contextuel sur un appui long viendrait par-dessus la fiche.
      onContextmenu: (event: Event) => {
        if (options.onLongPress) event.preventDefault();
      },
    },
  };
}

/** Les sens qu'un élément peut prendre en suivant le doigt. */
export interface DragAllowance {
  left?: boolean;
  right?: boolean;
  down?: boolean;
}

/**
 * Ce qui suit le doigt, le temps du geste : une carte glissée de côté penche
 * un peu, tirée vers le bas elle descend à demi. `allow` borne les sens : une
 * carte qui ne se glisse qu'à droite ne part pas à gauche.
 */
export function dragStyle(
  gesture: Pick<ReturnType<typeof useSwipe>, "dx" | "dy" | "dragging" | "axis">,
  allow: DragAllowance,
): Record<string, string> {
  if (!gesture.dragging.value) return {};
  if (gesture.axis.value === "y") {
    const dy = allow.down ? Math.max(0, gesture.dy.value) / 2 : 0;
    return { transform: `translateY(${dy}px)`, transition: "none" };
  }
  const min = allow.left ? -Infinity : 0;
  const max = allow.right ? Infinity : 0;
  const dx = Math.min(max, Math.max(min, gesture.dx.value));
  return { transform: `translateX(${dx}px) rotate(${dx / 30}deg)`, transition: "none" };
}
