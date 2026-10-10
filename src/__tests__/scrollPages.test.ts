import { describe, expect, it } from "vitest";
import { SCROLL_LINES_PER_PAGE, scrollPageStarts } from "../services/scrollPages";

/**
 * Les pages de la forme du Sefer Torah : un blanc toutes les quarante-deux
 * lignes (scrollPages.ts).
 */

/** Une colonne de `lines` lignes de `perLine` mots, à 1,75 cadratin d'interligne. */
function column(lines: number, perLine = 5, gapsAfter: number[] = []): number[] {
  const tops: number[] = [];
  let top = 0;
  for (let line = 0; line < lines; line++) {
    if (gapsAfter.includes(line)) top += 5.25;
    for (let word = 0; word < perLine; word++) tops.push(top);
    top += 1.75;
  }
  return tops;
}

describe("les pages du Sefer Torah", () => {
  it("compte quarante-deux lignes par page", () => {
    expect(SCROLL_LINES_PER_PAGE).toBe(42);
  });

  it("commence une page toutes les quarante-deux lignes", () => {
    // 100 lignes de 5 mots : la deuxième page au 43e début de ligne, la troisième au 85e.
    expect(scrollPageStarts(column(100))).toEqual([42 * 5, 84 * 5]);
  });

  it("ne coupe pas une colonne plus courte qu'une page", () => {
    expect(scrollPageStarts(column(42))).toEqual([]);
    expect(scrollPageStarts(column(43))).toEqual([42 * 5]);
  });

  it("retrouve les mêmes pages une fois les blancs posés", () => {
    const pages = scrollPageStarts(column(100));
    expect(scrollPageStarts(column(100, 5, [42, 84]))).toEqual(pages);
  });

  it("ne prend pas pour une ligne un mot qui remonte : les deux moitiés d'une ligne de Haazinou", () => {
    // Une moitié sur deux lignes, puis l'autre moitié, revenue en haut de la rangée.
    const tops = [0, 0, 1.75, 0, 0, 3.5, 3.5];
    expect(scrollPageStarts(tops, 2)).toEqual([5]);
  });
});
