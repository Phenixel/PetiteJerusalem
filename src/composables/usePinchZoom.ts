import { ref, type Ref } from "vue";

/**
 * A real zoom on a photo: two fingers pinch it open around the point they
 * hold, one finger then moves through it, a double tap enlarges where it
 * lands (or brings it back), and on a computer the wheel zooms under the
 * cursor. The photo never leaves its frame: zoomed out, it fills it exactly;
 * zoomed in, its edges stop at the frame's edges.
 *
 * The frame (`stage`) takes the pointer events and sets `touch-action: none`
 * so the browser does not zoom the page at the same time. The photo inside
 * is drawn with `transform: translate(x, y) scale(scale)` from its top-left
 * corner (`transform-origin: 0 0`), at the frame's size.
 *
 * Unzoomed, a horizontal swipe is not a pan: it is handed to `onSwipe`
 * (-1 toward the left, 1 toward the right), which turns the page.
 */

export interface View {
  scale: number;
  x: number;
  y: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
/** What a double tap enlarges to. */
export const TAP_SCALE = 2.5;
/** How far a finger must travel, unzoomed, for a swipe to turn the page. */
export const SWIPE_DISTANCE = 50;

const DOUBLE_TAP_DELAY = 300;
const TAP_SLOP = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Keeps the photo over its frame: at a scale of 1, it sits exactly on it;
 * larger, it may move only as far as its own edges.
 */
export function clampView(view: View, width: number, height: number): View {
  const scale = clamp(view.scale, MIN_SCALE, MAX_SCALE);
  return {
    scale,
    x: clamp(view.x, width - width * scale, 0),
    y: clamp(view.y, height - height * scale, 0),
  };
}

/**
 * Scales the photo to `scale` while the point of the frame at (px, py) stays
 * under the finger (or the cursor): the spot you zoom into does not slide
 * away.
 */
export function zoomAt(view: View, scale: number, px: number, py: number): View {
  const next = clamp(scale, MIN_SCALE, MAX_SCALE);
  const ratio = next / view.scale;
  return { scale: next, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio };
}

interface Point {
  x: number;
  y: number;
}

/** Where a gesture started: the pointers then, and the view then. */
interface Gesture {
  view: View;
  start: Point;
  distance: number;
  pointers: number;
}

export function usePinchZoom(
  stage: Ref<HTMLElement | null>,
  onSwipe?: (direction: -1 | 1) => void,
) {
  const view = ref<View>({ scale: 1, x: 0, y: 0 });
  /** A finger is on the photo: it follows it without delay. */
  const gesturing = ref(false);

  const pointers = new Map<number, Point>();
  let gesture: Gesture | null = null;
  let lastTap: { at: number; point: Point } | null = null;
  let moved = false;

  function size(): { width: number; height: number } {
    const rect = stage.value?.getBoundingClientRect();
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 };
  }

  function local(event: PointerEvent | WheelEvent): Point {
    const rect = stage.value?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  }

  /** The middle of the fingers, and how far apart they are. */
  function centroid(): { point: Point; distance: number } {
    const all = [...pointers.values()];
    const point = {
      x: all.reduce((sum, p) => sum + p.x, 0) / all.length,
      y: all.reduce((sum, p) => sum + p.y, 0) / all.length,
    };
    const distance = all.length > 1 ? Math.hypot(all[0].x - all[1].x, all[0].y - all[1].y) : 0;
    return { point, distance };
  }

  /** A finger more or a finger less: the gesture starts again from here. */
  function restart(): void {
    if (pointers.size === 0) {
      gesture = null;
      return;
    }
    const { point, distance } = centroid();
    gesture = { view: { ...view.value }, start: point, distance, pointers: pointers.size };
  }

  function settle(): void {
    const { width, height } = size();
    view.value = clampView(view.value, width, height);
  }

  function reset(): void {
    pointers.clear();
    gesture = null;
    lastTap = null;
    gesturing.value = false;
    view.value = { scale: 1, x: 0, y: 0 };
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stage.value?.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, local(event));
    if (pointers.size === 1) moved = false;
    gesturing.value = true;
    restart();
  }

  function onPointerMove(event: PointerEvent): void {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, local(event));
    const { point, distance } = centroid();
    const dx = point.x - gesture.start.x;
    const dy = point.y - gesture.start.y;
    if (Math.hypot(dx, dy) > TAP_SLOP) moved = true;
    const { width, height } = size();

    if (pointers.size > 1 && gesture.distance > 0) {
      // Pinch: the photo grows around the point the fingers held at the
      // start, and that point follows them if they move together.
      const scale = gesture.view.scale * (distance / gesture.distance);
      const zoomed = zoomAt(gesture.view, scale, gesture.start.x, gesture.start.y);
      view.value = clampView({ ...zoomed, x: zoomed.x + dx, y: zoomed.y + dy }, width, height);
      return;
    }
    if (gesture.view.scale > MIN_SCALE) {
      view.value = clampView(
        { scale: gesture.view.scale, x: gesture.view.x + dx, y: gesture.view.y + dy },
        width,
        height,
      );
      return;
    }
    // Unzoomed, the photo follows a horizontal swipe, and comes back if it
    // does not turn the page.
    if (onSwipe) view.value = { scale: 1, x: dx, y: 0 };
  }

  function onPointerUp(event: PointerEvent): void {
    if (!pointers.has(event.pointerId)) return;
    const end = local(event);
    const before = gesture;
    pointers.delete(event.pointerId);

    if (pointers.size > 0) {
      restart();
      return;
    }
    gesturing.value = false;
    gesture = null;

    if (before && before.pointers === 1 && before.view.scale === MIN_SCALE && onSwipe) {
      const dx = end.x - before.start.x;
      const dy = end.y - before.start.y;
      if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
        view.value = { scale: 1, x: 0, y: 0 };
        onSwipe(dx < 0 ? -1 : 1);
        return;
      }
    }
    settle();

    if (moved || event.type === "pointercancel") return;
    const now = event.timeStamp;
    if (lastTap && now - lastTap.at < DOUBLE_TAP_DELAY) {
      lastTap = null;
      const { width, height } = size();
      view.value =
        view.value.scale > MIN_SCALE
          ? { scale: 1, x: 0, y: 0 }
          : clampView(zoomAt(view.value, TAP_SCALE, end.x, end.y), width, height);
      return;
    }
    lastTap = { at: now, point: end };
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    const { width, height } = size();
    const point = local(event);
    // A trackpad pinch arrives as a wheel with ctrl held, in small steps; a
    // mouse wheel, in large ones.
    const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.002));
    view.value = clampView(
      zoomAt(view.value, view.value.scale * factor, point.x, point.y),
      width,
      height,
    );
  }

  return {
    view,
    gesturing,
    reset,
    handlers: {
      pointerdown: onPointerDown,
      pointermove: onPointerMove,
      pointerup: onPointerUp,
      pointercancel: onPointerUp,
      wheel: onWheel,
    },
  };
}
