/**
 * Per-session Open Graph card generator.
 *
 * Renders the card laid out by `ogCardSvg.ts` (the designer's banner, the
 * session name written over it) to a 1200×630 PNG, so a link shared on
 * WhatsApp, Instagram or Facebook gets a tailored preview instead of the
 * generic image.
 *
 * Rasterized with @resvg/resvg-js (rustybuzz shapes Hebrew correctly). The
 * fonts and the background are bundled under functions/fonts and
 * functions/assets, so the function has no external/runtime download. Any
 * failure is handled by the caller (which falls back to the static reading
 * sharing banner, public/og/).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { buildCardSvg, FONT_TEXT, WIDTH, type OgCardOptions } from "./ogCardSvg";

export type { OgCardOptions } from "./ogCardSvg";

/** Bundled font files (functions/fonts), resolved relative to the compiled lib/.
 *  (Le binding natif de resvg ne prend que des chemins, `fontBuffers` est
 *  réservé au build WASM ; le coût par requête est amorti par le s-maxage
 *  de 24 h du CDN sur les PNG.) */
const FONT_DIR = join(__dirname, "..", "fonts");
const FONT_FILES = [
  join(FONT_DIR, "PlayfairDisplay-Regular.ttf"),
  join(FONT_DIR, "Manrope-Medium.ttf"),
  join(FONT_DIR, "NotoSansHebrew-Bold.ttf"),
];

/** The banner without its tagline, read once per instance. */
const BACKGROUND_FILE = join(__dirname, "..", "assets", "session-card.png");
let background: string | null = null;
function backgroundDataUrl(): string {
  background ??= `data:image/png;base64,${readFileSync(BACKGROUND_FILE).toString("base64")}`;
  return background;
}

/** Render a session OG card to a PNG buffer. */
export function renderOgPng(options: OgCardOptions): Buffer {
  const svg = buildCardSvg(options, backgroundDataUrl());
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: FONT_TEXT },
  });
  return resvg.render().asPng();
}
