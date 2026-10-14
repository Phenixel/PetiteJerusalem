import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { isShareable } from "../content/etudeTexts";
import { latinPart } from "../services/catalogSearch";
import { parseContent, resolveFilePath } from "../services/textService";

/**
 * Une chaîne de partage offre les places que le catalogue annonce
 * (`totalSections`) ; le lecteur, lui, affiche les sections que porte le
 * fichier. Quand les deux divergent, des chapitres se lisent sans pouvoir se
 * réserver : Middot annonçait 3 perakim pour 5, dans la Michna comme dans le
 * Talmud, si bien qu'un groupe finissait l'une ou l'autre sans ses chapitres
 * 4 et 5.
 */

/**
 * Les chapitres que le lecteur affiche en plus de ceux que le catalogue donne
 * à partager : deux baraïtot que les éditions impriment à la suite du traité.
 * Le catalogue ne les compte pas ; qu'il les compte un jour, et c'est ici que
 * cela s'écrit.
 */
const HORS_PARTAGE: Record<string, number> = {
  // Le chapitre 4 de Bikkurim (« Androginos »).
  "Mishna|Bikkurim": 1,
  // Le chapitre 6 d'Avot (« Kinyan Torah »).
  "Mishna|Avot": 1,
};

const shared = (textStudiesJson as TextStudiesJson).textStudies.filter(isShareable);
const keyOf = (entry: TextStudyJsonEntry): string => `${entry.type}|${latinPart(entry.name)}`;

const talmudChapters = JSON.parse(readFileSync("public/texts/talmud-chapters.json", "utf8"));
// Les 150 Tehilim partagent un fichier : on ne le lit qu'une fois.
const files = new Map<string, unknown>();
function readerContent(entry: TextStudyJsonEntry) {
  const path = `public${resolveFilePath(entry)}`;
  if (!files.has(path)) files.set(path, JSON.parse(readFileSync(path, "utf8")));
  return parseContent(entry, files.get(path), talmudChapters);
}
const readerSections = (entry: TextStudyJsonEntry): number => readerContent(entry).sections.length;

/** Un chapitre du découpage du Talmud (public/texts/talmud-chapters.json). */
interface TalmudRange {
  chapter: number;
  startIdx: number;
  endIdx: number;
}

describe("les places qu'annonce le catalogue", () => {
  it("sont les sections que le lecteur affiche", () => {
    const ecarts: string[] = [];
    for (const entry of shared) {
      const lues = readerSections(entry);
      const attendues = entry.totalSections + (HORS_PARTAGE[keyOf(entry)] ?? 0);
      if (lues !== attendues) {
        ecarts.push(`${keyOf(entry)} : ${entry.totalSections} au catalogue, ${lues} au lecteur`);
      }
    }
    expect(ecarts, "Accorder totalSections au fichier, ou l'écrire dans HORS_PARTAGE").toEqual([]);
  });

  it("n'ont pas d'exception qui ne désigne plus aucun texte", () => {
    const keys = new Set(shared.map(keyOf));
    expect(Object.keys(HORS_PARTAGE).filter((key) => !keys.has(key))).toEqual([]);
  });

  it("ont chacune quelque chose à lire", () => {
    // Le chapitre 3 de Shekalim (Talmud) était vide : qui le réservait dans
    // une chaîne n'avait rien à lire, et la page 4 portait les chapitres 3 et 4.
    const vides = shared.flatMap((entry) =>
      readerContent(entry)
        .sections.filter((section) => section.he.length === 0)
        .map((section) => `${keyOf(entry)} ${section.index}`),
    );
    expect(vides).toEqual([]);
  });

  it("se suivent dans le découpage du Talmud, sans trou ni recouvrement", () => {
    const fautes: string[] = [];
    for (const [slug, ranges] of Object.entries(talmudChapters as Record<string, TalmudRange[]>)) {
      const dafim = JSON.parse(readFileSync(`public/texts/talmud/${slug}.json`, "utf8")).he.length;
      ranges.forEach((range, i) => {
        const debut = i === 0 ? 0 : ranges[i - 1].endIdx + 1;
        if (range.chapter !== i + 1) fautes.push(`${slug} : chapitre ${range.chapter} au rang ${i + 1}`);
        if (range.startIdx !== debut) fautes.push(`${slug} ${range.chapter} : commence à ${range.startIdx}, ${debut} attendu`);
        if (range.endIdx < range.startIdx) fautes.push(`${slug} ${range.chapter} : vide`);
      });
      const fin = ranges.at(-1)?.endIdx;
      if (fin !== dafim - 1) fautes.push(`${slug} : finit à ${fin}, le fichier à ${dafim - 1}`);
    }
    expect(fautes).toEqual([]);
  });

  it("comptent les cinq perakim de Middot, dans la Michna et dans le Talmud", () => {
    const middot = shared.filter((entry) => latinPart(entry.name) === "Middot");
    expect(middot.map((entry) => [String(entry.type), entry.totalSections])).toEqual([
      ["Talmud Bavli", 5],
      ["Mishna", 5],
    ]);
  });
});
