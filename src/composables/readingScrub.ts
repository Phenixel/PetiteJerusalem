/**
 * The progress bar as a slider (ReadingProgressBar): a finger laid on it
 * takes the page to the same share of the text, and pulls the line up under
 * it like a stretched string. The titles of the text sit on that line, the
 * one being read on top of the bump. The geometry and the motion live here,
 * away from the DOM.
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

/** How high the line is pulled under the finger, in pixels. */
export const BUMP_HEIGHT = 64;
/** How wide the bump spreads on each side of the finger, in pixels. */
export const BUMP_SPREAD = 72;
/** How far apart two neighboring titles sit along the line, in pixels. */
export const TITLE_SPACING = 116;
/** Beyond this distance (in ranks), a title is no longer drawn. */
export const TITLE_REACH = 3.2;

/**
 * How high the line stands at `x`, the finger pulling it up at `peakX`; `lift`
 * goes from 0 (flat) to 1 (fully pulled). A bell, not a peak: the line is
 * stretched, it does not break.
 */
export function bumpHeight(x: number, peakX: number, lift: number): number {
  const d = (x - peakX) / BUMP_SPREAD;
  return lift * BUMP_HEIGHT * Math.exp(-d * d);
}

/** The slope of the line at `x` (height gained per pixel to the right). */
export function bumpSlope(x: number, peakX: number, lift: number): number {
  return (-2 * (x - peakX) * bumpHeight(x, peakX, lift)) / (BUMP_SPREAD * BUMP_SPREAD);
}

export interface TitlePlacement {
  /** Horizontal position, in pixels from the left of the strip. */
  x: number;
  /** Height of the line under the title, in pixels above the bar. */
  rise: number;
  /** Tilt along the line, in degrees (negative: going up to the right). */
  rotate: number;
  scale: number;
  opacity: number;
}

/**
 * Where a title sits on the line, `distance` ranks away from the reading line
 * (0: the section reached, on top of the bump; 0.5: halfway to it). Titles
 * follow the line: the one reached is carried up by the finger, large; the
 * others lie along the bar, small, and climb the slope as they come nearer,
 * growing until they are on top. Mirrored in Hebrew, where the text moves
 * forward to the left.
 */
export function titlePlacement(
  distance: number,
  peakX: number,
  lift: number,
  rtl = false,
): TitlePlacement {
  const side = rtl ? -1 : 1;
  const x = peakX + side * distance * TITLE_SPACING;
  const reach = Math.abs(distance);
  const nearness = Math.exp(-((reach / 0.6) ** 2));
  // The titles on the slopes lean with the line; the one coming on top
  // straightens up to be read.
  const slope = bumpSlope(x, peakX, lift);
  const tilt = ((-Math.atan(slope) * 180) / Math.PI) * (1 - nearness);
  return {
    x,
    rise: bumpHeight(x, peakX, lift),
    rotate: Math.max(-40, Math.min(40, tilt)),
    scale: 0.5 + 0.5 * nearness,
    opacity: Math.max(0, Math.min(1, lift)) * Math.max(0, 1 - 0.28 * reach),
  };
}

/** A value that moves like a spring towards its target. */
export interface Spring {
  value: number;
  velocity: number;
}

/**
 * One step of a damped spring: `stiffness` pulls towards the target,
 * `damping` (1: no overshoot, below: it overshoots and settles) slows it.
 * `dt` in seconds.
 */
export function stepSpring(
  spring: Spring,
  target: number,
  dt: number,
  stiffness: number,
  damping: number,
): void {
  const friction = 2 * Math.sqrt(stiffness) * damping;
  const acceleration = stiffness * (target - spring.value) - friction * spring.velocity;
  spring.velocity += acceleration * dt;
  spring.value += spring.velocity * dt;
}
