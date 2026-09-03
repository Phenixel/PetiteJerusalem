// @vitest-environment node
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Pas de tiret long dans le dépôt : ni cadratin (U+2014), ni demi-cadratin
 * (U+2013). La règle vaut pour tout ce qui s'écrit ici, code et contenus
 * compris (voir CLAUDE.md) ; ce test la tient, plutôt qu'une relecture.
 *
 * Deux exceptions, pour la même raison : les corpus importés sous
 * `public/texts/` (Talmud, Michna, Tanakh, Tehilim), qui viennent de Sefaria,
 * et la licence Creative Commons. Ce n'est pas de la rédaction, et leur
 * ponctuation appartient à leur source. Les fichiers de tefila, eux, sont
 * écrits ici : ils suivent la règle.
 */

// Écrits en échappement : le test se lit lui-même, un caractère en clair ici
// le ferait échouer sur son propre fichier.
const EM_DASH = "\u2014";
const EN_DASH = "\u2013";

/** Les fichiers versionnés qu'on écrit : ni corpus importé, ni binaire. */
const BINARY = /\.(png|jpe?g|gif|webp|ico|svg|pdf|zip|jar|keystore|ttf|otf|woff2?|mp3|mp4)$/i;
/** Textes imposés, qu'on n'écrit pas : la licence Creative Commons. */
const VERBATIM = new Set(["LICENSE"]);

function repoFiles(): string[] {
  const listed = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n");
  return listed.filter(
    (path) =>
      path &&
      !BINARY.test(path) &&
      !VERBATIM.has(path) &&
      !(path.startsWith("public/texts/") && !path.includes("/tefila/")),
  );
}

describe("typographie du dépôt", () => {
  it("ne porte aucun tiret long", () => {
    const offenders: string[] = [];
    for (const path of repoFiles()) {
      let content: string;
      try {
        content = readFileSync(path, "utf8");
      } catch {
        continue; // Fichier binaire ou absent du disque : rien à lire.
      }
      content.split("\n").forEach((line, index) => {
        if (line.includes(EM_DASH) || line.includes(EN_DASH)) {
          offenders.push(`${path}:${index + 1} → ${line.trim().slice(0, 80)}`);
        }
      });
    }
    expect(offenders, "Voir CLAUDE.md : deux-points, virgule ou point-virgule").toEqual([]);
  });
});
