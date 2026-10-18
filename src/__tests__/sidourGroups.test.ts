import { describe, expect, it } from "vitest";
import { searchSidour, sidourSections, sidourTexts, unplacedTexts } from "../content/sidourGroups";

/**
 * La liste de la page du Sidour : chaque texte de liturgie du catalogue
 * (Sidour, Brahot, Moadim) y paraît une fois et une seule, rangé par usage ;
 * les fêtes restent en bas et remontent en tête le temps de la leur.
 */
describe("la liste du Sidour", () => {
  it("range chaque texte de liturgie dans un groupe", () => {
    // Un texte ajouté au catalogue doit être rangé dans sidourGroups.ts :
    // sinon il tombe dans les occasions, sans qu'on l'ait choisi.
    expect(unplacedTexts().map((text) => text.key)).toEqual([]);
  });

  it("montre chaque texte une fois et une seule, fête en cours ou non", () => {
    for (const feast of [null, "tichri", "souccot", "hanouka"] as const) {
      const keys = sidourSections(feast).flatMap((section) => section.items.map((t) => t.key));
      expect(keys.length).toBe(sidourTexts.length);
      expect(new Set(keys).size).toBe(sidourTexts.length);
    }
  });

  it("garde les fêtes en bas le reste de l'année", () => {
    const sections = sidourSections(null);
    expect(sections[0].id).toBe("offices");
    expect(sections.at(-1)?.kind).toBe("feasts");
    expect(sections.filter((s) => s.kind === "feast-now")).toEqual([]);
  });

  it("fait remonter les textes de la fête en tête, le temps de la fête", () => {
    const sections = sidourSections("hanouka");
    expect(sections[0]).toMatchObject({ kind: "feast-now", id: "hanouka" });
    expect(sections[0].items.map((t) => t.key)).toEqual(["moadim/nerot-hanouka"]);
    // Les autres fêtes restent en bas.
    const later = sections.at(-1)!;
    expect(later.kind).toBe("feasts");
    expect(later.items.map((t) => t.key)).not.toContain("moadim/nerot-hanouka");
    expect(later.items.map((t) => t.key)).toContain("moadim/slihot");
  });

  it("donne à chaque texte son adresse publiée, sous /bibliotheque", () => {
    for (const text of sidourTexts) {
      expect(text.path).toBe(`/bibliotheque/${text.key}`);
      expect(text.latin).not.toBe("");
      expect(text.hebrew).toMatch(/[֐-׿]/);
    }
  });
});

describe("the Sidour search", () => {
  const sections = sidourSections(null);
  const keys = (term: string) => searchSidour(term, sections).map((text) => text.key);

  it("finds a text by its Latin name, its Hebrew name, or with a typo", () => {
    expect(keys("birkat hamazon")).toContain("brahot/birkat-hamazon");
    expect(keys("ברכת המזון")).toContain("brahot/birkat-hamazon");
    expect(keys("birkat hamazone")).toContain("brahot/birkat-hamazon");
    expect(keys("havdala")).toContain("sidour/havdala");
    // The names everyone types, whatever the spelling.
    expect(keys("bensch")).toContain("brahot/birkat-hamazon");
    expect(keys("bentcher")).toContain("brahot/birkat-hamazon");
  });

  it("answers nothing to an empty term, and keeps the order of the list", () => {
    expect(keys("  ")).toEqual([]);
    const order = sections.flatMap((section) => section.items.map((text) => text.key));
    const found = keys("a");
    expect(found).toEqual([...found].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  });
});
