import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function sourceFiles(dir: string, extensions: string[], out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (name !== "__tests__") sourceFiles(full, extensions, out);
    } else if (extensions.some((extension) => name.endsWith(extension))) out.push(full);
  }
  return out;
}

const vueFiles = (dir: string) => sourceFiles(dir, [".vue"]);

/**
 * `v-model` laisse tomber les frappes tant que le clavier compose le mot en
 * cours (Gboard, saisie intuitive iOS) : la liste filtrée ne se rafraîchissait
 * qu'à l'espace ou à « Entrée ». Les barres de recherche lisent donc
 * l'événement elles-mêmes, via `:value` + `@input="… = liveValue($event)"`.
 */
describe("barres de recherche", () => {
  const offenders: string[] = [];
  for (const file of vueFiles(SRC)) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/v-model(?:\.\w+)*="([\w.]*(?:earch|uery)[\w.]*)"/g)) {
      offenders.push(`${path.relative(SRC, file)} → v-model="${match[1]}"`);
    }
  }

  it("suivent la frappe sans attendre la fin de la composition du clavier", () => {
    expect(offenders).toEqual([]);
  });
});

/**
 * Une recherche passe par services/fuzzySearch (`searchItems`), jamais par
 * un filtre écrit sur place : `nom.toLowerCase().includes(terme)` ne trouve
 * que la graphie exacte, ni « Chabbat » pour « Shabbat », ni « Genève » tapé
 * sans accent. Cinq barres du site en avaient chacune leur copie.
 */
describe("filtres de recherche", () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(SRC, [".vue", ".ts"])) {
    if (file.endsWith(path.join("services", "fuzzySearch.ts"))) continue;
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(
      /\.to(?:Locale)?LowerCase\(\)\s*\.(?:includes|startsWith|indexOf)\(/g,
    )) {
      const line = source.slice(0, match.index).split("\n").length;
      offenders.push(`${path.relative(SRC, file)}:${line}`);
    }
  }

  it("passent par la recherche tolérante commune", () => {
    expect(offenders).toEqual([]);
  });
});
