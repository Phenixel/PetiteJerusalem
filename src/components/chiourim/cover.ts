/**
 * Les reliures des pochettes de cours (voir ChiourCover.vue) : des teintes
 * chaudes et mates de la famille des livres de l'étagère, hors du thème.
 * Elles portent toutes le crème de leur titre à plus de 4,5:1 (tenu par
 * src/__tests__/chiourCover.test.ts).
 */
export const COVER_TONES = [
  "#84483f", // terre cuite
  "#6d5743", // brun
  "#5f6b4f", // olive
  "#4f5d6b", // ardoise
  "#7d5a3c", // bronze
  "#6b4f5f", // prune
  "#4f6460", // vert de gris
  "#8a4f3a", // brique
];

/** Le crème des titres sur une pochette. */
export const COVER_INK = "#f6eedf";

/** Une teinte stable pour un identifiant : la même série a toujours la même pochette. */
export function coverTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return COVER_TONES[Math.abs(hash) % COVER_TONES.length];
}

/** Les mots qui ne font pas des initiales : « Rav », les articles, les numéros. */
const SKIPPED = new Set([
  "rav",
  "rabbi",
  "rabbin",
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "et",
  "d",
  "l",
]);

/**
 * Les initiales d'un titre de série ou d'un nom de rav : « Pélé Yoets » → PY,
 * « Rav Gad GuiGui » → GG, « Chaar Habita'hon » → CH. Un mot hébreu donne sa
 * première lettre.
 */
export function coverInitials(label: string): string {
  const words = label
    .split(/[\s\-\u2013:,'’.()]+/)
    .filter((w) => w && /\p{L}/u.test(w[0]) && !SKIPPED.has(w.toLowerCase()));
  const letters = words.slice(0, 2).map((w) => w[0].toUpperCase());
  return letters.join("") || label.trim().charAt(0).toUpperCase();
}
