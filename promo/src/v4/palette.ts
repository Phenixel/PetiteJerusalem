/**
 * The colors of version 4.0 (docs/design.md, "Theme colors"): a pastel of
 * the logo's orange as a solid fill, with white on it as in the app, its
 * deepened ink for orange text, the logo's blue, the warm page background.
 * The 3.10 videos keep their own (src/theme.ts, THEMES): they show the app
 * of that time.
 *
 * White on the pastel orange is the app's documented exception (2.2:1, APCA
 * Lc 47): fine for large bold words, which is what the video writes there.
 */
import type { Look } from "../theme.ts";

export const V4 = {
  /** The pastel orange, a solid fill (cards of the moment, buttons). */
  orange: "#EB9F4F",
  /** What is written on the orange. */
  onOrange: "#ffffff",
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

/**
 * The colors of the designer's logo and share banners (docs/design.md, "The
 * logo and the share banners"), for the video's opening and end card, which
 * speak their language: the soft orange of the walls, the sky blue of the
 * book and the star, the near black of the banners' titles, on the same cream.
 */
export const BRAND = {
  orange: "#FEA547",
  blue: "#539EE2",
  title: "#1E1B18",
  bg: "#FFF9F3",
};

/** The look of the 4.0 captures: the default theme, light. */
export const LOOK_V4: Look = { theme: "sunset", dark: false };
