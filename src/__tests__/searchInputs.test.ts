import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function vueFiles(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) vueFiles(full, out);
    else if (name.endsWith(".vue")) out.push(full);
  }
  return out;
}

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
