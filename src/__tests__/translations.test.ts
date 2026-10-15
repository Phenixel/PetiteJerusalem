// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseContent, resolveFilePath, richRuns } from "../services/textService";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";

/**
 * Les traductions (public/texts/traductions/, docs/traductions.md) : chaque
 * ligne traduite doit tomber sous l'hébreu qu'elle traduit, et chaque
 * traduction doit venir d'une source qu'on a le droit de reprendre.
 *
 * Le lecteur parcourt l'hébreu et la traduction ensemble, chaîne par chaîne
 * (textService.alignTranslation) : un fichier de traduction qui n'a plus la
 * forme de son hébreu (un texte hébreu retéléchargé, une traduction
 * reconstruite à part) décalerait tout ce qui suit d'un verset, sans erreur.
 * D'où ce test, qui se lit avec scripts/download-translations.mjs.
 */

const TEXTS = resolve(__dirname, "../../public/texts");
const entries = (textStudiesJson as TextStudiesJson).textStudies;

const cache = new Map<string, unknown>();
function read(webPath: string): unknown {
  if (!cache.has(webPath)) {
    cache.set(
      webPath,
      JSON.parse(readFileSync(resolve(TEXTS, webPath.slice("/texts/".length)), "utf8")),
    );
  }
  return cache.get(webPath);
}

