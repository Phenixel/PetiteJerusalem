import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scrollVerseWords } from "../services/pageForm";
import {
  HALF_STRETCH_MAX,
  SCROLL_COLUMN_EMS,
  columnScale,
  estimatedWidth,
  fitLine,
  scrollColumns,
  type ScrollLayout,
} from "../services/scrollLayout";

/**
 * Les lignes du Sefer Torah, du fichier à la colonne écrite (scrollLayout.ts).
 * Le relevé lui-même (les 54 fichiers, les 245 colonnes) est tenu par
 * textLayout.test.ts ; ici, ce qu'on en fait.
 */

const layoutOf = (columns: ScrollLayout["columns"]): ScrollLayout => ({
  title: "",
  edition: "",
  columns,
  big: [],
  small: [],
});

describe("scrollColumns", () => {
  const verses = [
    ["א", "ב", "ג"],
    ["ד", "ה"],
    ["ו", "ז", "ח", "ט"],
  ];

  it("donne à chaque ligne ses morceaux, à chaque morceau ses mots", () => {
    const columns = scrollColumns(
      layoutOf([
        {
          column: 7,
          from: 40,
          lines: [
            [[0, 0]],
            [
              [0, 2],
              [1, 1],
            ],
          ],
        },
        { column: 8, from: 0, lines: [[], [[2, 0], null], [null, [2, 2]]] },
      ]),
      verses,
    )!;
    expect(columns.map((c) => [c.column, c.from])).toEqual([
      [7, 40],
      [8, 0],
    ]);
    const [first, second] = columns[0].rows;
    expect(first.kind).toBe("full");
    expect(first.pieces[0].runs).toEqual([{ verse: 0, from: 0, words: ["א", "ב"] }]);
    // Un morceau qui passe d'un verset au suivant : un bout par verset.
    expect(second.kind).toBe("pieces");
    expect(second.pieces.map((p) => p.runs)).toEqual([
      [
        { verse: 0, from: 2, words: ["ג"] },
        { verse: 1, from: 0, words: ["ד"] },
      ],
      [{ verse: 1, from: 1, words: ["ה"] }],
    ]);
    expect(second.pieces.map((p) => [p.rank, p.count])).toEqual([
      [2, 2],
      [4, 1],
    ]);
    const [blank, open, late] = columns[1].rows;
    expect(blank).toEqual({ kind: "blank", pieces: [], lead: false, trail: false });
    // Une ligne qui s'arrête avant le bord, une autre qui commence après un blanc.
    expect([open.kind, open.lead, open.trail]).toEqual(["pieces", false, true]);
    expect([late.kind, late.lead, late.trail]).toEqual(["pieces", true, false]);
    expect(late.pieces[0].runs[0].words).toEqual(["ח", "ט"]);
  });

  it("reconnaît les lignes de Haazinou à la plage que donne la colonne", () => {
    const line: ScrollLayout["columns"][number]["lines"][number] = [
      [0, 0],
      [0, 2],
    ];
    const rows = scrollColumns(
      layoutOf([
        {
          column: 1,
          from: 0,
          lines: [
            line,
            [
              [1, 0],
              [2, 0],
            ],
          ],
          halves: [1, 1],
        },
      ]),
      verses,
    )![0].rows;
    expect(rows.map((r) => r.kind)).toEqual(["pieces", "halves"]);
  });

  it("refuse un fichier qui ne colle pas au texte", () => {
    const bad = (lines: ScrollLayout["columns"][number]["lines"], from = 0) =>
      scrollColumns(layoutOf([{ column: 1, from, lines }]), verses);
    // Un mot qui n'existe pas, des lignes qui reculent, un début qui manque.
    expect(bad([[[0, 0]], [[1, 2]]])).toBeNull();
    expect(bad([[[0, 0]], [[1, 0]], [[0, 2]]])).toBeNull();
    expect(bad([[[0, 1]]])).toBeNull();
    expect(bad([[[0, 0]], [[0, 0]]])).toBeNull();
    // Plus de quarante-deux lignes dans une colonne.
    expect(bad([[[0, 0]], [[1, 0]]], 41)).toBeNull();
    expect(bad([])).toBeNull();
  });
});

