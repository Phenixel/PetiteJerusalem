import { describe, expect, it } from "vitest";
import { HDate, months } from "@hebcal/core";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson } from "../models/models";
import { MOADIM_BOOK_BY_THEME, currentMoadimBook, withCurrentFirst } from "../content/moadimNow";

/**
 * La fête en cours ouvre la liste de Moadim, et le sidour y renvoie tant
 * qu'elle dure (voir src/content/moadimNow.ts).
 */
const midi = (hd: HDate) => {
  const d = hd.greg();
  d.setHours(12);
  return d;
};

describe("moadimNow : le livre de la fête en cours", () => {
  it("nomme des livres qui existent dans Moadim", () => {
    const livres = new Set(
      (textStudiesJson as TextStudiesJson).textStudies
        .filter((t) => String(t.type) === "Moadim")
        .map((t) => t.livre),
    );
    for (const livre of Object.values(MOADIM_BOOK_BY_THEME)) expect(livres.has(livre!)).toBe(true);
  });

  it("donne Souccot pendant la fête, Tichri avant Kippour, 'Hanouka pendant ses huit jours", () => {
    expect(currentMoadimBook(midi(new HDate(17, months.TISHREI, 5787)))).toBe("סוכות (Souccot)");
    expect(currentMoadimBook(midi(new HDate(5, months.TISHREI, 5787)))).toBe(
      "ימים נוראים (Yamim Noraim)",
    );
    expect(currentMoadimBook(midi(new HDate(27, months.KISLEV, 5787)))).toBe("חנוכה (Hanouka)");
  });

  it("ne donne rien hors des fêtes, ni pour une fête sans livre", () => {
    expect(currentMoadimBook(midi(new HDate(10, months.CHESHVAN, 5787)))).toBeNull();
    // Pessah a son thème, pas encore de livre dans Moadim.
    expect(currentMoadimBook(midi(new HDate(17, months.NISAN, 5787)))).toBeNull();
  });

  it("met le livre de la fête en tête, sans toucher au reste", () => {
    const groups = { a: 1, b: 2, c: 3 };
    expect(Object.keys(withCurrentFirst(groups, "b"))).toEqual(["b", "a", "c"]);
    expect(Object.keys(withCurrentFirst(groups, null))).toEqual(["a", "b", "c"]);
    expect(Object.keys(withCurrentFirst(groups, "z"))).toEqual(["a", "b", "c"]);
  });
});
