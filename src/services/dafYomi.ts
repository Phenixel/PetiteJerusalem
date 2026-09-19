import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";

/**
 * Le Daf hayomi : la page du Talmud de Babylone que le monde entier étudie le
 * même jour, un daf par jour, tout le Chas en sept ans et demi.
 *
 * Le calcul est celui de hebcal (dafyomi.c, repris par @hebcal/learning, que
 * l'application n'embarque pas : quarante nombres suffisent). Chaque traité
 * commence au daf 2 (le daf 1 est la page de titre de l'édition de Vilna) et
 * compte donc `dernier daf - 1` jours. Depuis le huitième cycle (24 juin
 * 1975), Chekalim se lit en 22 dafs et un cycle dure 2711 jours ; le
 * quatorzième cycle a commencé le 5 janvier 2020. Les cycles antérieurs,
 * plus courts (Chekalim en 13 dafs), ne concernent aucun lecteur de
 * l'application : avant 1975, on ne répond rien.
 *
 * Les traités sont nommés comme dans le catalogue (textStudies.json, graphie
 * de Sefaria) : le daf du jour s'y retrouve directement.
 */

/** Les traités dans l'ordre du cycle, avec leur dernier daf. */
const SHAS: [string, number][] = [
  ["Berakhot", 64],
  ["Shabbat", 157],
  ["Eruvin", 105],
  ["Pesachim", 121],
  ["Shekalim", 22],
  ["Yoma", 88],
  ["Sukkah", 56],
  ["Beitzah", 40],
  ["Rosh Hashanah", 35],
  ["Taanit", 31],
  ["Megillah", 32],
  ["Moed Katan", 29],
  ["Chagigah", 27],
  ["Yevamot", 122],
  ["Ketubot", 112],
  ["Nedarim", 91],
  ["Nazir", 66],
  ["Sotah", 49],
  ["Gittin", 90],
  ["Kiddushin", 82],
  ["Bava Kamma", 119],
  ["Bava Metzia", 119],
  ["Bava Batra", 176],
  ["Sanhedrin", 113],
  ["Makkot", 24],
  ["Shevuot", 49],
  ["Avodah Zarah", 76],
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

/**
 * Kinnim, Tamid et Middot suivent la pagination de Meïla dans l'édition de
 * Vilna : le Daf hayomi les annonce « Kinnim 23 », « Tamid 26 », « Middot 34 ».
 * Les fichiers de la bibliothèque, eux, les numérotent depuis 2 : le décalage
 * ramène au daf du fichier.
 */
const VILNA_OFFSET: Record<string, number> = { Kinnim: 21, Tamid: 24, Middot: 32 };

/** Durée d'un cycle, en jours, depuis le huitième. */
export const DAF_YOMI_CYCLE_DAYS = 2711;

/** Le 5 janvier 2020, premier jour du quatorzième cycle (Berakhot 2). */
const CYCLE_14_START = Date.UTC(2020, 0, 5);
/** Le 24 juin 1975, premier jour du huitième cycle : avant lui, le calcul ne vaut pas. */
const CYCLE_8_START = Date.UTC(1975, 5, 24);

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;

/** « https://www.sefaria.org/Rosh_Hashanah » → « Rosh Hashanah ». */
const tractateOfLink = (link: string): string =>
  (String(link).split("/").pop() ?? "").replace(/_/g, " ");

const tractateEntries = new Map<string, TextStudyJsonEntry>();
for (const entry of allTexts) {
  if (String(entry.type) === "Talmud Bavli") tractateEntries.set(tractateOfLink(entry.link), entry);
}

export interface DafYomi {
  /** Le traité, tel que le nomme le catalogue (« Berakhot »). */
  tractate: string;
  /** Le daf annoncé (« Berakhot 12 »), dans la numérotation de Vilna. */
  blatt: number;
  /** Numéro du cycle (le quatorzième a commencé le 5 janvier 2020). */
  cycle: number;
  /** L'entrée du catalogue, null si le traité n'y est pas. */
  entry: TextStudyJsonEntry | null;
  /**
   * Les deux faces du daf dans la numérotation du fichier (« 12a », « 12b »),
   * celle que portent les blocs de TalmudDafText.
   */
  dafs: string[];
}

/** Le jour civil local en jours depuis l'époque, sans heure ni fuseau. */
function localDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/**
 * Le daf du jour civil de `date`, ou null avant le huitième cycle.
 *
 * Le Daf hayomi change à minuit, comme le suivi de la lecture du jour ; c'est
 * le jour civil local qui compte, pas le jour hébraïque.
 */
export function getDafYomi(date: Date = new Date()): DafYomi | null {
  const day = localDayNumber(date);
  if (day < CYCLE_8_START / 86_400_000) return null;
  const sinceCycle14 = day - CYCLE_14_START / 86_400_000;
  const cycle = 14 + Math.floor(sinceCycle14 / DAF_YOMI_CYCLE_DAYS);
  // Modulo positif : les cycles d'avant 2020 se comptent à rebours.
  const dayInCycle =
    ((sinceCycle14 % DAF_YOMI_CYCLE_DAYS) + DAF_YOMI_CYCLE_DAYS) % DAF_YOMI_CYCLE_DAYS;

  let total = 0;
  for (const [tractate, lastDaf] of SHAS) {
    total += lastDaf - 1;
    if (dayInCycle < total) {
      const inFile = lastDaf + 1 - (total - dayInCycle);
      const blatt = inFile + (VILNA_OFFSET[tractate] ?? 0);
      return {
        tractate,
        blatt,
        cycle,
        entry: tractateEntries.get(tractate) ?? null,
        dafs: [`${inFile}a`, `${inFile}b`],
      };
    }
  }
  // Inatteignable : les quarante traités couvrent exactement le cycle.
  return null;
}

/** Les traités du cycle, pour qui veut vérifier que le catalogue les a tous. */
export const DAF_YOMI_TRACTATES: readonly string[] = SHAS.map(([name]) => name);

/** Le dernier daf d'un traité, dans la numérotation de Vilna. */
export function lastDafOf(tractate: string): number {
  const found = SHAS.find(([name]) => name === tractate);
  return found ? found[1] + (VILNA_OFFSET[tractate] ?? 0) : 0;
}

/** Vrai le jour du dernier daf d'un traité : le jour du siyoum. */
export function isLastDafOf(daf: DafYomi): boolean {
  return daf.blatt === lastDafOf(daf.tractate);
}

/** Où l'on en est : dans le traité (dafs faits sur dafs du traité) et dans le cycle. */
export interface DafProgress {
  /** Rang du daf dans le traité (1 au premier daf). */
  dafIndex: number;
  /** Nombre de dafs du traité. */
  dafCount: number;
  /** Rang du jour dans le cycle (1..2711). */
  cycleDay: number;
  cycleDays: number;
}

export function dafProgress(daf: DafYomi): DafProgress {
  const first = 2 + (VILNA_OFFSET[daf.tractate] ?? 0);
  const last = lastDafOf(daf.tractate);
  let before = 0;
  for (const [name, lastDaf] of SHAS) {
    if (name === daf.tractate) break;
    before += lastDaf - 1;
  }
  return {
    dafIndex: daf.blatt - first + 1,
    dafCount: last - first + 1,
    cycleDay: before + (daf.blatt - first) + 1,
    cycleDays: DAF_YOMI_CYCLE_DAYS,
  };
}
