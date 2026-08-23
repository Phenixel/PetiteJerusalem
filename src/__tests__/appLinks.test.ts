import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SEO_LOCALE,
  SECTION_SLUGS,
  SEO_LOCALES,
  sectionPath,
  type SeoSection,
} from "../content/seoLocales";
import {
  APP_ID,
  APP_LINK_DOMAIN,
  APP_LINK_PATHS,
  buildAndroidIntentFilter,
  buildAppleAppSiteAssociation,
  buildAssetLinks,
  isAppLinkPath,
} from "../../scripts/lib/app-links.mjs";

/**
 * Un lien du site ouvre l'app installée : ce que le système accepte d'ouvrir
 * est décrit en un seul endroit (scripts/lib/app-links.mjs) et servi par le
 * site (/.well-known). Ce test tient les deux bouts de la liste :
 *
 *  - une route ajoutée au routeur sans son préfixe s'ouvrirait dans le
 *    navigateur, sans que rien ne le signale ;
 *  - un chemin technique attrapé par erreur casserait ce qui vit dessus,
 *    au premier chef `/__/auth/`, la redirection de Firebase Auth.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Les chemins déclarés dans le routeur, lus au texte plutôt qu'importés. */
function routerPaths(): string[] {
  const source = readFileSync(join(root, "src/router/routes.ts"), "utf8");
  return (
    [...source.matchAll(/^\s*path: "(\/[^"]*)"/gm)]
      .map(([, path]) => path)
      // Le fourre-tout des 404 n'est pas une page à ouvrir.
      .filter((path) => !path.startsWith("/:pathMatch"))
      // Les paramètres et leurs contraintes ne comptent pas dans le préfixe.
      .map((path) => path.replace(/\/:.*$/, "") || "/")
  );
}

