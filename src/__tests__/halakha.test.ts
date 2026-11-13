import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import {
  HALAKHA_MEFORSHIM_CHUNK,
  parseContent,
  parseHalakhaMeforshim,
  resolveFilePath,
  type TextContent,
} from "../services/textService";
import {
  buildCorpusBody,
  buildHubBody,
  buildSectionBody,
  corpusOf,
  entryByCorpusSlug,
  HALAKHA_WORKS,
  halakhaWorkOfLivre,
  hubPath,
  isMultiSection,
  isShareable,
  sectionPath,
  sectionTitle,
  slugOf,
} from "../content/etudeTexts";
import { HALAKHA_SOURCES, commentaryCorpusOf } from "../composables/usePassageCommentaries";
import { chapitreKind, hasChapitres, texteRoute } from "../services/chiourTexte";
import { filterBySearch, latinPart } from "../services/catalogSearch";
import { EnumTypeTextStudy } from "../models/typeTextStudy";

/**
 * Le rayon Halakha (Choulhan Aroukh, Kitsour Choulhan Aroukh) : ses
 * identifiants et ses numéros de siman sont une adresse, que les cours citent
 * et que les lecteurs gardent en marque-page, et ses commentaires se rangent
 * par index sous leur séif. Ce test tient la structure dont ils dépendent :
 *   - les identifiants 500 à 685, fixes ;
 *   - une section porte le numéro de son siman dans le livre (Hilkhot
 *     Tsitsit commence au siman 8), et chaque livre est couvert siman après
 *     siman, sans trou ni doublon d'une entrée à l'autre ;
 *   - chaque ligne d'un siman est un séif, et chaque commentateur du
 *     Choulhan Aroukh a une case par séif.
 * Un écart veut dire que la source a bougé : `node scripts/download-texts.mjs
 * --only=halakha` le dit, avant ce test.
 */

const catalog = (textStudiesJson as TextStudiesJson).textStudies;
const halakha = catalog.filter((e) => e.type === "Halakha");
const byId = (id: number) => catalog.find((e) => e.id === id)!;
const byLatin = (latin: string) => halakha.find((e) => latinPart(e.name) === latin)!;

function load(entry: TextStudyJsonEntry): TextContent {
  const data = JSON.parse(readFileSync(`public${resolveFilePath(entry)}`, "utf8"));
  return parseContent(entry, data);
}

/** Le livre d'une entrée, et le premier siman qu'elle couvre, lus dans son lien. */
const placeOf = (entry: TextStudyJsonEntry) => {
  const m = decodeURIComponent(entry.link).match(/sefaria\.org\/(.+)\.(\d+)$/)!;
  return { book: m[1], from: Number(m[2]) };
};

/** Le numéro de siman d'une section (une entrée d'un seul siman se lit en section 1). */
const simanOf = (content: TextContent) =>
  content.sections.map((s) => (s.heading?.kind === "siman" ? s.heading.n : s.index));

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const IDS = [
  ...range(500, 528), // Ora'h Hayim
  ...range(540, 599), // Yoré Déa
  ...range(610, 617), // Even Haezer
  ...range(620, 654), // Hochen Michpat
  ...range(660, 685), // Kitsour Choulhan Aroukh
];

/** Les simanim de chaque livre, et ceux que la source laisse vides. */
const BOOKS: Record<string, { simanim: number; vides: number[] }> = {
  "Shulchan_Arukh,_Orach_Chayim": { simanim: 697, vides: [] },
  "Shulchan_Arukh,_Yoreh_De'ah": { simanim: 403, vides: [169] },
  "Shulchan_Arukh,_Even_HaEzer": { simanim: 178, vides: [] },
  "Shulchan_Arukh,_Choshen_Mishpat": { simanim: 427, vides: [] },
  Kitzur_Shulchan_Arukh: { simanim: 221, vides: [] },
};

