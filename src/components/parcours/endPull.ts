/**
 * The pull at the end of a reading (PullToMark): once the page can scroll no
 * further, a finger that keeps pushing it up, from anywhere on the page,
 * fills the ring. What is counted is the rise since the end was reached:
 * the scroll that leads there counts for nothing, and a finger that lets the
 * page scroll back up starts over. The geometry lives here, away from the
 * DOM.
 */

/** Pulled this far past the end, it is done. */
export const END_PULL = 120;

export interface EndPull {
  /** Where the finger was when the page reached its end; null before. */
  anchorX: number | null;
  anchorY: number | null;
  /** How far the finger has risen since, in pixels (0 if not a pull). */
  rise: number;
}

export const NO_PULL: EndPull = { anchorX: null, anchorY: null, rise: 0 };

/**
 * The finger moves to (x, y); `atEnd`: the page can scroll no further down.
 * A sideways gesture (more across than up) is not a pull.
 */
export function movePull(state: EndPull, x: number, y: number, atEnd: boolean): EndPull {
  if (!atEnd) return NO_PULL;
  if (state.anchorX === null || state.anchorY === null) {
    return { anchorX: x, anchorY: y, rise: 0 };
  }
  const rise = Math.max(0, state.anchorY - y);
  const across = Math.abs(x - state.anchorX);
  return { ...state, rise: rise > across ? rise : 0 };
}

/** How full the ring is, from 0 to 1. */
export function pullShare(rise: number): number {
  return Math.max(0, Math.min(1, rise / END_PULL));
}
