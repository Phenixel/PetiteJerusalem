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

/** The line at rest: a small ring beside one line of text, in pixels. */
export const REST = { ring: 20, gap: 10, height: 44 };

/**
 * The card it grows into, the same as the card once done (PullToMark keeps
 * the two in step): from top to bottom, the heading, the ring, the two
 * lines under it.
 */
export const FULL = {
  top: 20,
  heading: 18,
  ringGap: 14,
  ring: 76,
  textGap: 14,
  text: 46,
  bottom: 22,
};
export const FULL_HEIGHT =
  FULL.top + FULL.heading + FULL.ringGap + FULL.ring + FULL.textGap + FULL.text + FULL.bottom;

/** Where everything stands at growth `e` (0: the line, 1: the card). */
export interface EndPullLayout {
  /** The height of the growing zone, its bottom fixed. */
  height: number;
  /** The ring's size and center (x from the middle, toward the line's start). */
  ring: number;
  ringX: number;
  ringY: number;
  /** The line at rest, beside the ring: where it starts, how visible. */
  lineX: number;
  lineOpacity: number;
  /** The heading above the ring, the two lines under it. */
  headingY: number;
  textY: number;
  cardOpacity: number;
}

const lerp = (a: number, b: number, e: number): number => a + (b - a) * e;
const clamp = (v: number): number => Math.max(0, Math.min(1, v));

/** How far the line has grown for a ring filled to `share`: fast at first. */
export function pullGrowth(share: number): number {
  const s = clamp(share);
  return 1 - (1 - s) * (1 - s);
}

/**
 * The layout at growth `e`. `lineWidth`: the width of the line's text at
 * rest, so that ring and text stand centered together. One shape that
 * grows, never two that swap: the ring slides to the middle as it swells,
 * the line fades out beside it, the heading and the two lines come in.
 */
export function endPullLayout(e: number, lineWidth: number): EndPullLayout {
  const g = clamp(e);
  const ring = lerp(REST.ring, FULL.ring, g);
  const restX = -(REST.ring + REST.gap + lineWidth) / 2 + REST.ring / 2;
  const ringX = lerp(restX, 0, g);
  const ringY = lerp(REST.height / 2, FULL.top + FULL.heading + FULL.ringGap + FULL.ring / 2, g);
  return {
    height: lerp(REST.height, FULL_HEIGHT, g),
    ring,
    ringX,
    ringY,
    lineX: ringX + ring / 2 + REST.gap,
    lineOpacity: clamp(1 - g * 2.5),
    headingY: ringY - ring / 2 - FULL.ringGap - FULL.heading,
    textY: ringY + ring / 2 + FULL.textGap,
    cardOpacity: clamp((g - 0.35) / 0.65),
  };
}
