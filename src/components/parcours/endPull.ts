/**
 * The pull at the end of a reading (PullToMark): once the page can scroll no
 * further, a finger laid anywhere on the page and pushing it up again fills
 * the ring. Only a finger laid when the page is already at its end pulls:
 * the one that scrolls the page there never does, even if it keeps going
 * (a brisk scroll to the end of the text would otherwise mark it). A finger
 * that lets the page scroll back up stops pulling until it is lifted. The
 * geometry lives here, away from the DOM.
 */

/** Pulled this far past the end, it is done. */
export const END_PULL = 120;

export interface EndPull {
  /** Where the finger was laid, the page at its end; null: not a pull. */
  anchorX: number | null;
  anchorY: number | null;
  /** How far the finger has risen since, in pixels (0 if not a pull). */
  rise: number;
}

export const NO_PULL: EndPull = { anchorX: null, anchorY: null, rise: 0 };

/** A finger laid at (x, y); `atEnd`: the page can scroll no further down. */
export function startPull(x: number, y: number, atEnd: boolean): EndPull {
  return atEnd ? { anchorX: x, anchorY: y, rise: 0 } : NO_PULL;
}

/**
 * The finger moves to (x, y). A sideways gesture (more across than up) is
 * not a pull.
 */
export function movePull(state: EndPull, x: number, y: number, atEnd: boolean): EndPull {
  if (!atEnd || state.anchorX === null || state.anchorY === null) return NO_PULL;
  const rise = Math.max(0, state.anchorY - y);
  const across = Math.abs(x - state.anchorX);
  return { ...state, rise: rise > across ? rise : 0 };
}

/** How full the ring is, from 0 to 1. */
export function pullShare(rise: number): number {
  return Math.max(0, Math.min(1, rise / END_PULL));
}
