// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function vueFiles(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (name !== "__tests__") vueFiles(full, out);
    } else if (name.endsWith(".vue")) out.push(full);
  }
  return out;
}

/** Ce qui suit la parenthèse fermante d'un `:global(` ouvert à `start`. */
function afterGlobal(css: string, start: number): string {
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "(") depth++;
    else if (css[i] === ")" && --depth === 0) return css.slice(i + 1).trimStart();
  }
  return "";
}

/**
 * Dans un style `scoped`, le compilateur de Vue garde ce qui est entre les
 * parenthèses de `:global(…)` et jette tout ce qui suit : écrit
 * `:global([dir="rtl"]) .mur .pierre`, la règle devient `[dir="rtl"]` seul et
 * déplace tout élément en hébreu. Le sélecteur entier va dans `:global()`, ou
 * l'on écrit l'ancêtre sans lui (`:root.dark .planche`), ce que le style
 * `scoped` sait déjà faire.
 */
describe("styles scoped", () => {
  const offenders: string[] = [];
  for (const file of vueFiles(SRC)) {
    const source = fs.readFileSync(file, "utf8");
    for (const style of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      // Les commentaires blanchis, pas retirés : les numéros de ligne restent justes.
      const css = style[1].replace(/\/\*[\s\S]*?\*\//g, (comment) =>
        comment.replace(/[^\n]/g, " "),
      );
      const offset = style.index + style[0].indexOf(style[1]);
      for (const match of css.matchAll(/:global\(/g)) {
        const next = afterGlobal(css, match.index + ":global".length);
        if (next[0] !== "{" && next[0] !== ",") {
          const line = source.slice(0, offset + match.index).split("\n").length;
          offenders.push(`${path.relative(SRC, file)}:${line}`);
        }
      }
    }
  }

  it("mettent tout le sélecteur dans :global(), rien après", () => {
    expect(offenders).toEqual([]);
  });
});