describe("rayon Halakha : le catalogue", () => {
  it("garde les identifiants 500 à 685, tous de type Halakha", () => {
    expect(halakha.map((e) => e.id)).toEqual(IDS);
    for (const entry of halakha) expect(corpusOf(entry)).toBe("halakha");
    expect((textStudiesJson as TextStudiesJson).types).toContain("Halakha");
  });

  it("a un fichier par entrée, et autant de simanim que le catalogue en annonce", () => {
    const wrong: string[] = [];
    for (const entry of halakha) {
      const path = `public${resolveFilePath(entry)}`;
      expect(path).toBe(`public/texts/halakha/${entry.id}.json`);
      if (!existsSync(path)) {
        wrong.push(`${path} : absent`);
        continue;
      }
      const content = load(entry);
      if (content.sections.length !== entry.totalSections)
        wrong.push(
          `${entry.name} : ${content.sections.length} simanim pour ${entry.totalSections}`,
        );
      for (const section of content.sections)
        if (section.he.length === 0) wrong.push(`${entry.name} : siman ${section.index} vide`);
    }
    expect(wrong).toEqual([]);
  });

  it("couvre chaque livre siman après siman, d'une entrée à la suivante", () => {
    const covered: Record<string, number[]> = {};
    const wrongStart: string[] = [];
    for (const [book, { simanim, vides }] of Object.entries(BOOKS)) {
      const entries = halakha.filter((e) => placeOf(e).book === book);
      const seen = entries.flatMap((entry) => {
        const numbers = simanOf(load(entry));
        // Une entrée commence au siman de son lien.
        if (numbers[0] !== placeOf(entry).from)
          wrongStart.push(`${entry.name} : siman ${numbers[0]}, ${placeOf(entry).from} attendu`);
        return numbers;
      });
      covered[book] = range(1, simanim)
        .filter((n) => !vides.includes(n))
        .filter((n, i) => seen[i] !== n);
      if (seen.length !== simanim - vides.length) covered[book].push(-seen.length);
    }
    expect(wrongStart).toEqual([]);
    // Pour chaque livre, les simanim manquants ou déplacés : aucun.
    expect(Object.values(covered).flat()).toEqual([]);
  });

  it("range chaque loi dans un des livres que la page du rayon montre", () => {
    const counts = Object.fromEntries(HALAKHA_WORKS.map((work) => [work, 0]));
    for (const entry of halakha) counts[halakhaWorkOfLivre(entry.livre)]++;
    // Le Choulhan Aroukh et ses quatre parties, puis le Kitsour.
    expect(counts).toEqual({ "choulhan-aroukh": 132, kitsour: 26 });
    expect(halakhaWorkOfLivre(byId(670).livre)).toBe("kitsour");
  });

  it("donne aux lois leurs adresses, le Kitsour préfixé", () => {
    const slugs = halakha.map(slugOf);
    expect(new Set(slugs).size).toBe(slugs.length);
    // Aucune adresse n'a eu à se suffixer pour ne pas en doubler une autre.
    expect(slugs.filter((s) => /-\d+$/.test(s))).toEqual([]);
    expect(slugOf(byId(513))).toBe("hilkhot-chabbat");
    expect(slugOf(byId(670))).toBe("kitsour-chabbat");
    expect(entryByCorpusSlug("halakha", "hilkhot-tsitsit")?.id).toBe(501);
    expect(hubPath(byId(501))).toBe("/bibliotheque/halakha/hilkhot-tsitsit");
    expect(sectionPath(byId(501), 8)).toBe("/bibliotheque/halakha/hilkhot-tsitsit/8");
  });

  it("est un rayon d'étude, sans partage de lecture", () => {
    // La création d'un partage ne propose que ces types : pas la halakha.
    expect(Object.values(EnumTypeTextStudy)).not.toContain("Halakha");
    const entry = byId(501);
    expect(isShareable(entry)).toBe(false);
    const content = load(entry);
    expect(buildSectionBody(entry, content, content.sections[0])).not.toContain(
      'href="/share-reading/new-session"',
    );
    expect(buildHubBody(entry, content)).not.toContain('href="/share-reading/new-session"');
    expect(buildCorpusBody("halakha")).toContain(`href="${hubPath(byId(670))}"`);
  });
});

describe("rayon Halakha : les simanim", () => {
  it("ouvre Hilkhot Tsitsit sur le siman 8, sous son intitulé", () => {
    const entry = byId(501);
    expect(isMultiSection(entry)).toBe(true);
    const content = load(entry);
    const siman = content.sections[0];
    expect(siman.index).toBe(8);
    expect(siman.heading).toEqual({ kind: "siman", n: 8, title: expect.any(String) });
    expect(siman.label).toMatch(/^Siman 8 \(ח\) : \S/);
    // L'intitulé est retiré du premier séif, avec le nombre de séifim.
    expect(siman.he[0]).not.toMatch(/ובו .*סעיפים/);
    expect(sectionTitle(entry, siman)).toBe(
      "Choulhan Aroukh, Hilkhot Tsitsit, siman 8 en hébreu | Petite Jérusalem",
    );
  });

  it("lit une loi d'un seul siman en une section, qui garde son numéro", () => {
    const entry = byLatin("Hilkhot Melamdim");
    expect(isMultiSection(entry)).toBe(false);
    const content = load(entry);
    expect(content.sections.map((s) => s.index)).toEqual([1]);
    expect(content.sections[0].heading).toMatchObject({ kind: "siman", n: 245 });
    // Un cours n'a pas de siman à y préciser : le texte est ce siman.
    expect(hasChapitres(entry)).toBe(false);
  });

  it("donne au Kitsour ses intitulés, et sa vocalisation", () => {
    const content = load(byId(670));
    expect(content.sections[0].index).toBe(72);
    expect(content.sections[0].heading).toMatchObject({ kind: "siman", n: 72 });
    expect((content.sections[0].heading as { title: string }).title).toMatch(/שבת/);
    expect(content.sections[0].he[0]).toMatch(/[ְ-ּ]/);
  });

  it("mène un cours au siman qu'il étudie", () => {
    expect(chapitreKind(byId(513), 242)).toBe("siman");
    expect(texteRoute(byId(513), 242).path).toBe("/bibliotheque/halakha/hilkhot-chabbat/242");
  });
});

