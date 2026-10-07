import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gemaraPageText, scrollVerseWords } from "../services/pageForm";
import { MEFORSHIM_CHUNK, parseRashiComment } from "../services/textService";

/**
 * Les coupures de ligne du livre imprimé (public/texts/talmud-layout et
 * torah-layout, voir docs/compatibilite-textes.md et scripts/layout/).
 *
 * Un fichier de coupures ne porte aucun mot : seulement des places dans le
 * texte qu'on a déjà. Ces tests tiennent ce qui fait qu'on peut s'y fier :
 * chaque place existe, et les lignes se partagent le texte mot pour mot,
 * sans en perdre ni en ajouter. Les mots sont comptés avec les fonctions du
 * lecteur lui-même, pas avec celles du pipeline.
 */

const TEXTS = resolve(__dirname, "../../public/texts");
const read = <T>(path: string): T => JSON.parse(readFileSync(resolve(TEXTS, path), "utf8")) as T;
const folders = (path: string): string[] =>
  existsSync(resolve(TEXTS, path)) ? readdirSync(resolve(TEXTS, path)).sort() : [];

/** Les mots d'un passage de guemara, tels que la page du daf les affiche. */
const gemaraWords = (passage: string): string[] => {
  const text = gemaraPageText([passage]);
  return text ? text.split(" ") : [];
};

/** Les mots des commentaires d'un passage, bout à bout. */
const commentWords = (comments: string[]): string[] =>
  comments.flatMap((raw) => {
    const parsed = parseRashiComment(raw);
    return parsed ? `${parsed.lead} ${parsed.text}`.split(/\s+/).filter(Boolean) : [];
  });

type Run = [number, number, number] | [number, number, number, number];
interface DafLayout {
  title: string;
  from: number;
  edition: string;
  through: number;
  main: [number, number][][];
  rashi: Run[][][];
  tosafot: Run[][][];
  absent: Partial<Record<"rashi" | "tosafot", Run[]>>[];
}
interface Meforshim {
  from: number;
  rashi: string[][][];
  tosafot: string[][][];
}

describe("coupures de la page de Vilna", () => {
  const tractates = folders("talmud-layout");

  it("ne couvre que des traités qu'on a", () => {
    for (const slug of tractates) {
      expect(existsSync(resolve(TEXTS, `talmud/${slug}.json`)), `traité ${slug}`).toBe(true);
    }
  });

  for (const slug of tractates) {
    const gemara = read<{ he: string[][] }>(`talmud/${slug}.json`).he;
    const chunks = folders(`talmud-layout/${slug}`).map((file) => ({
      n: Number(file.replace(".json", "")),
      data: read<DafLayout>(`talmud-layout/${slug}/${file}`),
    }));
    const meforshim = new Map<number, Meforshim>();
    const comments = (zone: "rashi" | "tosafot", amud: number): string[][] => {
      const n = Math.floor(amud / MEFORSHIM_CHUNK);
      if (!meforshim.has(n))
        meforshim.set(n, read<Meforshim>(`talmud-meforshim/${slug}/${n}.json`));
      const chunk = meforshim.get(n)!;
      return chunk[zone][amud - chunk.from] ?? [];
    };

    it(`${slug} : des tranches de vingt amoudim, comme les commentaires`, () => {
      for (const { n, data } of chunks) {
        expect(data.from).toBe(n * MEFORSHIM_CHUNK);
        expect(data.through).toBeGreaterThanOrEqual(data.from);
        expect(data.through).toBeLessThan(Math.min(data.from + MEFORSHIM_CHUNK, gemara.length));
        for (const zone of ["main", "rashi", "tosafot", "absent"] as const) {
          expect(data[zone].length, `${zone} de la tranche ${n}`).toBe(
            data.through - data.from + 1,
          );
        }
      }
    });

    it(`${slug} : les lignes de la guemara se partagent chaque amoud`, () => {
      for (const { data } of chunks) {
        data.main.forEach((lines, i) => {
          const amud = data.from + i;
          // La place de chaque mot de l'amoud, dans l'ordre de la page.
          const order = new Map<string, number>();
          gemara[amud].forEach((passage, p) =>
            gemaraWords(passage).forEach((_, w) => order.set(`${p}:${w}`, order.size)),
          );
          const at = lines.map(([p, w]) => order.get(`${p}:${w}`));
          expect(at, `amoud ${amud} : une place qui n'existe pas`).not.toContain(undefined);
          // La première ligne commence au premier mot, les suivantes avancent :
          // chaque mot appartient à une ligne et une seule.
          expect(at[0], `amoud ${amud}`).toBe(0);
          for (let k = 1; k < at.length; k++) {
            expect(at[k]!, `amoud ${amud}, ligne ${k + 1}`).toBeGreaterThan(at[k - 1]!);
          }
        });
      }
    });

    for (const zone of ["rashi", "tosafot"] as const) {
      it(`${slug} : chaque mot de ${zone} est sur une ligne, une seule fois`, () => {
        const through = Math.max(...chunks.map((c) => c.data.through));
        const seen = new Set<string>();
        const take = (amud: number, [p, w, count]: Run, where: string): void => {
          const words = commentWords(comments(zone, amud)[p] ?? []);
          expect(count, `${where} : un morceau vide`).toBeGreaterThan(0);
          expect(
            w + count,
            `${where} : au-delà du passage ${p} de l'amoud ${amud}`,
          ).toBeLessThanOrEqual(words.length);
          for (let k = w; k < w + count; k++) {
            const key = `${amud}:${p}:${k}`;
            expect(seen.has(key), `${where} : le mot ${key} est pris deux fois`).toBe(false);
            seen.add(key);
          }
        };
        for (const { data } of chunks) {
          data[zone].forEach((lines, i) => {
            const amud = data.from + i;
            lines.forEach((line, l) => {
              expect(line.length, `amoud ${amud}, ligne ${l + 1} vide`).toBeGreaterThan(0);
              for (const run of line) take(run[3] ?? amud, run, `amoud ${amud}, ligne ${l + 1}`);
            });
          });
          data.absent.forEach((absent, i) => {
            for (const run of absent[zone] ?? [])
              take(data.from + i, run, `absent de ${data.from + i}`);
          });
        }
        // Tout amoud d'avant le dernier est entièrement placé. Le dernier
        // peut finir à la page suivante, qu'on n'a pas encore relevée.
        for (let amud = 0; amud < through; amud++) {
          comments(zone, amud).forEach((passage, p) => {
            commentWords(passage).forEach((_, w) => {
              expect(
                seen.has(`${amud}:${p}:${w}`),
                `le mot ${amud}:${p}:${w} n'est sur aucune ligne`,
              ).toBe(true);
            });
          });
        }
      });
    }
  }
});

