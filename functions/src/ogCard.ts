/**
 * Per-session Open Graph card generator.
 *
 * Builds a 1200×630 PNG showing the session name (and a "Chaîne de Tehilim" /
 * "Partage d'étude" label) on the brand gradient, so a link shared on WhatsApp,
 * Instagram or Facebook gets a tailored preview instead of the generic image.
 *
 * The card is a hand-built SVG rasterized with @resvg/resvg-js (rustybuzz
 * shapes Hebrew correctly). Fonts are bundled under functions/fonts so the
 * function has no external/runtime download. Everything is pure and synchronous
 * once the fonts are loaded, and any failure is handled by the caller (which
 * falls back to the static og-image.jpg).
 */
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const WIDTH = 1200;
const HEIGHT = 630;
const MARGIN = 80;
const CONTENT_WIDTH = WIDTH - MARGIN * 2;

const FONT_LATIN = "Noto Sans";
const FONT_HEBREW = "Noto Sans Hebrew";

/** Bundled font files (functions/fonts), resolved relative to the compiled lib/. */
const FONT_DIR = join(__dirname, "..", "fonts");
const FONT_FILES = [
  join(FONT_DIR, "NotoSans-Regular.ttf"),
  join(FONT_DIR, "NotoSans-Bold.ttf"),
  join(FONT_DIR, "NotoSansHebrew-Bold.ttf"),
];

/** Escape text for inclusion in SVG/XML. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const hasHebrew = (text: string): boolean => /[֐-׿]/.test(text);

/**
 * Word-wrap `text` into at most `maxLines` lines that each fit `maxChars`.
 * Character-count based (no font metrics at hand), which is plenty for an OG
 * card; the last line is ellipsized if the text overflows.
 */
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  // If anything is left over, mark the last line as truncated.
  const consumed = lines.join(" ").split(" ").length;
  if (consumed < words.length) {
    let last = lines[lines.length - 1] ?? "";
    while (last.length > maxChars - 1 && last.includes(" ")) {
      last = last.slice(0, last.lastIndexOf(" "));
    }
    lines[lines.length - 1] = `${last}…`;
  }
  return lines.length ? lines : [""];
}

export type OgCardOptions = {
  /** Main line(s): the session name. */
  title: string;
  /** Small label above the title (e.g. "Chaîne de Tehilim"). */
  label: string;
  /** Bottom tagline. */
  tagline: string;
};

/** Build the SVG markup for a card. */
function buildSvg({ title, label, tagline }: OgCardOptions): string {
  const rtl = hasHebrew(title);
  const titleSize = 64;
  const lineHeight = 80;
  // ~0.54em average advance for Noto Sans Bold.
  const maxChars = Math.floor(CONTENT_WIDTH / (titleSize * 0.54));
  const lines = wrapText(title, maxChars, 3);

  const blockHeight = lines.length * lineHeight;
  const titleStartY = Math.round((HEIGHT - blockHeight) / 2) + titleSize;

  const anchor = rtl ? "end" : "start";
  const titleX = rtl ? WIDTH - MARGIN : MARGIN;
  const dir = rtl ? ' direction="rtl"' : "";

  const titleSpans = lines
    .map(
      (line, i) =>
        `<text x="${titleX}" y="${titleStartY + i * lineHeight}" text-anchor="${anchor}"${dir} ` +
        `font-family="${FONT_LATIN}" font-weight="700" font-size="${titleSize}" fill="#ffffff">${esc(line)}</text>`,
    )
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1D6FDB"/>
      <stop offset="1" stop-color="#06B6D4"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <text x="${MARGIN}" y="110" font-family="${FONT_LATIN}" font-weight="700" font-size="34" fill="#ffffff" opacity="0.95">Petite Jérusalem</text>
  <text x="${MARGIN}" y="170" font-family="${FONT_LATIN}" font-weight="400" font-size="30" fill="#ffffff" opacity="0.85">${esc(label)}</text>
  ${titleSpans}
  <text x="${MARGIN}" y="${HEIGHT - 70}" font-family="${FONT_LATIN}" font-weight="400" font-size="30" fill="#ffffff" opacity="0.85">${esc(tagline)}</text>
</svg>`;
}

/** Render a session OG card to a PNG buffer. */
export function renderOgPng(options: OgCardOptions): Buffer {
  const svg = buildSvg(options);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: FONT_LATIN },
  });
  return resvg.render().asPng();
}
