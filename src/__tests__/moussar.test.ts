import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { parseContent, resolveFilePath, type TextContent } from "../services/textService";
import {
  buildCorpusBody,
  buildHubBody,
  buildSectionBody,
  corpusOf,
  entryByCorpusSlug,
  hubPath,
  isLiturgy,
  isMultiSection,
  isShareable,
  moussarSlug,
  sectionPath,
  sectionTitle,
  slugOf,
} from "../content/etudeTexts";
import { filterBySearch, latinPart } from "../services/catalogSearch";

/**
 * Le rayon Moussar ('Hovot Halévavot, Pélé Yoets) : ses identifiants et ses
 * numéros de section sont une adresse, que les cours citent (le lien entre un
 * chiour et un chapitre) et que les lecteurs gardent en marque-page. Ce test
 * tient la structure dont ils dépendent :
 *   - les identifiants 400 à 441, fixes ;
 *   - une porte de 'Hovot Halévavot s'ouvre sur son introduction, section 0,
 *     et ses chapitres gardent leur numéro ;
 *   - un sujet du Pélé Yoets garde son numéro dans tout le livre.
 */

const catalog = (textStudiesJson as TextStudiesJson).textStudies;
const byId = (id: number) => catalog.find((e) => e.id === id)!;

function load(entry: TextStudyJsonEntry): TextContent {
  const data = JSON.parse(readFileSync(`public${resolveFilePath(entry)}`, "utf8"));
  return parseContent(entry, data);
}

const IDS = [400, ...Array.from({ length: 10 }, (_, i) => 401 + i)].concat(
  Array.from({ length: 22 }, (_, i) => 420 + i),
);

describe("rayon Moussar : le catalogue", () => {
  it("garde les identifiants 400 à 410 et 420 à 441, tous de type Moussar", () => {
    for (const id of IDS) {
      const entry = byId(id);
      expect(entry?.type).toBe("Moussar");
      expect(corpusOf(entry)).toBe("moussar");
    }
    const moussar = catalog.filter((e) => e.type === "Moussar").map((e) => e.id);
    expect(moussar).toEqual(IDS);
    expect((textStudiesJson as TextStudiesJson).types).toContain("Moussar");
  });

  it("a un fichier par entrée, et autant de sections que le catalogue en annonce", () => {
    const wrong: string[] = [];
    for (const id of IDS) {
      const entry = byId(id);
      const path = `public${resolveFilePath(entry)}`;
      expect(path).toBe(`public/texts/moussar/${id}.json`);
      if (!existsSync(path)) {
        wrong.push(`${path} : absent`);
        continue;
      }
      const sections = load(entry).sections;
      if (sections.length !== entry.totalSections)
        wrong.push(`${entry.name} : ${sections.length} sections pour ${entry.totalSections}`);
      for (const section of sections)
        if (section.he.length === 0) wrong.push(`${entry.name} : section ${section.index} vide`);
    }
    expect(wrong).toEqual([]);
  });

  it("donne aux livres leurs adresses (slugs sans accent ni apostrophe)", () => {
    expect(moussarSlug("Chaar Habita'hon")).toBe("chaar-habitahon");
    expect(moussarSlug("Pélé Yoets, Aleph")).toBe("pele-yoets-aleph");
    expect(moussarSlug("Hakdamat Hamé'haber")).toBe("hakdamat-hamehaber");
    expect(slugOf(byId(404))).toBe("chaar-habitahon");
    expect(slugOf(byId(420))).toBe("pele-yoets-aleph");
    expect(slugOf(byId(400))).toBe("hakdamat-hamehaber");
    expect(entryByCorpusSlug("moussar", "chaar-habitahon")?.id).toBe(404);
    expect(hubPath(byId(404))).toBe("/bibliotheque/moussar/chaar-habitahon");
    expect(sectionPath(byId(404), 0)).toBe("/bibliotheque/moussar/chaar-habitahon/0");
  });

  it("est un rayon d'étude, sans partage de lecture et sans être de la liturgie", () => {
    const entry = byId(404);
    expect(isShareable(entry)).toBe(false);
    expect(isLiturgy(entry)).toBe(false);
    const content = load(entry);
    const body = buildSectionBody(entry, content, content.sections[4]);
    expect(body).not.toContain('href="/share-reading/new-session"');
    expect(buildHubBody(entry, content)).not.toContain('href="/share-reading/new-session"');
    expect(buildCorpusBody("moussar")).not.toContain('href="/share-reading/new-session"');
    // Les liturgies, elles, ne bougent pas.
    expect(isLiturgy(entryByCorpusSlug("brahot", "birkat-hamazon")!)).toBe(true);
  });
});