describe("fitLine", () => {
  const SPACE = 0.25;
  /** La largeur que la ligne occupe une fois posée. */
  const filled = (natural: number, gaps: number, target: number, max?: number): number => {
    const fit = fitLine(natural, gaps, SPACE, target, max);
    return fit.stretch * (natural + gaps * fit.spacing);
  };

  it("étire ou resserre les lettres, sans toucher aux espaces, tant que c'est peu", () => {
    expect(fitLine(16, 7, SPACE, 16.75)).toEqual({ stretch: 16.75 / 16, spacing: 0 });
    expect(fitLine(18, 7, SPACE, 16.75)).toEqual({ stretch: 16.75 / 18, spacing: 0 });
  });

  it("écarte les mots d'une ligne courte quand les lettres ne suffisent plus", () => {
    const fit = fitLine(12, 5, SPACE, 16.75);
    expect(fit.stretch).toBeCloseTo(1.16);
    expect(fit.spacing).toBeGreaterThan(0);
    expect(filled(12, 5, 16.75)).toBeCloseTo(16.75);
  });

  it("serre les espaces d'une ligne longue, puis les lettres", () => {
    const some = fitLine(20, 8, SPACE, 16.75);
    expect(some.stretch).toBeCloseTo(0.86);
    expect(some.spacing).toBeLessThan(0);
    expect(filled(20, 8, 16.75)).toBeCloseTo(16.75);
    // Une espace ne perd jamais plus que sa moitié : le reste vient des lettres.
    const much = fitLine(24, 8, SPACE, 16.75);
    expect(much.spacing).toBe(-SPACE / 2);
    expect(much.stretch).toBeLessThan(0.86);
    expect(filled(24, 8, 16.75)).toBeCloseTo(16.75);
  });

  it("remplit toujours la largeur, quelle que soit la ligne", () => {
    for (let natural = 4; natural <= 30; natural += 0.7) {
      expect(filled(natural, 6, 16.75), `ligne de ${natural}`).toBeCloseTo(16.75);
      expect(filled(natural, 2, 7.25, HALF_STRETCH_MAX), `moitié de ${natural}`).toBeCloseTo(7.25);
    }
  });

  it("laisse un mot seul à sa place", () => {
    expect(fitLine(3, 0, SPACE, 16.75)).toEqual({ stretch: 1.16, spacing: 0 });
    expect(fitLine(0, 0, SPACE, 16.75)).toEqual({ stretch: 1, spacing: 0 });
  });
});

describe("columnScale", () => {
  it("écrit plus petit une colonne plus large que les autres", () => {
    expect(columnScale([16, 16.5, 17, 17.2, 16.9])).toBe(1);
    expect(columnScale([22, 23, 22.9, 23.4, 21.8])).toBeCloseTo(SCROLL_COLUMN_EMS / 22.9);
    // Deux lignes ne disent pas la largeur d'une colonne.
    expect(columnScale([25, 26])).toBe(1);
  });
});

describe("les lignes du rouleau dans l'écriture du sofer", () => {
  const TEXTS = resolve(__dirname, "../../public/texts");
  const read = <T>(path: string): T => JSON.parse(readFileSync(resolve(TEXTS, path), "utf8")) as T;
  const space = estimatedWidth(" ");

  it("tiennent dans la colonne sans que l'écriture en souffre", () => {
    const stretches: number[] = [];
    const naturals: number[] = [];
    let spaced = 0;
    for (let id = 264; id <= 317; id++) {
      const verses = read<{ he: string[][] }>(`tanakh/${id}.json`).he.flat().map(scrollVerseWords);
      const columns = scrollColumns(read<ScrollLayout>(`torah-layout/${id}.json`), verses)!;
      for (const column of columns) {
        const full = column.rows.filter((row) => row.kind === "full");
        const widths = full.map((row) => {
          const words = row.pieces[0].runs.flatMap((run) => run.words);
          return (
            words.reduce((w, word) => w + estimatedWidth(word), 0) + (words.length - 1) * space
          );
        });
        const scale = columnScale(widths);
        full.forEach((row, k) => {
          const fit = fitLine(widths[k], row.pieces[0].count - 1, space, SCROLL_COLUMN_EMS / scale);
          stretches.push(fit.stretch);
          if (scale === 1) naturals.push(widths[k]);
          if (fit.spacing) spaced++;
        });
      }
    }
    naturals.sort((a, b) => a - b);
    // La colonne a la largeur de la ligne médiane du rouleau.
    expect(naturals[naturals.length >> 1]).toBeCloseTo(SCROLL_COLUMN_EMS, 0);
    expect(stretches.length).toBeGreaterThan(9000);
    expect(Math.min(...stretches)).toBeGreaterThanOrEqual(0.84);
    expect(Math.max(...stretches)).toBeLessThanOrEqual(1.16);
    // Presque aucune ligne n'a besoin qu'on touche à ses espaces.
    expect(spaced / stretches.length).toBeLessThan(0.01);
  });
});
