/**
 * Generates public/texts/talmud-chapters.json by fetching raw (HTML) Talmud text
 * from Sefaria's GCS export and finding chapter boundaries.
 * Run: node scripts/generate-talmud-chapters.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const TALMUD_DIR = path.join(ROOT, "public/texts/talmud");
const OUTPUT = path.join(ROOT, "public/texts/talmud-chapters.json");
const GCS = "https://storage.googleapis.com/sefaria-export/json";

const SEDER_MAP = {
  berakhot: "Seder Zeraim",
  shabbat: "Seder Moed",
  eruvin: "Seder Moed",
  pesachim: "Seder Moed",
  shekalim: "Seder Moed",
  yoma: "Seder Moed",
  sukkah: "Seder Moed",
  beitzah: "Seder Moed",
  "rosh-hashanah": "Seder Moed",
  taanit: "Seder Moed",
  megillah: "Seder Moed",
  "moed-katan": "Seder Moed",
  chagigah: "Seder Moed",
  yevamot: "Seder Nashim",
  ketubot: "Seder Nashim",
  nedarim: "Seder Nashim",
  nazir: "Seder Nashim",
  sotah: "Seder Nashim",
  gittin: "Seder Nashim",
  kiddushin: "Seder Nashim",
  "bava-kamma": "Seder Nezikin",
  "bava-metzia": "Seder Nezikin",
  "bava-batra": "Seder Nezikin",
  sanhedrin: "Seder Nezikin",
  makkot: "Seder Nezikin",
  shevuot: "Seder Nezikin",
  "avodah-zarah": "Seder Nezikin",
  horayot: "Seder Nezikin",
  zevachim: "Seder Kodashim",
  menachot: "Seder Kodashim",
  chullin: "Seder Kodashim",
  bekhorot: "Seder Kodashim",
  arakhin: "Seder Kodashim",
  temurah: "Seder Kodashim",
  keritot: "Seder Kodashim",
  meilah: "Seder Kodashim",
  tamid: "Seder Kodashim",
  middot: "Seder Kodashim",
  kinnim: "Seder Kodashim",
  niddah: "Seder Tahorot",
};

function slugToGcsTitle(slug) {
  const overrides = {
    "rosh-hashanah": "Rosh Hashanah",
    "moed-katan": "Moed Katan",
    "bava-kamma": "Bava Kamma",
    "bava-metzia": "Bava Metzia",
    "bava-batra": "Bava Batra",
    "avodah-zarah": "Avodah Zarah",
  };
  if (overrides[slug]) return overrides[slug];
  return slug
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

function stripNikkud(s) {
  return s.replace(/[ְ-ׇ]/g, "");
}

function findChapterGcsIndices(textArr) {
  const starts = [];

  for (let i = 0; i < textArr.length; i++) {
    const daf = textArr[i];
    if (!daf || !daf.length) continue;

    for (let j = 0; j < daf.length; j++) {
      const raw = (daf[j] || "").trim();
      const stripped = stripNikkud(raw);

      // Pattern 1 - Chapter 1: first non-empty daf, line j=0, starts with <big><strong> and not gemara
      if (starts.length === 0 && j === 0 && raw.startsWith("<big><strong>") && !stripped.includes("גמ")) {
        starts.push(i);
        break;
      }

      // Pattern 2 - Most chapters: "מתני׳" (plain) then bold chapter title
      if (
        starts.length > 0 &&
        !stripped.startsWith("<big>") &&
        (stripped.startsWith("מתני") || stripped.startsWith("מתנ")) &&
        stripped.includes("<big><strong>")
      ) {
        starts.push(i);
        break;
      }

      // Pattern 3 - Some chapters: "הדרן עלך" end-of-chapter marker, next chapter on same/next daf
      if (raw.includes("הדרן")) {
        // Look for מתני following it in same daf
        let found = false;
        for (let k = j + 1; k < daf.length; k++) {
          const nl = stripNikkud((daf[k] || "").trim());
          if (nl.includes("מתני")) {
            starts.push(i);
            found = true;
            break;
          }
        }
        if (!found) starts.push(Math.min(i + 1, textArr.length - 1));
        break;
      }

      // Pattern 4 - Some chapters: bold matni at j=0 followed by bold gemara at j=1
      if (j === 0 && starts.length > 0) {
        const nextStripped = stripNikkud((daf[1] || "").trim());
        if (
          stripped.startsWith("<big><strong>") &&
          stripped.includes("מתני") &&
          nextStripped.startsWith("<big><strong>") &&
          nextStripped.includes("גמ")
        ) {
          starts.push(i);
          break;
        }
      }
    }
  }

  return starts;
}

function dafLabel(ourIdx) {
  const daf = Math.floor(ourIdx / 2) + 2;
  const side = ourIdx % 2 === 0 ? "a" : "b";
  return `${daf}${side}`;
}

function countLeadingEmpty(textArr) {
  let i = 0;
  while (i < textArr.length && (!textArr[i] || textArr[i].length === 0)) i++;
  return i;
}

// Also load mishna chapters for fallback proportional distribution
function getMishnaChapterSizes(slug) {
  const mishnaPath = path.join(ROOT, "public/texts/mishna", `${slug}.json`);
  if (!fs.existsSync(mishnaPath)) return null;
  const data = JSON.parse(fs.readFileSync(mishnaPath, "utf8"));
  return (data.he ?? []).map((ch) => (Array.isArray(ch) ? ch.length : 1));
}

function proportionalDistribution(totalDafs, chapterSizes) {
  const totalMishnayot = chapterSizes.reduce((a, b) => a + b, 0);
  const starts = [0];
  let acc = 0;
  for (let i = 0; i < chapterSizes.length - 1; i++) {
    acc += chapterSizes[i];
    starts.push(Math.round((acc / totalMishnayot) * totalDafs));
  }
  return starts;
}

const result = {};
const slugs = Object.keys(SEDER_MAP);

console.log(`Processing ${slugs.length} tractates...\n`);

for (const slug of slugs) {
  const seder = SEDER_MAP[slug];
  const title = slugToGcsTitle(slug);
  const url = `${GCS}/Talmud/Bavli/${encodeURIComponent(seder)}/${encodeURIComponent(title)}/Hebrew/merged.json`;

  const localPath = path.join(TALMUD_DIR, `${slug}.json`);
  if (!fs.existsSync(localPath)) {
    console.warn(`⚠ ${title}: local file not found, skipping`);
    result[slug] = [];
    continue;
  }

  const localData = JSON.parse(fs.readFileSync(localPath, "utf8"));
  const ourTotal = (localData.he ?? []).length;
  const mishnaSizes = getMishnaChapterSizes(slug);

  try {
    const data = await fetchJson(url);
    const textArr = data.text ?? [];
    const leadingEmpty = countLeadingEmpty(textArr);
    const gcsStarts = findChapterGcsIndices(textArr);
    const ourStarts = gcsStarts.map((gcsIdx) => Math.max(0, gcsIdx - leadingEmpty));

    const expected = mishnaSizes ? mishnaSizes.length : "?";
    const detected = ourStarts.length;

    let finalStarts = ourStarts;
    if (mishnaSizes && detected !== mishnaSizes.length) {
      // Fallback: proportional distribution
      console.warn(`  ⚠ ${title}: detected ${detected} chapters, expected ${expected}, using proportional fallback`);
      finalStarts = proportionalDistribution(ourTotal, mishnaSizes);
    }

    const chapters = finalStarts.map((startIdx, i) => {
      const endIdx =
        i + 1 < finalStarts.length ? finalStarts[i + 1] - 1 : ourTotal - 1;
      return {
        chapter: i + 1,
        startDaf: dafLabel(startIdx),
        endDaf: dafLabel(endIdx),
        startIdx,
        endIdx,
      };
    });

    result[slug] = chapters;
    const status = detected === expected ? "✓" : "~";
    console.log(`${status} ${title}: ${chapters.length} chapters`);
  } catch (e) {
    // GCS fetch failed (Shekalim uses Yerushalmi, Middot/Kinnim are Mishna-only)
    if (mishnaSizes && ourTotal > 0) {
      const finalStarts = proportionalDistribution(ourTotal, mishnaSizes);
      const chapters = finalStarts.map((startIdx, i) => {
        const endIdx =
          i + 1 < finalStarts.length ? finalStarts[i + 1] - 1 : ourTotal - 1;
        return {
          chapter: i + 1,
          startDaf: dafLabel(startIdx),
          endDaf: dafLabel(endIdx),
          startIdx,
          endIdx,
        };
      });
      result[slug] = chapters;
      console.log(`~ ${title}: ${chapters.length} chapters (proportional, fetch failed: ${e.message.substring(0, 40)})`);
    } else {
      console.error(`✗ ${title}: ${e.message.substring(0, 50)}`);
      result[slug] = [];
    }
  }

  await new Promise((r) => setTimeout(r, 80));
}

fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
console.log(`\nWrote ${OUTPUT}`);
