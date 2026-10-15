import textStudiesJson from "../../datas/textStudies.json";
import unitsJson from "../../datas/parcoursUnits.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../../models/models";
import { corpusOf } from "../../content/etudeTexts";
import { hebrewName, latinTexteName, texteOf, texteRoute } from "../chiourTexte";
import type { ProgramCorpus, ProgramObjective, ProgramPart, UnitKind } from "./model";

/**
 * Les textes qu'un programme peut finir, et ce qu'ils comptent.
 *
 * Un programme garde la liste de ses textes et son total d'unités ; tout le
 * reste (où tombe la 1 234e michna, comment l'écrire, où l'ouvrir) se déduit
 * d'ici, à partir de src/datas/parcoursUnits.json, que tient
 * scripts/parcours-units.mjs.
 */

const entries = (textStudiesJson as TextStudiesJson).textStudies;

type UnitsEntry =
  | { unit: "mishna"; sizes: number[] }
  | { unit: "amud"; sizes: number[]; first: number }
  | { unit: "chapter"; count: number };

const UNITS = unitsJson as Record<string, UnitsEntry>;

/** Les six ordres de la Michna et du Talmud, dans l'ordre. */
export type SederId = "zeraim" | "moed" | "nachim" | "nezikin" | "kodachim" | "toharot";

export const SEDARIM: readonly SederId[] = [
  "zeraim",
  "moed",
  "nachim",
  "nezikin",
  "kodachim",
  "toharot",
];

/** Le livre du catalogue qui porte un séder (« מועד (Moed) »), par son nom latin. */
const SEDER_OF_LIVRE: Record<string, SederId> = {
  Zeraim: "zeraim",
  Moed: "moed",
  Nashim: "nachim",
  Nezikin: "nezikin",
  Kodashim: "kodachim",
  Toharot: "toharot",
};

/** Le séder d'une entrée de la Michna ou du Talmud. */
export function sederOf(entry: TextStudyJsonEntry): SederId | null {
  const latin = entry.livre.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() ?? "";
  return SEDER_OF_LIVRE[latin] ?? null;
}

/** Le corpus de programme d'une entrée, ou null si elle ne se finit pas ici. */
export function programCorpusOf(entry: TextStudyJsonEntry): ProgramCorpus | null {
  const corpus = corpusOf(entry);
  if (corpus === "tehilim") return "tehilim";
  if (corpus === "michna" || corpus === "talmud" || corpus === "tanakh") {
    return UNITS[String(entry.id)] ? corpus : null;
  }
  return null;
}

/** Les textes d'un corpus qu'on peut se donner à finir, dans l'ordre du catalogue. */
export function programTexts(corpus: ProgramCorpus): TextStudyJsonEntry[] {
  // Le livre des Tehilim figure aussi parmi les Ketouvim : il se finit par ses psaumes.
  return entries.filter((e) => programCorpusOf(e) === corpus && !isKetuvimTehilim(e));
}

const isKetuvimTehilim = (entry: TextStudyJsonEntry): boolean =>
  corpusOf(entry) === "tanakh" && latinTexteName(entry) === "Tehillim";

/** Les textes d'un séder, dans l'ordre. */
export function sederTexts(corpus: "michna" | "talmud", seder: SederId): TextStudyJsonEntry[] {
  return programTexts(corpus).filter((e) => sederOf(e) === seder);
}

/** L'unité des portions d'un corpus. */
export function unitOf(corpus: ProgramCorpus): UnitKind {
  switch (corpus) {
    case "michna":
      return "mishna";
    case "talmud":
      return "amud";
    case "tanakh":
      return "chapter";
    case "tehilim":
      return "psalm";
  }
}

/** Les unités d'un texte, chapitre par chapitre (un psaume : un seul chapitre d'une unité). */
export function chapterSizes(textId: number): number[] {
  const units = UNITS[String(textId)];
  if (!units) return texteOf(textId) && corpusOf(texteOf(textId)!) === "tehilim" ? [1] : [];
  return units.unit === "chapter" ? Array.from({ length: units.count }, () => 1) : units.sizes;
}

/** Les unités d'un texte au total. */
export function textTotal(textId: number): number {
  return chapterSizes(textId).reduce((sum, n) => sum + n, 0);
}

/**
 * Les textes d'une sélection, dans l'ordre de lecture et sans doublon : un
 * séder donne ses traités, un traité déjà compris dans un séder pris ne se
 * lit pas deux fois. « all » donne tout le corpus.
 */
export function resolveParts(corpus: ProgramCorpus, parts: ProgramPart[]): number[] {
  const wanted = new Set<number>();
  for (const part of parts) {
    if (part === "all") programTexts(corpus).forEach((e) => wanted.add(Number(e.id)));
    else if (part.startsWith("seder:") && (corpus === "michna" || corpus === "talmud")) {
      const seder = part.slice("seder:".length) as SederId;
      sederTexts(corpus, seder).forEach((e) => wanted.add(Number(e.id)));
    } else if (part.startsWith("text:")) {
      const id = Number(part.slice("text:".length));
      const entry = texteOf(id);
      if (entry && programCorpusOf(entry) === corpus) wanted.add(id);
    }
  }
  // L'ordre du catalogue est l'ordre de lecture (et celui des psaumes).
  return programTexts(corpus)
    .map((e) => Number(e.id))
    .filter((id) => wanted.has(id));
}

