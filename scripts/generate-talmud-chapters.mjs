/**
 * Generates public/texts/talmud-chapters.json: where each chapter (perek) of
 * each Bavli tractate starts and ends, as indices of public/texts/talmud/
 * (index 0 = 2a, 1 = 2b, 2 = 3a...).
 *
 * Run with: node scripts/generate-talmud-chapters.mjs
 *           node scripts/generate-talmud-chapters.mjs --check  (CI: is the file up to date?)
 *
 * The boundaries are read from the local files, not guessed:
 *
 *  1. Every chapter of the Vilna text closes with « הדרן עלך ». The next
 *     chapter starts on that same amud when its mishna follows the marker
 *     there, otherwise on the next amud.
 *  2. A few markers are missing from the corpus (Bava Kamma 1, Sanhedrin 5,
 *     Horayot 2). For those, the opening words of the chapter's first
 *     mishna (public/texts/mishna/) are looked up after « מתני׳ »; a match
 *     is only used when it is the only one in the tractate.
 *  3. The number of chapters found must be that of the Mishna. Otherwise the
 *     script stops: it used to fall back silently on a split proportional to
 *     the number of mishnayot, which put every boundary of every tractate
 *     several dafim away from the real one (Berakhot 2 read from 7b instead
 *     of 13a).
 *
 * The ranges are contiguous, without overlap: the amud where a chapter ends
 * and the next one begins belongs to the new chapter, so that each chapter
 * opens on its mishna. Mon parcours counts amudim from the first one, so
 * moving a boundary does not move anyone's place in a program.
 *
 * Shekalim (Yerushalmi), Middot and Kinnim (Mishna only) are stored one
 * entry per chapter: their ranges are one entry each, without daf.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TALMUD_DIR = path.join(ROOT, "public/texts/talmud");
const MISHNA_DIR = path.join(ROOT, "public/texts/mishna");
const OUTPUT = path.join(ROOT, "public/texts/talmud-chapters.json");

/** The tractates, in the order of the file (that of the Shas). */
const TRACTATES = [
  "berakhot",
  "shabbat",
  "eruvin",
  "pesachim",
  "shekalim",
  "yoma",
  "sukkah",
  "beitzah",
  "rosh-hashanah",
  "taanit",
  "megillah",
  "moed-katan",
  "chagigah",
  "yevamot",
  "ketubot",
  "nedarim",
  "nazir",
  "sotah",
  "gittin",
  "kiddushin",
  "bava-kamma",
  "bava-metzia",
  "bava-batra",
  "sanhedrin",
  "makkot",
  "shevuot",
  "avodah-zarah",
  "horayot",
  "zevachim",
  "menachot",
  "chullin",
  "bekhorot",
  "arakhin",
  "temurah",
  "keritot",
  "meilah",
  "tamid",
  "middot",
  "kinnim",
  "niddah",
];

/** Hebrew letters and spaces only: no vowels, cantillation, tags or punctuation. */
function plain(text) {
  return String(text ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/[֑-ׇ]/g, "")
    .replace(/[^א-ת ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The lines of one amud, flattened and reduced to plain letters. */
function amudLines(amud) {
  return Array.isArray(amud) ? amud.flat(Infinity).map(plain) : [];
}

function dafLabel(index) {
  return `${Math.floor(index / 2) + 2}${index % 2 === 0 ? "a" : "b"}`;
}

/** Where chapters 2 and following start, from the « הדרן עלך » markers. */
function startsFromHadran(amudim) {
  const starts = [];
  amudim.forEach((amud, i) => {
    const lines = amudLines(amud);
    lines.forEach((line, j) => {
      if (!line.startsWith("הדרן עלך")) return;
      const followed = lines.slice(j + 1).some((next) => next && !next.startsWith("הדרן"));
      starts.push(followed ? i : i + 1);
    });
  });
  // The last marker closes the tractate.
  return starts.filter((start) => start < amudim.length);
}

/** Where a chapter starts, from the opening words of its first mishna; null if not unique. */
function startFromMishna(amudim, chapter) {
  const first = plain(Array.isArray(chapter) ? chapter[0] : chapter)
    .split(" ")
    .slice(0, 3)
    .join(" ");
  if (!first) return null;
  const hits = new Set();
  amudim.forEach((amud, i) => {
    if (amudLines(amud).some((line) => line.startsWith(`מתני ${first}`))) hits.add(i);
  });
  return hits.size === 1 ? [...hits][0] : null;
}

function chapterRanges(slug) {
  const amudim = JSON.parse(fs.readFileSync(path.join(TALMUD_DIR, `${slug}.json`), "utf8")).he;
  const mishna = JSON.parse(fs.readFileSync(path.join(MISHNA_DIR, `${slug}.json`), "utf8")).he;
  const count = mishna.length;

  // Stored one entry per chapter: nothing to find.
  if (amudim.length === count) {
    return amudim.map((_, i) => ({ chapter: i + 1, startIdx: i, endIdx: i }));
  }

  const first = amudim.findIndex((amud) => amudLines(amud).some(Boolean));
  const starts = new Set([first, ...startsFromHadran(amudim)]);
  if (starts.size < count) {
    for (const chapter of mishna.slice(1)) {
      const start = startFromMishna(amudim, chapter);
      if (start !== null) starts.add(start);
    }
  }
  const sorted = [...starts].sort((a, b) => a - b);
  if (sorted.length !== count) {
    throw new Error(
      `${slug}: ${sorted.length} chapter starts found (${sorted.map(dafLabel).join(", ")}), ` +
        `the Mishna has ${count} chapters`,
    );
  }
  // The first chapter starts at the top of the file, even before its first line.
  sorted[0] = 0;
  return sorted.map((startIdx, i) => {
    const endIdx = i + 1 < sorted.length ? sorted[i + 1] - 1 : amudim.length - 1;
    return {
      chapter: i + 1,
      startDaf: dafLabel(startIdx),
      endDaf: dafLabel(endIdx),
      startIdx,
      endIdx,
    };
  });
}

const result = {};
for (const slug of TRACTATES) result[slug] = chapterRanges(slug);
const serialized = `${JSON.stringify(result, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf8") : null;
  if (current !== serialized) {
    console.error(
      "generate-talmud-chapters: public/texts/talmud-chapters.json no longer matches the texts.\n" +
        "Run « node scripts/generate-talmud-chapters.mjs » and commit the result.",
    );
    process.exit(1);
  }
  console.log("generate-talmud-chapters: up to date.");
} else {
  fs.writeFileSync(OUTPUT, serialized);
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)} (${TRACTATES.length} tractates).`);
}
