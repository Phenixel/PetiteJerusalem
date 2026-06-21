/**
 * Best-effort phonetic transliteration of vocalized (niqqud) Hebrew into Latin,
 * tuned for a French reader (sh→"ch", ḥet→"'h", shuruk→"ou", etc.).
 *
 * A reading aid, not a standard: subtle rules (mobile vs silent sheva, matres
 * lectionis) are approximated. Only meaningful on pointed text (see hasNiqqud);
 * unpointed Talmud is returned unchanged.
 */

// Vowel points (sheva → qubuts, plus qamats qatan): their presence means "vocalized".
const NIQQUD = /[ְ-ׇּׁׂ]/;

export function hasNiqqud(text: string): boolean {
  return NIQQUD.test(text);
}

// Marks dropped before parsing: cantillation (te'amim), meteg, rafe, paseq, dots,
// and bidi/zero-width controls. Never the niqqud we keep (U+05B0–U+05BC, U+05C1/2/7).
const STRIP = /[֑-ֽֿ֯׀ׅׄ׆׈-׏​-‏]/g;

const SHEVA = "ְ";
const DAGESH = "ּ";
const SIN_DOT = "ׂ";
const HOLAM = "ֹ";
const HOLAM_VAV = "ֺ";

// Matres lectionis: silent when they carry no mark.
const MATER = new Set(["א", "ה", "ו", "י"]);

// Base consonant sound (without dagesh).
const BASE: Record<string, string> = {
  "א": "",
  "ב": "v",
  "ג": "g",
  "ד": "d",
  "ה": "h",
  "ו": "v",
  "ז": "z",
  "ח": "'h",
  "ט": "t",
  "י": "y",
  "ך": "kh",
  "כ": "kh",
  "ל": "l",
  "ם": "m",
  "מ": "m",
  "ן": "n",
  "נ": "n",
  "ס": "s",
  "ע": "",
  "ף": "f",
  "פ": "f",
  "ץ": "ts",
  "צ": "ts",
  "ק": "k",
  "ר": "r",
  "ש": "ch",
  "ת": "t",
};

// Begadkefat letters with dagesh → plosive.
const PLOSIVE: Record<string, string> = {
  "ב": "b",
  "כ": "k",
  "ך": "k",
  "פ": "p",
  "ף": "p",
};

// Vowels, keyed by niqqud code point (French rendering: "ou" for shuruk/qubuts, "é" for tsere).
const VOWEL: Record<string, string> = {
  "ַ": "a", // patah
  "ָ": "a", // qamats
  "ֶ": "e", // segol
  "ֵ": "é", // tsere
  "ִ": "i", // hiriq
  "ֹ": "o", // holam
  "ֺ": "o", // holam vav
  "ֻ": "ou", // qubuts
  "ׇ": "o", // qamats qatan
  "ֱ": "e", // hataf segol
  "ֲ": "a", // hataf patah
  "ֳ": "o", // hataf qamats
};

function isLetter(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return c >= 0x05d0 && c <= 0x05ea;
}

function isMark(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x05b0 && c <= 0x05bc) || c === 0x05c1 || c === 0x05c2 || c === 0x05c7;
}

function vowelOf(marks: Set<string>): string | null {
  for (const m of marks) {
    const v = VOWEL[m];
    if (v !== undefined) return v;
  }
  return null;
}

function renderCluster(
  base: string,
  marks: Set<string>,
  wordStart: boolean,
  prevHadSheva: boolean,
): string {
  const hasDagesh = marks.has(DAGESH);

  // Vav acting as a vowel: holam → "o", shuruk (vav + dagesh, no vowel) → "ou".
  if (base === "ו") {
    if (marks.has(HOLAM) || marks.has(HOLAM_VAV)) return "o";
    if (hasDagesh && vowelOf(marks) === null) return "ou";
  }

  // Bare mater lectionis (no marks) mid/end of word → silent.
  if (marks.size === 0 && MATER.has(base) && !wordStart) return "";

  let cons: string;
  if (base === "ש") {
    cons = marks.has(SIN_DOT) ? "s" : "ch"; // sin vs shin
  } else if (hasDagesh && PLOSIVE[base] !== undefined) {
    cons = PLOSIVE[base];
  } else {
    cons = BASE[base] ?? "";
  }

  let vowel = vowelOf(marks) ?? "";
  if (vowel === "" && marks.has(SHEVA)) {
    // Mobile sheva (pronounced "e"): word start, second of two shevas, or under dagesh.
    if (wordStart || prevHadSheva || hasDagesh) vowel = "e";
  }

  return cons + vowel;
}

function mapPunct(ch: string): string {
  switch (ch) {
    case "־":
      return "-"; // maqaf
    case "׃":
      return "."; // sof pasuq
    case "׳":
      return "'"; // geresh
    case "״":
      return '"'; // gershayim
    default:
      return ch;
  }
}

/**
 * Transliterate one line of vocalized Hebrew into Latin phonetics.
 * Returns the input unchanged when it has no niqqud.
 */
export function transliterate(input: string): string {
  if (!hasNiqqud(input)) return input;

  const text = input.replace(STRIP, "");
  let out = "";
  let i = 0;
  let wordStart = true;
  let prevHadSheva = false;

  while (i < text.length) {
    const ch = text[i];
    if (isLetter(ch)) {
      const marks = new Set<string>();
      let j = i + 1;
      while (j < text.length && isMark(text[j])) {
        marks.add(text[j]);
        j++;
      }
      out += renderCluster(ch, marks, wordStart, prevHadSheva);
      prevHadSheva = marks.has(SHEVA);
      wordStart = false;
      i = j;
    } else {
      out += mapPunct(ch);
      wordStart = true;
      prevHadSheva = false;
      i++;
    }
  }

  return out.replace(/ {2,}/g, " ").trim();
}