/** Le total d'unités d'une liste de textes. */
export const totalOf = (texts: number[]): number =>
  texts.reduce((sum, id) => sum + textTotal(id), 0);

/** Où tombe une unité : son texte, son chapitre (index de la bibliothèque) et son rang dedans. */
export interface UnitPlace {
  textId: number;
  /** Index du chapitre, celui des adresses de la bibliothèque (à partir de 1). */
  chapter: number;
  /** Rang dans le chapitre, à partir de 0. */
  offset: number;
}

/**
 * L'unité de rang `position` (à partir de 0) dans les textes d'un programme.
 * Au-delà du dernier, la dernière.
 */
export function placeOf(texts: number[], position: number): UnitPlace | null {
  let rest = Math.max(0, position);
  let last: UnitPlace | null = null;
  for (const textId of texts) {
    const sizes = chapterSizes(textId);
    for (let i = 0; i < sizes.length; i++) {
      if (sizes[i] === 0) continue;
      if (rest < sizes[i]) return { textId, chapter: i + 1, offset: rest };
      rest -= sizes[i];
      last = { textId, chapter: i + 1, offset: sizes[i] - 1 };
    }
  }
  return last;
}

/** Le nom d'un texte dans l'alphabet du lecteur (« Berakhot », « ברכות »). */
export function textName(textId: number, locale: string): string {
  const entry = texteOf(textId);
  if (!entry) return "";
  return locale === "he" ? hebrewName(entry) : latinTexteName(entry);
}

/**
 * Une unité écrite comme on la cite : « Chabbat 7:1 » pour une michna,
 * « Berakhot 12a » pour un côté de daf, « Yeshayahu 5 » pour un chapitre,
 * « Tehilim 23 » pour un psaume. `withText` : faut-il redire le texte ?
 */
export function unitLabel(place: UnitPlace, locale: string, withText = true): string {
  const name = withText ? `${textName(place.textId, locale)} ` : "";
  const units = UNITS[String(place.textId)];
  if (!units) return textName(place.textId, locale);
  if (units.unit === "mishna") return `${name}${place.chapter}:${place.offset + 1}`;
  if (units.unit === "chapter") return `${name}${place.chapter}`;
  const before = units.sizes.slice(0, place.chapter - 1).reduce((sum, n) => sum + n, 0);
  const index = units.first + before + place.offset;
  return `${name}${Math.floor(index / 2) + 2}${index % 2 === 0 ? "a" : "b"}`;
}

/**
 * Une portion écrite d'un bout à l'autre : « Chabbat 7:1 à 7:3 », « Chabbat
 * 24:5 à Erouvin 1:2 », ou une seule unité. `to` est exclu.
 */
export function portionLabel(
  texts: number[],
  from: number,
  to: number,
  locale: string,
  join: (a: string, b: string) => string,
): string {
  const start = placeOf(texts, from);
  if (!start) return "";
  if (to - from <= 1) return unitLabel(start, locale);
  const end = placeOf(texts, to - 1)!;
  // Un psaume se nomme seul : « Tehilim 1 à 29 » se dit avec le premier nom.
  const sameText = end.textId === start.textId;
  const psalms = !UNITS[String(start.textId)] && !UNITS[String(end.textId)];
  if (psalms) return join(unitLabel(start, locale), String(psalmNumber(end.textId)));
  return join(unitLabel(start, locale), unitLabel(end, locale, !sameText));
}

const psalmNumber = (textId: number): number => Number(texteOf(textId)?.link.split(".").pop());

/** Où ouvrir une unité dans la bibliothèque : le chapitre, et la michna à laquelle descendre. */
export function readingRoute(place: UnitPlace): { path: string; query?: Record<string, string> } {
  const entry = texteOf(place.textId);
  if (!entry) return { path: "/bibliotheque" };
  if (corpusOf(entry) === "tehilim") return texteRoute(entry, null);
  const route = texteRoute(entry, place.chapter);
  const units = UNITS[String(place.textId)];
  // Une michna est une ligne du chapitre ; le lecteur compte ses lignes à partir de 0.
  if (units?.unit === "mishna" && place.offset > 0) {
    return { ...route, query: { ...route.query, verset: String(place.offset) } };
  }
  return route;
}

/** Le séder ou le texte qu'une partie désigne, pour nommer un volume. */
export type PartRef =
  | { kind: "seder"; seder: SederId }
  | { kind: "text"; textId: number }
  | { kind: "all" };

export function partRef(part: ProgramPart): PartRef | null {
  if (part === "all") return { kind: "all" };
  if (part.startsWith("seder:")) {
    const seder = part.slice("seder:".length) as SederId;
    return SEDARIM.includes(seder) ? { kind: "seder", seder } : null;
  }
  if (part.startsWith("text:")) {
    const textId = Number(part.slice("text:".length));
    return texteOf(textId) ? { kind: "text", textId } : null;
  }
  return null;
}

/** Les textes d'un programme, en entrées du catalogue (celles que le catalogue connaît encore). */
export const programEntries = (program: Pick<ProgramObjective, "texts">): TextStudyJsonEntry[] =>
  program.texts.map((id) => texteOf(id)).filter((e): e is TextStudyJsonEntry => e !== null);
