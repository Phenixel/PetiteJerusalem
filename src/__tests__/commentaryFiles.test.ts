import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseCommentaryGroups,
  parseContent,
  parseMishnaMeforshim,
  resolveFilePath,
} from "../services/textService";
import { sectionCells } from "../composables/usePassageCommentaries";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson } from "../models/models";

/**
 * Les commentaires de la Michna (public/texts/mishna-meforshim/) et Rachi
 * sur les Neviim et les Ketouvim (public/texts/rashi/) se placent par index :
 * chaque fichier doit avoir une case par ligne que le lecteur affiche, dans
 * chaque chapitre, sans quoi un commentaire passerait sous la michna ou le
 * verset d'à côté. Un texte régénéré sans ses commentaires fait échouer ce
 * test (`node scripts/download-texts.mjs --only=commentaires`).
 */

const TEXTS = resolve(__dirname, "../../public/texts");
const read = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(resolve(TEXTS, path), "utf8"));
const entries = (textStudiesJson as TextStudiesJson).textStudies;

describe("commentaires de la Michna", () => {
  const traites = entries.filter((e) => e.type === "Mishna");

  it("a le Bartenura et les Tossefot Yom Tov de chaque traité du catalogue", () => {
    const files = new Set(readdirSync(resolve(TEXTS, "mishna-meforshim")));
    for (const entry of traites) {
      const file = resolveFilePath(entry).replace("/texts/mishna/", "");
      expect(files.has(file), `${file} absent de mishna-meforshim`).toBe(true);
    }
  });

  it("aligne chaque commentaire sur les michnayot de son chapitre", () => {
    for (const entry of traites) {
      const path = resolveFilePath(entry).replace("/texts/", "");
      const texte = parseContent(entry, read(path));
      const m = parseMishnaMeforshim(read(path.replace("mishna/", "mishna-meforshim/")));
      for (const source of ["bartenura", "tosafotYomTov"] as const) {
        let commentees = 0;
        for (const section of texte.sections) {
          const cases = sectionCells(m[source], section, entry.totalSections === 1);
          expect(cases.length, `${path} ${source} chapitre ${section.index}`).toBe(
            section.he.length,
          );
          commentees += cases.filter((c) => c.length > 0).length;
        }
        expect(commentees, `${path} ${source} : rien de commenté`).toBeGreaterThan(0);
      }
    }
  });
});

describe("Rachi sur les Neviim, les Ketouvim et les psaumes", () => {
  it("aligne Rachi sur les versets de chaque livre", () => {
    const livres = entries.filter(
      (e) => e.livre === "Nevi'im (Prophets)" || e.livre === "Ketuvim (Writings)",
    );
    expect(livres.length).toBe(22);
    for (const entry of livres) {
      const texte = parseContent(entry, read(`tanakh/${entry.id}.json`));
      const groupes = parseCommentaryGroups(read(`rashi/${entry.id}.json`).he);
      let commentes = 0;
      for (const section of texte.sections) {
        const cases = sectionCells(groupes, section, entry.totalSections === 1);
        expect(cases.length, `${entry.name} section ${section.index}`).toBe(section.he.length);
        commentes += cases.filter((c) => c.length > 0).length;
      }
      expect(commentes, `${entry.name} : rien de commenté`).toBeGreaterThan(0);
    }
  });

  it("donne à chaque psaume lu seul le chapitre du livre de Tehilim", () => {
    const tehilim = read("tehilim.json");
    const groupes = parseCommentaryGroups(read("rashi/328.json").he);
    const psaumes = entries.filter((e) => e.type === "Tehilim");
    expect(psaumes).toHaveLength(150);
    for (const entry of psaumes) {
      const n = Number(String(entry.link).split(".").pop());
      const section = parseContent(entry, tehilim).sections[0];
      expect(groupes[n - 1]?.length, `psaume ${n}`).toBe(section.he.length);
    }
  });
});
