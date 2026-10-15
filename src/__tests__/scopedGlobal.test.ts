import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * Dans un `<style scoped>`, Vue réduit `:global(.a) .b` à `.a` : tout ce qui
 * suit la parenthèse est jeté (les illustrations le notent déjà en
 * commentaire), et la règle s'applique à `.a` lui-même. Écrite
 * pour viser un élément dans l'app (`:global(.native-app) .volet`), elle
 * s'appliquait à toute la page (`<html class="native-app">`). Le sélecteur
 * entier va dans la parenthèse : `:global(.native-app .volet)`.
 */

const SRC = resolve(__dirname, "..");

function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : vueFiles(path);
    return name.endsWith(".vue") ? [path] : [];
  });
}

describe(":global dans les styles scoped", () => {
  it("n'est jamais suivi d'un sélecteur que Vue jetterait", () => {
    const fautifs: string[] = [];
    for (const file of vueFiles(SRC)) {
      const source = readFileSync(file, "utf8");
      for (const style of source.matchAll(/<style[^>]*\bscoped\b[^>]*>([\s\S]*?)<\/style>/g)) {
        // Les commentaires citent parfois la règle elle-même : hors jeu.
        const css = style[1].replace(/\/\*[\s\S]*?\*\//g, "");
        for (const m of css.matchAll(/:global\([^)]*\)\s*[^\s{,]/g)) {
          fautifs.push(`${relative(SRC, file)} : ${m[0]}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });
});