describe("liens d'application", () => {
  it("couvre toutes les routes du site", () => {
    const paths = [...new Set(routerPaths())];
    // Garde-fou : une lecture qui ne trouve plus rien rendrait le test toujours
    // vert (routes.ts renommé, écriture des `path:` changée).
    expect(paths.length).toBeGreaterThan(15);
    const uncovered = paths.filter((path) => !isAppLinkPath(path));
    expect(
      uncovered,
      `Routes absentes de APP_LINK_PATHS (scripts/lib/app-links.mjs) : leurs liens s'ouvriraient dans le navigateur au lieu de l'app.`,
    ).toEqual([]);
  });

  it("couvre les adresses traduites", () => {
    // Les routes par langue ne sont pas écrites en dur dans le routeur, elles
    // sont dérivées de cette table : la lecture du texte de routes.ts ne les
    // voit pas, il faut les reconstruire ici. C'est ce qui a manqué quand les
    // pages traduites sont arrivées.
    const sections = Object.keys(SECTION_SLUGS) as SeoSection[];
    const uncovered = SEO_LOCALES.flatMap((locale) =>
      sections.map((section) => sectionPath(section, locale)),
    ).filter((path) => !isAppLinkPath(path));
    expect(
      uncovered,
      `Adresses traduites absentes de APP_LINK_PATHS : leurs liens s'ouvriraient dans le navigateur au lieu de l'app.`,
    ).toEqual([]);
    // Le garde-fou de la lecture ci-dessus vaut ici aussi.
    expect(SEO_LOCALES.length).toBeGreaterThan(1);
    expect(sections.length).toBeGreaterThan(5);
    expect(DEFAULT_SEO_LOCALE).toBe("fr");
  });

  it("laisse au navigateur ce qui n'est pas une page", () => {
    for (const path of [
      "/__/auth/handler", // redirection Firebase Auth : l'app la capturerait en pleine connexion
      "/__/auth/iframe",
      "/og/session/exemple.png",
      "/texts/tehilim.json",
      "/assets/index-abc123.js",
      "/fonts/noto-serif-hebrew-var.woff2",
      "/.well-known/assetlinks.json",
      "/sitemap.xml",
    ]) {
      expect(isAppLinkPath(path), `${path} ne doit pas ouvrir l'app`).toBe(false);
    }
  });

  it("ne confond pas un préfixe avec un chemin voisin", () => {
    expect(isAppLinkPath("/tehilim")).toBe(true);
    expect(isAppLinkPath("/tehilim/refoua-chelema")).toBe(true);
    expect(isAppLinkPath("/tehilim-autre-chose")).toBe(false);
    expect(isAppLinkPath("/en")).toBe(true);
    expect(isAppLinkPath("/enorme")).toBe(false);
    expect(isAppLinkPath("/")).toBe(true);
  });

  it("décrit l'app dans les deux fichiers servis par le site", () => {
    const fingerprint = new Array(32).fill("AB").join(":");
    const [assetLink] = buildAssetLinks([fingerprint]);
    expect(assetLink.target.package_name).toBe(APP_ID);
    expect(assetLink.target.sha256_cert_fingerprints).toEqual([fingerprint]);
    expect(assetLink.relation).toEqual(["delegate_permission/common.handle_all_urls"]);

    const [details] = buildAppleAppSiteAssociation("AB12CD34EF").applinks.details;
    expect(details.appIDs).toEqual([`AB12CD34EF.${APP_ID}`]);
    const components = details.components.map((component) => component["/"]);
    expect(components).toContain("/");
    expect(components).toContain("/share-reading");
    expect(components).toContain("/share-reading/*");
    expect(components).not.toContain("/__/auth/*");
  });

  it("déclare le domaine et chaque chemin dans l'intent-filter Android", () => {
    const filter = buildAndroidIntentFilter();
    expect(filter).toContain('android:autoVerify="true"');
    expect(filter).toContain(`<data android:host="${APP_LINK_DOMAIN}" />`);
    expect(filter).toContain('<data android:scheme="https" />');
    for (const path of APP_LINK_PATHS) {
      expect(filter).toContain(`<data android:path="${path}" />`);
    }
    expect(filter).not.toContain('android:pathPrefix="/"');
  });

  it("n'écrit les fichiers .well-known qu'avec de vraies valeurs", () => {
    const script = join(root, "scripts/well-known.mjs");
    const withValues = mkdtempSync(join(tmpdir(), "pj-well-known-"));
    execFileSync("node", [script, withValues], {
      env: {
        ...process.env,
        ANDROID_APP_LINK_SHA256: new Array(32).fill("ab").join(":"),
        IOS_DEVELOPMENT_TEAM: "ab12cd34ef",
      },
    });
    const assetLinks = JSON.parse(
      readFileSync(join(withValues, ".well-known/assetlinks.json"), "utf8"),
    );
    // Normalisées en majuscules : Android compare les empreintes au caractère près.
    expect(assetLinks[0].target.sha256_cert_fingerprints[0]).toBe(
      new Array(32).fill("AB").join(":"),
    );
    const aasa = JSON.parse(
      readFileSync(join(withValues, ".well-known/apple-app-site-association"), "utf8"),
    );
    expect(aasa.applinks.details[0].appIDs).toEqual([`AB12CD34EF.${APP_ID}`]);

    // Empreinte mal formée et Team ID absent : rien d'écrit, plutôt qu'un
    // fichier que le système croirait valide.
    const withoutValues = mkdtempSync(join(tmpdir(), "pj-well-known-"));
    execFileSync("node", [script, withoutValues], {
      env: {
        ...process.env,
        ANDROID_APP_LINK_SHA256: "pas-une-empreinte",
        IOS_DEVELOPMENT_TEAM: "",
        APPLE_TEAM_ID: "",
      },
    });
    expect(() => readFileSync(join(withoutValues, ".well-known/assetlinks.json"))).toThrow();
    expect(() =>
      readFileSync(join(withoutValues, ".well-known/apple-app-site-association")),
    ).toThrow();
  });
});
