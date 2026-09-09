import { describe, expect, it } from "vitest";
import { parseTefilaBlocks } from "../services/textService";

/**
 * Les repères du menu de lecture : un marqueur sans ligne (horaire, Torah de
 * la semaine restée vide) partage son offset avec le bloc qui le suit ; le
 * menu, qui se repérait à l'offset, sautait alors au mauvais bloc et Vue se
 * plaignait de clés en double. Chaque bloc porte désormais un repère unique.
 */
describe("parseTefilaBlocks", () => {
  it("donne un repère unique à chaque bloc, marqueurs vides compris", () => {
    const blocks = parseTefilaBlocks([
      { label: "Bénédictions du matin", lines: ["ברוך"] },
      { zman: "shema" },
      { torahWeekly: true, when: "torah-semaine" },
      { label: "Chéma", labelText: { fr: "Chéma", en: "Shema", he: "שמע" }, lines: ["שמע"] },
    ]);
    expect(blocks).toHaveLength(4);
    // Les deux marqueurs et le Chéma partagent le même offset…
    expect(blocks.slice(1).map((b) => b.offset)).toEqual([1, 1, 1]);
    // …mais pas le même repère.
    const anchors = blocks.map((b) => b.anchor);
    expect(new Set(anchors).size).toBe(4);
    expect(anchors.every((a) => typeof a === "string" && a.length > 0)).toBe(true);
  });

  it("garde le repère stable quand un bloc vide est sauté", () => {
    const blocks = parseTefilaBlocks([
      { label: "A", lines: ["א"] },
      { label: "vide", lines: [] },
      { label: "B", lines: ["ב"] },
    ]);
    // Le bloc vide n'existe pas ; les repères suivent le rang dans le fichier.
    expect(blocks.map((b) => b.anchor)).toEqual(["b0", "b2"]);
  });
});
