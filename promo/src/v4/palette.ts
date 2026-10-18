/**
 * The colors of version 4.0 (docs/design.md, "Theme colors"): the logo's
 * light orange used as a solid fill with brown on it, its deepened ink for
 * orange text, the logo's blue, the warm page background. The 3.10 videos
 * keep their own (src/theme.ts, THEMES): they show the app of that time.
 *
 * White never goes on the light orange (2:1): brown does (7.4:1).
 */
import type { Look } from "../theme.ts";

export const V4 = {
  /** The logo's orange, a solid fill (cards of the moment, buttons). */
  orange: "#FEA547",
  /** What is written on the orange. */
  onOrange: "#3B2412",
  /** Orange text: the same hue, deepened. */
  ink: "#D46D01",
  /** The logo's blue, deepened once and for all: it carries white. */
  blue: "#328CDC",
  /** The page background, and the cream written on brown. */
  bg: "#FFF9F3",
  surface: "#ffffff",
  text: "#35312a",
  textSoft: "#6d6759",
  night: "#111827",
  nightSurface: "#1f2937",
};

/** The look of the 4.0 captures: the default theme, light. */
export const LOOK_V4: Look = { theme: "sunset", dark: false };

/** The subtitle's colors on the 4.0 background: the orange fill, brown on it. */
export const SUBTITLE_V4 = { accent: V4.orange, onAccent: V4.onOrange, accentInk: V4.ink } as const;
