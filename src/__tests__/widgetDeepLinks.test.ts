import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isAppLinkPath } from "../../scripts/lib/app-links.mjs";

/**
 * Toucher un widget doit ouvrir la bonne page.
 *
 * Entre le doigt et la page, trois pièces doivent s'accorder, et rien ne
 * signale leur désaccord : le widget porte une URL (`widgetURL`), le listener
 * `appUrlOpen` de src/main.ts n'accepte QUE l'hôte petite-jerusalem.fr, et le
 * routeur doit reconnaître le chemin. Une faute sur l'une des trois ouvre
 * l'app sur sa page d'accueil, sans erreur, sans trace : le widget a l'air de
 * marcher, il n'emmène simplement nulle part.
 *
 * Android passe par un autre chemin : ses widgets ouvrent une URL https du
 * site, qui doit donc être un lien d'application déclaré, sans quoi le
 * toucher ouvre le navigateur au lieu de l'app.
 *
 * Les sources natives sont lues au texte, comme dans appLinks.test.ts : ni le
 * Swift ni le Java ne se compilent ici, et ce sont bien ces fichiers-là qui
 * partent dans les apps.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Le schéma d'URL des widgets, celui que setup-ios.mjs déclare à iOS. */
const SCHEME = "petitejerusalem";
/** Le seul hôte que le listener de src/main.ts accepte de router. */
const HOST = "petite-jerusalem.fr";

/** Les destinations des widgets, lues dans leur source Swift. */
function widgetUrls(): string[] {
  const source = readFileSync(root + "/native/ios/PjWidgets/PjWidgets.swift", "utf8");
  return [...source.matchAll(/"(petitejerusalem:\/\/[^"]+)"/g)].map(([, url]) => url);
}

/**
 * Les chemins du routeur, en expressions régulières : une route paramétrée
 * porte souvent sa contrainte (`:corpus(tehilim|sidour|…)`), qui est
 * exactement ce qui décide si `/bibliotheque/sidour` s'ouvre ou non.
 */
function routerMatchers(): RegExp[] {
  const source = readFileSync(root + "/src/router/routes.ts", "utf8");
  return [...source.matchAll(/^\s*path: "(\/[^"]*)"/gm)]
    .map(([, path]) => path)
    // Le fourre-tout des 404 accepterait tout, y compris une faute de frappe.
    .filter((path) => !path.startsWith("/:pathMatch"))
    .map((path) => {
      const pattern = path
        // `:corpus(tehilim|michna)` : la contrainte EST l'expression.
        .replace(/:\w+\(([^)]*)\)/g, "($1)")
        // `:slug` sans contrainte : un segment quelconque.
        .replace(/:\w+/g, "[^/]+");
      return new RegExp(`^${pattern}$`);
    });
}

/** Les destinations des widgets Android, lues dans leurs providers Java. */
function androidWidgetUrls(): string[] {
  const dir = root + "/native/android/app/src/main/java/fr/petitejerusalem/app";
  return ["HorairesWidgetProvider", "LectureWidgetProvider"].flatMap((name) => {
    const source = readFileSync(`${dir}/${name}.java`, "utf8");
    return [...source.matchAll(/return "(https:\/\/[^"]+)"/g)].map(([, url]) => url);
  });
}

describe("destinations des widgets", () => {
  const urls = widgetUrls();

  it("porte une URL par widget, aucune oubliée", () => {
    // Huit `widgetURL` pour huit widgets : trois grands (horaires, horaires
    // essentiels, lecture) et cinq raccourcis.
    expect(urls).toHaveLength(8);
  });

  it("n'ouvre que des chemins que le routeur reconnaît", () => {
    const matchers = routerMatchers();
    const unmatched: string[] = [];
    for (const url of urls) {
      const parsed = new URL(url);
      // L'hôte d'abord : le listener écarte tout le reste en silence, un
      // callback OAuth natif ne devant pas faire naviguer l'app.
      expect(parsed.protocol).toBe(`${SCHEME}:`);
      expect(parsed.hostname).toBe(HOST);
      if (!matchers.some((matcher) => matcher.test(parsed.pathname))) {
        unmatched.push(parsed.pathname);
      }
    }
    expect(unmatched, "chemins qu'aucune route ne reconnaît").toEqual([]);
  });

  it("emmène bien là où chaque widget le promet", () => {
    // Les destinations attendues, écrites ici plutôt que déduites : un
    // raccourci qu'on rebranche par erreur sur la mauvaise page se verrait.
    expect([...new Set(urls.map((url) => new URL(url).pathname))].sort()).toEqual([
      "/bibliotheque",
      "/bibliotheque/lecture-du-jour",
      "/bibliotheque/sidour",
      "/bibliotheque/tehilim",
      "/horaires",
    ]);
  });

  it("garde le schéma déclaré à iOS par le scaffold", () => {
    // setup-ios.mjs pose ce schéma dans CFBundleURLTypes ; s'il changeait
    // d'un côté seulement, aucun widget n'ouvrirait plus rien.
    const setup = readFileSync(root + "/scripts/setup-ios.mjs", "utf8");
    expect(setup).toContain(`"${SCHEME}"`);
  });

  it("ne route que l'hôte du site, dans src/main.ts", () => {
    const main = readFileSync(root + "/src/main.ts", "utf8");
    expect(main).toContain(`parsed.hostname !== "${HOST}"`);
  });
});

describe("destinations des widgets Android", () => {
  const urls = androidWidgetUrls();

  it("ouvre l'app, et non le navigateur", () => {
    expect(urls).toHaveLength(2);
    const matchers = routerMatchers();
    const unmatched: string[] = [];
    // Un chemin absent de la liste des liens d'application s'ouvrirait dans
    // le navigateur : le widget aurait l'air de marcher, il sortirait
    // simplement de l'app.
    const browserBound: string[] = [];
    for (const url of urls) {
      const parsed = new URL(url);
      expect(parsed.hostname).toBe(HOST);
      if (!matchers.some((matcher) => matcher.test(parsed.pathname))) {
        unmatched.push(parsed.pathname);
      }
      if (!isAppLinkPath(parsed.pathname)) browserBound.push(parsed.pathname);
    }
    expect(unmatched, "chemins qu'aucune route ne reconnaît").toEqual([]);
    expect(browserBound, "chemins qui ouvriraient le navigateur").toEqual([]);
  });
});