const index = (read("/texts/traductions/index.json") as { files: Record<string, string[]> }).files;
const translationOf = (path: string, lang: string) =>
  path.replace(/^\/texts\//, `/texts/traductions/${lang}/`);

/** Là où est l'hébreu dans un fichier : ce dont la traduction prend la forme. */
function hebrewRoot(path: string, data: Record<string, unknown>): unknown {
  if (path === "/texts/tehilim.json") {
    return Object.fromEntries(
      Object.entries(data).map(([n, psalm]) => [n, (psalm as { he: unknown }).he]),
    );
  }
  if (path.startsWith("/texts/moussar/")) {
    return (data.sections as { he: unknown }[]).map((s) => s.he);
  }
  return data.he;
}

/** Le premier endroit où deux valeurs n'ont pas la même forme, ou null. */
function shapeMismatch(he: unknown, tr: unknown, at = ""): string | null {
  if (typeof he === "string") return typeof tr === "string" ? null : `${at} : pas une chaîne`;
  if (Array.isArray(he)) {
    if (!Array.isArray(tr) || tr.length !== he.length) return `${at} : longueur`;
    for (let i = 0; i < he.length; i++) {
      const found = shapeMismatch(he[i], tr[i], `${at}/${i}`);
      if (found) return found;
    }
    return null;
  }
  if (he && typeof he === "object") {
    if (!tr || typeof tr !== "object") return `${at} : pas un objet`;
    for (const key of Object.keys(he)) {
      const found = shapeMismatch(
        (he as Record<string, unknown>)[key],
        (tr as Record<string, unknown>)[key],
        `${at}/${key}`,
      );
      if (found) return found;
    }
    return null;
  }
  return null;
}

type TalmudChapters = Parameters<typeof parseContent>[2];

const ALLOWED_LICENSES = ["Public Domain", "CC0", "CC-BY", "CC-BY-SA", "CC-BY-NC"];

describe("traductions des textes", () => {
  it("a, pour chaque texte de l'index, un fichier de la forme de son hébreu", () => {
    expect(Object.keys(index).length).toBeGreaterThan(200);
    for (const [path, langs] of Object.entries(index)) {
      const he = hebrewRoot(path, read(path) as Record<string, unknown>);
      for (const lang of langs) {
        const file = translationOf(path, lang);
        expect(existsSync(resolve(TEXTS, file.slice("/texts/".length))), `${file}`).toBe(true);
        const tr = (read(file) as { lang: string; text: unknown }).text;
        expect((read(file) as { lang: string }).lang, `${file}`).toBe(lang);
        expect(shapeMismatch(he, tr), `${file}`).toBeNull();
      }
    }
  });

  it("ne reprend que des traductions humaines, sous une licence libre, citées", () => {
    for (const [path, langs] of Object.entries(index)) {
      for (const lang of langs) {
        const file = translationOf(path, lang);
        const { sources } = read(file) as {
          sources: { name: string; license: string; url: string; licenseUrl?: string }[];
        };
        expect(sources.length, `${file}`).toBeGreaterThan(0);
        for (const source of sources) {
          expect(ALLOWED_LICENSES, `${file} : ${source.name}`).toContain(source.license);
          expect(source.name, `${file}`).not.toMatch(/✧|DeepL|Claude|GPT/i);
          expect(source.url, `${file}`).toMatch(/^https:\/\/www\.sefaria\.org\//);
          if (source.license !== "Public Domain") {
            expect(source.licenseUrl, `${file}`).toMatch(/^https:\/\/creativecommons\.org\//);
          }
        }
      }
    }
  });

  /** Les entrées du catalogue dont le fichier est traduit, avec leurs langues. */
  const translated = entries.flatMap((entry: TextStudyJsonEntry) => {
    let path: string;
    try {
      path = resolveFilePath(entry);
    } catch {
      return [];
    }
    return (index[path] ?? []).map((lang) => ({ entry, path, lang }));
  });

  it("aligne la traduction de chaque section sur ses lignes hébraïques", () => {
    const chapters = read("/texts/talmud-chapters.json") as TalmudChapters;
    for (const { entry, path, lang } of translated) {
      const content = parseContent(entry, read(path), chapters, read(translationOf(path, lang)));
      for (const section of content.sections) {
        expect(section.tr?.length, `${entry.name} (${lang}) § ${section.index}`).toBe(
          section.he.length,
        );
      }
    }
  });

  /**
   * Ce que docs/traductions.md annonce, par corpus : une reconstruction qui
   * perdrait des lignes (une version renommée chez Sefaria, un hébreu qui ne
   * se retrouve plus) se voit ici avant d'arriver chez le lecteur.
   */
  it("traduit au moins ce que le registre annonce", () => {
    const MINIMUM: Record<string, number> = {
      "Tanakh/fr": 0.99,
      "Tanakh/en": 0.99,
      "Tehilim/fr": 0.99,
      "Tehilim/en": 0.99,
      "Mishna/en": 0.99,
      "Mishna/fr": 0.99,
      "Talmud Bavli/en": 0.99,
      "Talmud Bavli/fr": 0.99,
      "Moussar/en": 0.95,
      "Moussar/fr": 0.95,
    };
    const chapters = read("/texts/talmud-chapters.json") as TalmudChapters;
    const counts = new Map<string, { lines: number; translated: number }>();
    const seen = new Set<string>();
    for (const { entry, path, lang } of translated) {
      // Un fichier se compte une fois (les 150 psaumes partagent le leur).
      const key = `${String(entry.type)}/${lang}`;
      if (seen.has(`${path}|${lang}|${entry.link}`)) continue;
      seen.add(`${path}|${lang}|${entry.link}`);
      const content = parseContent(entry, read(path), chapters, read(translationOf(path, lang)));
      const count = counts.get(key) ?? { lines: 0, translated: 0 };
      for (const section of content.sections) {
        count.lines += section.he.length;
        count.translated += (section.tr ?? []).filter(Boolean).length;
      }
      counts.set(key, count);
    }
    // 'Hovot Halévavot seulement : le Pélé Yoets n'a pas de traduction.
    const hovot = entries.filter((e) => e.type === "Moussar" && Number(e.id) <= 410);
    for (const lang of ["en", "fr"]) {
      const moussar = { lines: 0, translated: 0 };
      for (const entry of hovot) {
        const path = resolveFilePath(entry);
        const content = parseContent(entry, read(path), {}, read(translationOf(path, lang)));
        for (const section of content.sections) {
          moussar.lines += section.he.length;
          moussar.translated += (section.tr ?? []).filter(Boolean).length;
        }
      }
      counts.set(`Moussar/${lang}`, moussar);
    }
    for (const [key, minimum] of Object.entries(MINIMUM)) {
      const count = counts.get(key);
      expect(count, `${key}`).toBeDefined();
      expect(count!.translated / count!.lines, `${key}`).toBeGreaterThanOrEqual(minimum);
    }
  });

  it("lit le gras et l'italique d'une traduction, sans HTML", () => {
    expect(richRuns("<b>The Rabbis say:</b> until <i>midnight</i>.")).toEqual([
      { text: "The Rabbis say:", bold: true },
      { text: " until " },
      { text: "midnight", italic: true },
      { text: "." },
    ]);
    expect(richRuns("a < b")).toEqual([{ text: "a < b" }]);
  });
});
