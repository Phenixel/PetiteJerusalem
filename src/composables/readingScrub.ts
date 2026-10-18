/**
 * The progress bar as a slider (ReadingProgressBar): a finger laid on it
 * takes the page to the same share of the text, and the titles it passes
 * line up above it on an arc. The geometry lives here, away from the DOM.
 */

/**
 * The share of the text under the finger, from 0 to 1. The bar fills from
 * the right in Hebrew: the start of the text is then on the right edge.
 */
export function scrubFraction(
  clientX: number,
  rect: { left: number; width: number },
  rtl: boolean,
): number {
  if (rect.width <= 0) return 0;
  const share = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return rtl ? 1 - share : share;
}

/** How far apart two neighboring titles sit, as a share of the panel width. */
export const ARC_SPACING = 0.42;
/** Beyond this distance (in ranks), a title is no longer drawn. */
export const ARC_REACH = 2.2;

export interface ArcPlacement {
  /** Horizontal offset from the center, as a share of the panel width. */
  x: number;
  /** Drop below the top of the arc, in pixels. */
  y: number;
  /** Tilt along the arc, in degrees. */
  rotate: number;
  scale: number;
  opacity: number;
}

/**
 * Where a title sits on the arc, `distance` ranks away from the reading line
 * (0: the section reached, in the middle; 0.5: halfway to it). The arc drops
 * at its ends: the nearer a title comes to the middle, the higher, the larger
 * and the more legible it gets, until it is the one being read. Mirrored in
 * Hebrew, where the text moves forward to the left.
 */
export function arcPlacement(distance: number, rtl = false): ArcPlacement {
  const side = rtl ? -1 : 1;
  const reach = Math.abs(distance);
  return {
    x: side * distance * ARC_SPACING,
    y: distance * distance * 14,
    rotate: side * distance * 6,
    scale: Math.max(0.45, 1 - 0.32 * reach),
    opacity: Math.max(0, 1 - 0.5 * reach),
  };
}
