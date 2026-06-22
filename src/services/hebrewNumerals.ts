/**
 * Hebrew numerals (gematria) for chapter / psalm numbers.
 *
 * Texts here are numbered with Arabic digits ("Tehilim 119", "Chapitre 5"), but
 * Hebrew sources traditionally number them with letters (תהילים קי״ט). This renders
 * that traditional form next to the digits as a reading aid for Hebrew readers.
 *
 * Single-letter values are left bare (5 → ה); multi-letter values take a gershayim
 * before the last letter (119 → קי״ט) so they read as a number rather than a word.
 * 15 and 16 are written ט״ו / ט״ז rather than יה / יו, which spell parts of the
 * divine name.
 */

const UNITS = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
const TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
// Index 0–4 → 0, 100, 200, 300, 400. Higher hundreds stack onto ת (400).
const HUNDREDS = ["", "ק", "ר", "ש", "ת"];

const GERSHAYIM = "״";

/** Hebrew letters for a number 1–999, with 15/16 written ט״ו/ט״ז (not יה/יו). */
function lettersFor(n: number): string {
  const hundreds = Math.floor(n / 100);
  let out = "ת".repeat(Math.floor(hundreds / 4)) + HUNDREDS[hundreds % 4];
  const rest = n % 100;
  if (rest === 15) return out + "טו";
  if (rest === 16) return out + "טז";
  out += TENS[Math.floor(rest / 10)] + UNITS[rest % 10];
  return out;
}

/** Converts a positive integer to its Hebrew numeral (gematria). Other values pass through. */
export function toHebrewNumeral(n: number): string {
  if (!Number.isInteger(n) || n <= 0) return String(n);
  const letters = lettersFor(n);
  if (letters.length === 1) return letters;
  return letters.slice(0, -1) + GERSHAYIM + letters.slice(-1);
}

/** "5" → "5 (ה)": Arabic number with its Hebrew numeral in parentheses. */
export function formatNumberWithHebrew(n: number): string {
  return `${n} (${toHebrewNumeral(n)})`;
}

/** Appends the Hebrew numeral to a name ending in a number ("Tehilim 5" → "Tehilim 5 (ה)"). */
export function appendHebrewNumeral(name: string): string {
  const match = name.match(/(\d+)\s*$/);
  if (!match) return name;
  return `${name} (${toHebrewNumeral(Number(match[1]))})`;
}
