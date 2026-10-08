import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gemaraPageText, scrollVerseWords } from "../services/pageForm";
import {
  SCROLL_COLUMN_LINES,
  scrollColumns,
  type ScrollLayout,
  type ScrollRow,
} from "../services/scrollLayout";
import { MEFORSHIM_CHUNK, cleanText, parseRashiComment } from "../services/textService";

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

describe("colonnes du Sefer Torah", () => {
  /** Les parachiot de la Torah au catalogue (public/texts/tanakh). */
  const PARASHIOT = Array.from({ length: 54 }, (_, k) => 264 + k);
  /** Les colonnes qui ne commencent pas par un vav : « בי"ה שמ"ו » et les deux coutumes du chin. */
  const NOT_VAV: Record<number, string> = {
    1: "בראשית",
    59: "יהודה",
    78: "הבאים",
    102: "שמר",
    132: "שני",
    184: "מה",
  };

  const parashiot = PARASHIOT.map((id) => {
    const text = read<{ fromBook: string; he: string[][] }>(`tanakh/${id}.json`);
    const raw = text.he.flat();
    return {
      id,
      book: text.fromBook,
      raw,
      verses: raw.map(scrollVerseWords),
      layout: read<ScrollLayout>(`torah-layout/${id}.json`),
    };
  });

  it("couvre toute la Torah, et rien d'autre", () => {
    expect(folders("torah-layout")).toEqual(PARASHIOT.map((id) => `${id}.json`).sort());
  });

  it("compte les mots comme le lecteur, qui lit le texte nettoyé", () => {
    for (const { id, raw, verses } of parashiot) {
      raw.forEach((verse, v) => {
        expect(verses[v].length, `paracha ${id}, verset ${v}`).toBeGreaterThan(0);
        expect(scrollVerseWords(cleanText(verse)), `paracha ${id}, verset ${v}`).toEqual(verses[v]);
      });
    }
  });

  it("donne à chaque mot une ligne, une seule", () => {
    for (const { id, layout, verses } of parashiot) {
      const columns = scrollColumns(layout, verses);
      expect(columns, `paracha ${id}`).not.toBeNull();
      const written = columns!.flatMap((c) => c.rows.flatMap((r) => r.pieces));
      const words = written.flatMap((p) => p.runs.flatMap((r) => r.words));
      expect(words, `paracha ${id}`).toEqual(verses.flat());
    }
  });

  it("tient les colonnes de quarante-deux lignes, d'un bout à l'autre du rouleau", () => {
    let column = 1;
    let line = 0;
    let previousBook = "";
    parashiot.forEach(({ id, book, layout }, n) => {
      const first = layout.columns[0];
      if (n > 0) {
        // La paracha reprend où la précédente s'arrête : dans la même ligne
        // après une setouma, sinon à la ligne suivante ; quatre lignes
        // blanches plus bas d'un livre à l'autre, une avant Haazinou.
        const shared = first.lines[0][0] === null;
        const blank = (book !== previousBook ? 4 : 0) + (id === 316 ? 1 : 0);
        const skipped = shared ? 0 : 1 + blank;
        const at = (column - 1) * SCROLL_COLUMN_LINES + line + skipped;
        expect(first.column, `paracha ${id}`).toBe(Math.floor(at / SCROLL_COLUMN_LINES) + 1);
        expect(first.from, `paracha ${id}`).toBe(at % SCROLL_COLUMN_LINES);
        if (shared) expect(parashiot[n - 1].layout.columns.at(-1)!.lines.at(-1)!.at(-1)).toBeNull();
      } else {
        expect([first.column, first.from]).toEqual([1, 0]);
      }
      layout.columns.forEach((c, k) => {
        expect(c.column, `paracha ${id}`).toBe(first.column + k);
        if (k > 0) expect(c.from, `paracha ${id}, colonne ${c.column}`).toBe(0);
        const last = k === layout.columns.length - 1;
        if (!last) expect(c.from + c.lines.length, `colonne ${c.column}`).toBe(SCROLL_COLUMN_LINES);
        else expect(c.from + c.lines.length).toBeLessThanOrEqual(SCROLL_COLUMN_LINES);
      });
      const end = layout.columns.at(-1)!;
      column = end.column;
      line = end.from + end.lines.length - 1;
      previousBook = book;
    });
    // Le rouleau finit avec sa deux cent quarante-cinquième colonne.
    expect([column, line]).toEqual([245, SCROLL_COLUMN_LINES - 1]);
  });

  it("commence chaque colonne par un vav, sauf celles que la tradition nomme", () => {
    const seen = new Set<number>();
    for (const { layout, verses } of parashiot) {
      for (const c of layout.columns) {
        const head = c.lines[0][0];
        if (c.from !== 0 || !head) continue;
        const word = verses[head[0]][head[1]];
        seen.add(c.column);
        expect(word.startsWith("ו") || NOT_VAV[c.column] === word, `colonne ${c.column}`).toBe(
          true,
        );
      }
    }
    expect(seen.size).toBe(245);
  });

  it("écrit les deux chirot comme la tradition les fixe", () => {
    const heads = (rows: ScrollRow[], piece = 0): string[] =>
      rows.map((row) => row.pieces[piece].runs[0].words[0]);
    // Az yachir : trente lignes, une pleine puis trois morceaux et deux tour à
    // tour ; une ligne blanche avant et après ; cinq lignes dessous, dont le
    // Rema donne les premiers mots (Yoré Déa 275, 6).
    const beshalach = parashiot.find((p) => p.id === 279)!;
    const rows = scrollColumns(beshalach.layout, beshalach.verses)!.find(
      (c) => c.column === 78,
    )!.rows;
    expect(rows).toHaveLength(SCROLL_COLUMN_LINES);
    expect(heads(rows.slice(0, 5))).toEqual("הבאים ביבשה יהוה מת במצרים".split(" "));
    expect(rows[5].kind).toBe("blank");
    expect(rows.slice(6, 36).map((row) => row.pieces.length)).toEqual([
      1,
      ...Array.from({ length: 29 }, (_, k) => (k % 2 ? 2 : 3)),
    ]);
    expect(heads(rows.slice(6, 36))).toEqual(
      (
        "אז לאמר ורכבו לישועה אבי שמו שלשיו אבן יהוה קמיך אפיך נזלים אויב נפשי ברוחך " +
        "אדירים כמכה פלא בחסדך קדשך אחז אדום כל ופחד יעבר קנית לשבתך ידיך בא הים"
      ).split(" "),
    );
    expect(rows[36].kind).toBe("blank");
    expect(heads(rows.slice(37))).toEqual("ותקח אחריה סוס ויצאו ויבאו".split(" "));

    // Haazinou : soixante-dix lignes en deux moitiés (Rambam, Sefer Torah 8, 4),
    // six lignes dessus, une ligne blanche de part et d'autre.
    const haazinou = parashiot.find((p) => p.id === 316)!;
    const vayelech = parashiot.find((p) => p.id === 315)!;
    const song = scrollColumns(haazinou.layout, haazinou.verses)!.flatMap((c) => c.rows);
    const halves = song.filter((row) => row.kind === "halves");
    expect(halves).toHaveLength(70);
    expect(heads(halves).slice(0, 3)).toEqual(["האזינו", "יערף", "כשעירם"]);
    expect(heads(halves, 1).slice(0, 3)).toEqual(["ותשמע", "תזל", "וכרביבים"]);
    // « ואילים » finit sa ligne : la suivante commence par « בני ».
    expect(heads(halves)[22]).toBe("בני");
    expect(song[70].kind).toBe("blank");
    const before = scrollColumns(vayelech.layout, vayelech.verses)!.at(-1)!.rows;
    expect(heads(before.slice(-6))).toEqual("ואעידה אחרי הדרך באחרית להכעיסו קהל".split(" "));
  });

  it("désigne des lettres du texte pour les grandes et les petites", () => {
    for (const { id, layout, verses } of parashiot) {
      for (const [v, w, letter] of [...layout.big, ...layout.small]) {
        expect(verses[v]?.[w]?.[letter], `paracha ${id}, lettre ${v}:${w}:${letter}`).toMatch(
          /[א-ת]/,
        );
      }
    }
  });
});