describe("rayon Moussar : 'Hovot Halévavot", () => {
  it("ouvre le Chaar Habita'hon sur son introduction (0), puis ses chapitres 1 à 7", () => {
    const entry = byId(404);
    expect(isMultiSection(entry)).toBe(true);
    const content = load(entry);
    expect(content.sections.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(content.sections[0].heading).toEqual({ kind: "introduction" });
    expect(content.sections[0].label).toBe("Introduction");
    expect(content.sections[4].heading).toEqual({ kind: "chapter", n: 4 });
    expect(content.sections[4].label).toBe("Chapitre 4 (ד)");
    expect(sectionTitle(entry, content.sections[4])).toBe(
      "Hovot Halévavot, Chaar Habita'hon, Chapitre 4 (ד) en hébreu | Petite Jérusalem",
    );
  });

  it("lit l'introduction de l'auteur d'un seul tenant, en section 1", () => {
    const entry = byId(400);
    expect(isMultiSection(entry)).toBe(false);
    const content = load(entry);
    expect(content.sections.map((s) => s.index)).toEqual([1]);
    expect(content.sections[0].heading).toBeUndefined();
  });
});

describe("rayon Moussar : Pélé Yoets", () => {
  it("range le sujet 11, אבירות לב, dans la lettre Aleph, sous son numéro", () => {
    const content = load(byId(420));
    const sujet = content.sections.find((s) => s.index === 11)!;
    expect(sujet.heading).toEqual({ kind: "topic", n: 11, title: "אבירות לב" });
    expect(sujet.label).toBe("Sujet 11 : אבירות לב");
    expect(content.sections[0].index).toBe(1);
  });

  it("ouvre la lettre Beth sur le sujet 22, et finit le livre au 391", () => {
    const beth = load(byId(421));
    expect(beth.sections[0].index).toBe(22);
    expect(beth.sections.at(-1)!.index).toBe(41);
    expect(byId(421).link).toBe("https://www.sefaria.org/Pele_Yoetz.22");
    expect(load(byId(441)).sections.at(-1)!.index).toBe(391);
  });

  it("numérote les sujets de 1 à 391 sans trou ni doublon, d'une lettre à l'autre", () => {
    const indexes = Array.from({ length: 22 }, (_, i) => 420 + i).flatMap((id) =>
      load(byId(id)).sections.map((s) => s.index),
    );
    expect(indexes).toEqual(Array.from({ length: 391 }, (_, i) => i + 1));
  });
});

describe("rayon Moussar : la recherche", () => {
  const found = (term: string) => filterBySearch(catalog, term).map((t) => latinPart(t.name));

  it.each(["Shaar Habitahon", "Chaar Habitahon", "Bitahon", "Bitachon"])("« %s »", (term) => {
    expect(found(term)[0]).toBe("Chaar Habita'hon");
  });

  it.each(["Hovot Halevavot", "Chovot HaLevavot", "Duties of the Heart"])("« %s »", (term) => {
    expect(found(term)).toContain("Chaar Habita'hon");
    expect(found(term)).not.toContain("Pélé Yoets, Aleph");
  });

  it.each(["Pele Yoetz", "Pélé Yoets", "Pele Yoets"])("« %s »", (term) => {
    expect(found(term)).toContain("Pélé Yoets, Aleph");
  });

  it.each(["Moussar", "Musar", "מוסר"])("« %s » trouve tout le rayon", (term) => {
    expect(found(term)).toEqual(expect.arrayContaining(["Chaar Habita'hon", "Pélé Yoets, Tav"]));
  });
});