describe("rayon Halakha : les commentaires du Choulhan Aroukh", () => {
  const choulhanAroukh = halakha.filter((e) => !placeOf(e).book.startsWith("Kitzur"));
  const chunkOf = (entry: TextStudyJsonEntry, n: number) =>
    `public/texts/halakha-meforshim/${entry.id}/${Math.floor(n / HALAKHA_MEFORSHIM_CHUNK)}.json`;

  it("ouvre le volet sur le Choulhan Aroukh, pas sur le Kitsour", () => {
    const sa = byId(501);
    const kitsour = byId(670);
    expect(commentaryCorpusOf("Halakha", load(sa).sections[0], sa.livre)).toBe("halakha");
    expect(commentaryCorpusOf("Halakha", load(kitsour).sections[0], kitsour.livre)).toBeNull();
    expect(existsSync(`public/texts/halakha-meforshim/${kitsour.id}`)).toBe(false);
  });

  it("a une case par séif, pour chaque commentateur de chaque siman", () => {
    const wrong: string[] = [];
    const files = new Map<string, Record<string, unknown>>();
    for (const entry of choulhanAroukh) {
      const content = load(entry);
      for (const [k, section] of content.sections.entries()) {
        const n = simanOf(content)[k];
        const path = chunkOf(entry, n);
        if (!files.has(path)) {
          if (!existsSync(path)) {
            wrong.push(`${path} : absent`);
            continue;
          }
          files.set(path, JSON.parse(readFileSync(path, "utf8")));
        }
        const meforshim = parseHalakhaMeforshim(files.get(path)!, n);
        const sources = Object.keys(meforshim);
        if (sources.length === 0) wrong.push(`${entry.name}, siman ${n} : sans commentaires`);
        for (const source of sources) {
          expect(HALAKHA_SOURCES).toContain(source);
          if (meforshim[source].length !== section.he.length)
            wrong.push(
              `${entry.name}, siman ${n}, ${source} : ${meforshim[source].length} cases pour ${section.he.length} séifim`,
            );
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("range la première Michna Broura sous le premier séif d'Ora'h Hayim", () => {
    const data = JSON.parse(readFileSync(chunkOf(byId(500), 1), "utf8"));
    const siman1 = parseHalakhaMeforshim(data, 1);
    expect(Object.keys(siman1)).toEqual([
      "mishnaBerura",
      "magenAvraham",
      "taz",
      "chaareiTechouva",
      "baerHetev",
    ]);
    expect(siman1.mishnaBerura[0][0].lead).toBe("לעבודת בוראו");
    // Le Chakh commente Yoré Déa et Hochen Michpat, pas Ora'h Hayim.
    const yoreDea = parseHalakhaMeforshim(
      JSON.parse(readFileSync(chunkOf(byId(540), 1), "utf8")),
      1,
    );
    expect(Object.keys(yoreDea)).toContain("chakh");
  });
});

describe("rayon Halakha : la recherche", () => {
  const found = (term: string) => filterBySearch(catalog, term).map((t) => latinPart(t.name));

  it.each(["Hilchot Shabbat", "Hilkhot Chabbat"])("« %s »", (term) => {
    expect(found(term)[0]).toBe("Hilkhot Chabbat");
  });

  it.each(["Shulchan Aruch", "Choulhan Aroukh", "Orach Chaim"])("« %s »", (term) => {
    expect(found(term)).toContain("Hilkhot Tsitsit");
  });

  it.each(["Kitzur", "Kitsour"])("« %s » trouve le Kitsour", (term) => {
    expect(found(term)).toContain("Chabbat");
    expect(found(term)).not.toContain("Hilkhot Tsitsit");
  });

  it.each(["Halakha", "Halacha", "הלכה"])("« %s » trouve tout le rayon", (term) => {
    expect(found(term)).toEqual(expect.arrayContaining(["Hilkhot Hovel Ba'havero", "Avelout"]));
  });
});