interface ScrollLayout {
  title: string;
  edition: string;
  columns: { column: number; from: number; lines: [number, number][] }[];
  blanks: [number, number][];
  big: [number, number, number][];
  small: [number, number, number][];
}

describe("colonnes du Sefer Torah", () => {
  const files = folders("torah-layout");

  for (const file of files) {
    const layout = read<ScrollLayout>(`torah-layout/${file}`);
    const verses = (read<{ he: string[][] }>(`tanakh/${file}`).he.flat() as string[]).map(
      scrollVerseWords,
    );
    const order = new Map<string, number>();
    verses.forEach((words, v) => words.forEach((_, w) => order.set(`${v}:${w}`, order.size)));

    it(`${layout.title} : des colonnes de quarante-deux lignes, dans l'ordre`, () => {
      let previous = 0;
      for (const column of layout.columns) {
        expect(column.column).toBeGreaterThan(previous);
        previous = column.column;
        expect(column.from).toBeGreaterThanOrEqual(0);
        expect(column.from + column.lines.length).toBeLessThanOrEqual(42);
      }
      // Une colonne entamée va jusqu'au bout, sauf la dernière.
      layout.columns.slice(0, -1).forEach((column) => {
        expect(column.from + column.lines.length, `colonne ${column.column}`).toBe(42);
      });
      layout.columns.slice(1).forEach((column) => expect(column.from).toBe(0));
    });

    it(`${layout.title} : chaque ligne commence à un mot du texte, après la précédente`, () => {
      const at = layout.columns.flatMap((column) =>
        column.lines.map(([v, w]) => order.get(`${v}:${w}`)),
      );
      expect(at).not.toContain(undefined);
      for (let k = 1; k < at.length; k++) {
        expect(at[k]!, `ligne ${k + 1}`).toBeGreaterThan(at[k - 1]!);
      }
    });

    it(`${layout.title} : les blancs et les lettres à part désignent le texte`, () => {
      for (const [v, w] of layout.blanks)
        expect(order.has(`${v}:${w}`), `blanc ${v}:${w}`).toBe(true);
      for (const [v, w, letter] of [...layout.big, ...layout.small]) {
        expect(verses[v]?.[w]?.[letter], `lettre ${v}:${w}:${letter}`).toMatch(/[א-ת]/);
      }
    });
  }
});
