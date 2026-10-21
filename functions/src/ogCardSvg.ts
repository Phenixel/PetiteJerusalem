/**
 * Layout of the per-session Open Graph card, as an SVG string.
 *
 * The background is a banner of the designer's without its subtitle and
 * tagline (`functions/assets/session-card.png`, built from the banner PSD: the
 * feather, the book, the stars and the moon, the "בס״ד · פטיט ירושלים" line
 * and the "Petite Jerusalem" title). The card writes in the space they left,
 * in the banners' own style: a
 * label in Playfair small capitals, as the banners name their section, then
 * the session name in black and a call to join in blue, in Manrope.
 *
 * Pure (no resvg, no file access) so that it can be tested without the native
 * binary; `ogCard.ts` renders it.
 */

export const WIDTH = 1200;
export const HEIGHT = 630;

export const FONT_LABEL = "Playfair Display";
export const FONT_TEXT = "Manrope";
export const FONT_HEBREW = "Noto Sans Hebrew";

/** The banners' colors (sampled on the designer's files). */
const INK = "#000000";
const BLUE = "#539EE2";

/** The free space of the background, between the title and the book. */
const CENTER_X = 600;
const LABEL_Y = 312;
const TEXT_TOP_Y = 372;
/** Width the text may take without running into the book or the moon. */
const TEXT_WIDTH = 520;

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
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
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
    // Toutes les lignes sont posées : le reste est tronqué plus bas. Sortir
    // une ligne plus tôt laissait la dernière avec un seul mot avant l'ellipse.
    if (lines.length === maxLines) break;
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
  /** The session name, usually who the session is for. */
  title: string;
  /** The kind of session, above the name (e.g. "Chaîne de Tehilim"). */
  label: string;
  /** The line in blue under the name (e.g. "Rejoignez la chaîne."). */
  callToAction: string;
};

/**
 * Small capitals the way the banners set them: the capitals of the text
 * (the first letter, a proper noun) at full size, every other letter in
 * capitals one size down. resvg does not synthesize the small capitals
 * Playfair has no glyphs for, so they are drawn by hand.
 */
export function smallCaps(text: string, size: number): string {
  const small = Math.round(size * 0.76);
  const runs: { big: boolean; text: string }[] = [];
  for (const char of text) {
    const big = char !== char.toLowerCase();
    const last = runs[runs.length - 1];
    if (last && last.big === big) last.text += char;
    else runs.push({ big, text: char });
  }
  return runs
    .map(({ big, text: run }) =>
      big
        ? `<tspan font-size="${size}">${esc(run)}</tspan>`
        : `<tspan font-size="${small}" letter-spacing="1">${esc(run.toUpperCase())}</tspan>`,
    )
    .join("");
}

/** The name: 40 px on two lines at most, 34 px on three when it is long. */
function nameLayout(title: string): { size: number; lines: string[] } {
  for (const [size, maxLines] of [
    [40, 2],
    [34, 3],
  ] as const) {
    // ~0.55em average advance for Manrope Medium and Noto Sans Hebrew.
    const maxChars = Math.floor(TEXT_WIDTH / (size * 0.55));
    const lines = wrapText(title, maxChars, maxLines);
    if (size === 34 || !lines[lines.length - 1].endsWith("…")) return { size, lines };
  }
  return { size: 34, lines: [title] };
}

/** The SVG of a card, over `background` (a data URL of the PNG). */
export function buildCardSvg(options: OgCardOptions, background: string): string {
  const { size, lines } = nameLayout(options.title);
  const lineHeight = Math.round(size * 1.25);
  const rtl = hasHebrew(options.title);
  const dir = rtl ? ' direction="rtl"' : "";
  const text = (y: number, content: string, fill: string, extra = "") =>
    `<text x="${CENTER_X}" y="${y}" text-anchor="middle" font-family="${FONT_TEXT}, ${FONT_HEBREW}" ` +
    `font-weight="500" font-size="${size}" fill="${fill}"${extra}>${esc(content)}</text>`;

  const nameLines = lines.map((line, i) => text(TEXT_TOP_Y + i * lineHeight, line, INK, dir));
  const callY = TEXT_TOP_Y + lines.length * lineHeight;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <image width="${WIDTH}" height="${HEIGHT}" href="${background}" xlink:href="${background}"/>
  <text x="${CENTER_X}" y="${LABEL_Y}" text-anchor="middle" font-family="${FONT_LABEL}" fill="${INK}">${smallCaps(options.label, 44)}</text>
  ${nameLines.join("\n  ")}
  ${text(callY, options.callToAction, BLUE)}
</svg>`;
}
