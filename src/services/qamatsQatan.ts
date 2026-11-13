/**
 * The qamats qatan of כׇּל, where the source writes a plain qamats.
 *
 * Some corpora mark the qamats read "o" with its own sign, U+05C7 (the
 * Tanakh, the Tehilim, the Talmud, part of the sidour); others write the
 * ordinary qamats (the Mishna, the Halakha, the Moussar, the rest of the
 * sidour). The reader then sees no difference, and the phonetics says
 * "kal" for "kol".
 *
 * Only one case is marked here, the only one that has no exception: the
 * word כל with a qamats, whatever its prefixes (וְכָל, בְּכָל, מִכָּל, שֶׁכָּל,
 * דְּכָל, כָּל־...), always reads "kol". The other qamatsim read "o" (חׇכְמָה,
 * the qamats before a hataf qamats...) depend on the word and its grammar:
 * הָאֳכָלִין or לָחֳדָשִׁים keep an "a", and a rule would get them wrong.
 *
 * The change replaces one character with another: a line keeps its length,
 * so every offset kept into it (selection, passage, bookmark) still holds.
 */

/** Everything that belongs to a word: letters and the signs placed on them. */
const WORD_CHAR = "\\u05D0-\\u05EA\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7";
/** The signs a prefix letter may carry. */
const PREFIX_MARKS = "[\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7]*";
/** On the kaf: teamim, qamats, dagesh, meteg, rafe; never another vowel. */
const KAF_MARKS = "[\\u0591-\\u05AF\\u05B8\\u05BC\\u05BD\\u05BF]*";
/** On the lamed: teamim and meteg only; a vowel makes another word (כָּלָה). */
const LAMED_MARKS = "[\\u0591-\\u05AF\\u05BD]*";

/**
 * Up to three prefix letters (ו, ב, ל, מ, ש, ה, כ and the Aramaic ד), then
 * כ with a qamats, then ל, then the end of the word.
 */
const KOL = new RegExp(
  `(^|[^${WORD_CHAR}])((?:[ובלמשהכד]${PREFIX_MARKS}){0,3})כ(${KAF_MARKS})ל(${LAMED_MARKS})(?![${WORD_CHAR}])`,
  "g",
);

const QAMATS = String.fromCharCode(0x05b8);
const QAMATS_QATAN = String.fromCharCode(0x05c7);

/** The line with the qamats of כָּל written as a qamats qatan (כׇּל). */
export function markQamatsQatan(line: string): string {
  if (!line.includes("כ")) return line;
  return line.replace(KOL, (all, before: string, prefix: string, kaf: string, lamed: string) =>
    kaf.includes(QAMATS) ? `${before}${prefix}כ${kaf.replace(QAMATS, QAMATS_QATAN)}ל${lamed}` : all,
  );
}
