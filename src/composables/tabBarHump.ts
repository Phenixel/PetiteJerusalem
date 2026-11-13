/**
 * The bump of the app's bottom bar (BottomTabBar): its white rises over the
 * round times button in the middle, instead of the button sticking out of
 * it, and the reading progress line (ReadingProgressBar), which runs along
 * the top edge of the bar, rides over the bump the same way. One shape for
 * both, so that the line lies exactly on the edge.
 *
 * A bell, like the bump the finger pulls in the line: 12 px at its top,
 * enough to clear the button (52 px round, its top 5.6 px above the bar)
 * with a margin, and gone some 70 px on each side of the middle.
 */
export const HUMP_HEIGHT = 12;
export const HUMP_SPREAD = 28;
/** The bump is drawn over this width, past which it is flat. */
export const HUMP_WIDTH = 6 * HUMP_SPREAD;

/** How high the bar's edge stands `dx` pixels from the middle of the screen. */
export function humpHeight(dx: number): number {
  const d = dx / HUMP_SPREAD;
  return HUMP_HEIGHT * Math.exp(-d * d);
}

/**
 * The edge of the bump over `HUMP_WIDTH`, as SVG points from its left end,
 * `baseline` being the height of the flat edge in the drawing.
 */
export function humpPoints(baseline: number, step = 4): [number, number][] {
  const points: [number, number][] = [];
  for (let x = 0; x <= HUMP_WIDTH; x += step) {
    points.push([x, baseline - humpHeight(x - HUMP_WIDTH / 2)]);
  }
  return points;
}
