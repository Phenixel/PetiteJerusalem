import { HDate } from "@hebcal/core";
import textStudiesJson from "../datas/textStudies.json";
import unitsJson from "../datas/parcoursUnits.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { hebrewName, latinTexteName, texteRoute } from "./chiourTexte";
import { toHebrewNumeral } from "./hebrewNumerals";

/**
 * The Daf Yomi: one daf of the Babylonian Talmud a day, the whole Shas in
 * 2,711 days (seven and a half years).
 *
 * The schedule is the one hebcal publishes (its `DafYomi` class, which
 * @hebcal/core 6 no longer ships): the seventh cycle ended on 23 June 1975,
 * and since the eighth every cycle lasts 2,711 days, Shekalim counting its 22
 * dapim of the Vilna edition. The fourteenth cycle began on 5 January 2020
 * with Berakhot 2 and ends on 7 June 2027 with Niddah 73.
 *
 * The daf is numbered as the printed Shas numbers it (Kinnim 23 to 25, Tamid
 * 26 to 34, Middot 34 to 36: these three follow Meilah in the same volume).
 * The reader numbers every tractate from 2a: the reading place (`readerDaf`)
 * counts from the start of the tractate.
 */

/** The tractates in Daf Yomi order, by their Sefaria slug, with their last daf. */
const SHAS: readonly (readonly [slug: string, last: number])[] = [
  ["Berakhot", 64],
  ["Shabbat", 157],
  ["Eruvin", 105],
  ["Pesachim", 121],
  ["Shekalim", 22],
  ["Yoma", 88],
  ["Sukkah", 56],
  ["Beitzah", 40],
  ["Rosh_Hashanah", 35],
  ["Taanit", 31],
  ["Megillah", 32],
  ["Moed_Katan", 29],
  ["Chagigah", 27],
  ["Yevamot", 122],
  ["Ketubot", 112],
  ["Nedarim", 91],
  ["Nazir", 66],
  ["Sotah", 49],
  ["Gittin", 90],
  ["Kiddushin", 82],
  ["Bava_Kamma", 119],
  ["Bava_Metzia", 119],
  ["Bava_Batra", 176],
  ["Sanhedrin", 113],
  ["Makkot", 24],
  ["Shevuot", 49],
  ["Avodah_Zarah", 76],
  ["Horayot", 14],
  ["Zevachim", 120],
  ["Menachot", 110],
  ["Chullin", 142],
  ["Bekhorot", 61],
  ["Arakhin", 34],
  ["Temurah", 34],
  ["Keritot", 28],
  ["Meilah", 22],
  ["Kinnim", 4],
  ["Tamid", 10],
  ["Middot", 4],
  ["Niddah", 73],
];

/** Kinnim, Tamid and Middot are printed after Meilah: the Shas numbers them on from there. */
const PRINTED_OFFSET: Record<string, number> = { Kinnim: 21, Tamid: 24, Middot: 32 };

/** The days of a cycle since the eighth. */
export const DAF_YOMI_CYCLE_DAYS = SHAS.reduce((sum, [, last]) => sum + last - 1, 0);

/** The first day of the eighth cycle, 24 June 1975 (absolute day number). */
const CYCLE_8_START = new HDate(new Date(1975, 5, 24)).abs();

/** "https://www.sefaria.org/Rosh Hashanah" gives "Rosh_Hashanah". */
const slugOf = (entry: TextStudyJsonEntry): string =>
  (entry.link.split("/").pop() ?? "").replace(/ /g, "_");

const talmud = new Map<string, TextStudyJsonEntry>();
for (const entry of (textStudiesJson as TextStudiesJson).textStudies) {
  if (String(entry.type) === "Talmud Bavli") talmud.set(slugOf(entry), entry);
}

type AmudUnits = { unit: "amud"; sizes: number[]; first: number };
const UNITS = unitsJson as Record<string, { unit: string }>;

export interface DafYomi {
  /** The cycle, from the first (1923). */
  cycle: number;
  /** The tractate in the catalog. */
  entry: TextStudyJsonEntry;
  /** The daf as the printed Shas numbers it (Tamid 27). */
  daf: number;
  /** The same daf counted from the start of the tractate, as the reader numbers it (Tamid 3). */
  readerDaf: number;
}

/** The daf of a civil date, or null before the eighth cycle or for a tractate the catalog lacks. */
export function dafYomiOn(date: Date): DafYomi | null {
  const day = new HDate(date).abs() - CYCLE_8_START;
  if (day < 0) return null;
  const cycle = 8 + Math.floor(day / DAF_YOMI_CYCLE_DAYS);
  let rest = day % DAF_YOMI_CYCLE_DAYS;
  for (const [slug, last] of SHAS) {
    const count = last - 1;
    if (rest < count) {
      const entry = talmud.get(slug);
      if (!entry) return null;
      const readerDaf = rest + 2;
      return { cycle, entry, daf: readerDaf + (PRINTED_OFFSET[slug] ?? 0), readerDaf };
    }
    rest -= count;
  }
  return null;
}

/** "Berakhot 12", or "ברכות י״ב" in Hebrew. */
export function dafYomiLabel(daf: DafYomi, locale: string): string {
  return locale === "he"
    ? `${hebrewName(daf.entry)} ${toHebrewNumeral(daf.daf)}`
    : `${latinTexteName(daf.entry)} ${daf.daf}`;
}

/**
 * Where the daf opens in the library: the chapter that holds its first side,
 * and `?daf=12a` for the reader to go down to it. Shekalim is the Jerusalem
 * Talmud, read chapter by chapter with no daf to land on: its chapter list
 * opens.
 */
export function dafYomiRoute(daf: DafYomi): { path: string; query?: Record<string, string> } {
  const units = UNITS[String(daf.entry.id)];
  if (units?.unit !== "amud" || slugOf(daf.entry) === "Shekalim") {
    return texteRoute(daf.entry, null);
  }
  const { sizes, first } = units as AmudUnits;
  const total = sizes.reduce((sum, n) => sum + n, 0);
  // The side "a" of the daf, counted from 2a; past the last side, the last.
  const amud = Math.min(Math.max(0, (daf.readerDaf - 2) * 2 - first), total - 1);
  let rest = amud;
  let chapter = sizes.length;
  for (let i = 0; i < sizes.length; i++) {
    if (rest < sizes[i]) {
      chapter = i + 1;
      break;
    }
    rest -= sizes[i];
  }
  const route = texteRoute(daf.entry, chapter);
  return { ...route, query: { ...route.query, daf: `${daf.readerDaf}a` } };
}
