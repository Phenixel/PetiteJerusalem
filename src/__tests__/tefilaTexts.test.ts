import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { HDate } from "@hebcal/core";
import { activeOccasions } from "../services/dailyCycles";
import { parseContent } from "../services/textService";
import { entryByCorpusSlug } from "../content/etudeTexts";

// Les textes de tefila : blocs conditionnels de Birkat Hamazon (ajouts du
// calendrier) et occasions qui les pilotent.

const hd = (y: number, m: number, d: number) => new HDate(new Date(y, m - 1, d, 12));

describe("activeOccasions", () => {
  it("jour ordinaire : aucun ajout", () => {
    // Mardi 18 août 2026, 5 Eloul.
    expect(activeOccasions(hd(2026, 8, 18), false).size).toBe(0);
  });

  it("Chabbat : Retsé, mais pas Yaalé véyavo", () => {
    const occ = activeOccasions(hd(2026, 8, 22), false);
    expect(occ.has("shabbat")).toBe(true);
    expect(occ.has("shabbat-or-moed")).toBe(true);
    expect(occ.has("moed")).toBe(false);
  });

  it("Roch Hodech : Yaalé véyavo", () => {
    // 13 août 2026 = 30 Av, Roch Hodech Eloul.
    const occ = activeOccasions(hd(2026, 8, 13), false);
    expect(occ.has("rosh-chodesh")).toBe(true);
    expect(occ.has("moed")).toBe(true);
    expect(occ.has("nissim")).toBe(false);
  });

  it("Hanouka : Al hanissim dès le premier jour, pas la veille", () => {
    // 25 Kislev 5787 = 5 décembre 2026 ; la veille porte « 1 Candle » chez
    // hebcal (l'allumage du soir) mais n'est pas encore Hanouka.
    expect(activeOccasions(hd(2026, 12, 5), false).has("nissim")).toBe(true);
    expect(activeOccasions(hd(2026, 12, 4), false).has("nissim")).toBe(false);
  });

  it("Pessah : Yom Tov et jours de fête", () => {
    // 2 avril 2026 = 15 Nissan 5786.
    const occ = activeOccasions(hd(2026, 4, 2), false);
    expect(occ.has("yom-tov")).toBe(true);
    expect(occ.has("moed")).toBe(true);
    expect(occ.has("moadim")).toBe(true);
  });
});

describe("fichiers de tefila", () => {
  const load = (corpus: string, slug: string) => {
    const entry = entryByCorpusSlug(corpus, slug)!;
    const data = JSON.parse(readFileSync(`public/texts/tefila/${entry.id}.json`, "utf8"));
    return parseContent(entry, data);
  };

  it("Birkat Hamazon : un fil sans titres, les ajouts du calendrier en blocs `when`", () => {
    const content = load("brahot", "birkat-hamazon");
    const blocks = content.sections[0].blocks ?? [];
    expect(blocks.length).toBeGreaterThan(5);
    // Le fil principal n'a ni titre ni condition : des paragraphes continus.
    for (const block of blocks.filter((b) => !b.when)) expect(block.label).toBe("");
    // Les ajouts connus sont là, chacun conditionné.
    const whens = blocks.filter((b) => b.when).map((b) => b.when);
    for (const expected of ["shabbat", "moed", "nissim"]) expect(whens).toContain(expected);
    // Les offsets se suivent : les marque-pages pointent des lignes stables,
    // même quand un bloc conditionnel est masqué à l'affichage.
    let offset = 0;
    for (const block of blocks) {
      expect(block.offset).toBe(offset);
      offset += block.lines.length;
    }
    expect(content.sections[0].he.length).toBe(offset);
  });

  it("Brakha A'harona : le Mé'ein chaloch complet puis Boré nefachot", () => {
    const content = load("brahot", "brakha-aharona");
    const blocks = content.sections[0].blocks ?? [];
    expect(blocks.map((b) => b.label)).toEqual(["Mé'ein chaloch — Al hami'hya", "Boré nefachot"]);
    // Comparé sans vocalisation : l'ordre des signes varie d'une source à l'autre.
    const stripNiqqud = (s: string) => s.normalize("NFC").replace(/[֑-ׇ]/g, "");
    const all = stripNiqqud(content.sections[0].he.join(" "));
    // Le cœur de la bénédiction, absent de l'ancienne version fragmentée.
    expect(all).toContain("ובנה ירושלים");
    expect(all).toContain("בורא נפשות");
  });

  it("Sli'hot : des séparations titrées, sans condition", () => {
    const content = load("slihot", "slihot");
    const blocks = content.sections[0].blocks ?? [];
    expect(blocks.length).toBeGreaterThan(10);
    for (const block of blocks) {
      expect(block.label).not.toBe("");
      expect(block.when).toBeUndefined();
    }
  });
});
