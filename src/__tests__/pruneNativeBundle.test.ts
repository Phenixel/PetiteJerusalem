import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Le bundle natif (Capacitor) ne doit rien garder du prérendu SEO : ni les
 * pages HTML générées pour les moteurs (accueil SEO, /horaires, bibliothèque),
 * ni les fichiers pour robots (sitemap, robots.txt, llms.txt). L'app démarre
 * sur la coquille nue : le texte SEO n'existe que sur le site web.
 */

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "scripts",
  "prune-native-bundle.mjs",
);

const SEO_HOME = "<div id=\"app\"><main class=\"seo-article\"><h1>Accueil SEO</h1></main></div>";
const BARE_SHELL = '<div id="app"></div>';

function write(root: string, relative: string, content: string): void {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf-8");
}

describe("prune-native-bundle", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "pj-prune-"));
    // Un dist miniature : l'entrée SEO, la coquille, des pages prérendues,
    // les fichiers robots, un corpus lourd, et ce que l'app doit garder.
    write(root, "index.html", SEO_HOME);
    write(root, "app.html", BARE_SHELL);
    write(root, "horaires.html", "seo");
    write(root, "horaires/marseille.html", "seo");
    write(root, "bibliotheque/tehilim/1.html", "seo");
    write(root, "sitemap.xml", "<urlset/>");
    write(root, "robots.txt", "User-agent: *");
    write(root, "llms.txt", "# Petite Jérusalem");
    write(root, "texts/talmud/berakhot.json", "{}");
    write(root, "texts/tehilim.json", "{}");
    write(root, "assets/app.js", "//");
    execFileSync("node", [SCRIPT, root]);
  });

  it("remplace l'entrée par la coquille nue : aucun texte SEO au lancement", () => {
    expect(readFileSync(join(root, "index.html"), "utf-8")).toBe(BARE_SHELL);
  });

  it("retire toutes les pages HTML prérendues et leurs dossiers", () => {
    for (const gone of ["app.html", "horaires.html", "horaires", "bibliotheque"]) {
      expect(existsSync(join(root, gone))).toBe(false);
    }
  });

  it("retire les fichiers destinés aux robots", () => {
    for (const gone of ["sitemap.xml", "robots.txt", "llms.txt"]) {
      expect(existsSync(join(root, gone))).toBe(false);
    }
  });

  it("retire les corpus téléchargeables mais garde le reste", () => {
    expect(existsSync(join(root, "texts/talmud"))).toBe(false);
    expect(existsSync(join(root, "texts/tehilim.json"))).toBe(true);
    expect(existsSync(join(root, "assets/app.js"))).toBe(true);
  });
});
