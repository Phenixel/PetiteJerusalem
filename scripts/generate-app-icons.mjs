#!/usr/bin/env node
/**
 * Rasterise les icônes de l'application depuis leur source vectorielle
 * (scripts/lib/app-icon.mjs) avec le Chromium de Playwright.
 *
 * Les fichiers produits sont versionnés : ce script ne tourne qu'à la main,
 * quand le dessin change. Ni `npm run build` ni les scripts setup-* ne
 * l'appellent, ils se contentent de recopier ce qui est là (un poste ou un
 * runner de CI n'a donc jamais besoin d'un navigateur pour fabriquer l'app).
 *
 * Ce qu'il écrit :
 *   assets/logo.png                       icône claire, source de
 *                                         @capacitor/assets (icônes legacy,
 *                                         écrans de lancement, fiches des
 *                                         boutiques)
 *   assets/themed/icon-dark.png           variante sombre iOS 18
 *   assets/themed/icon-tinted.png         variante teintée iOS 18
 *   assets/themed/monochrome-<densité>.png couche monochrome des icônes
 *                                         thématiques Android 13+
 *
 * Usage :
 *   node scripts/generate-app-icons.mjs            toutes les variantes
 *   node scripts/generate-app-icons.mjs --check    vérifie sans rien écrire
 *                                                  (sortie non nulle si un
 *                                                  fichier a dérivé)
 *
 * Variable d'environnement (optionnelle) :
 *   PJ_CHROMIUM   chemin d'un Chromium déjà installé, quand celui de
 *                 Playwright ne peut pas être téléchargé (image de CI,
 *                 machine hors ligne).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ANDROID_DENSITIES, appIconSvg } from "./lib/app-icon.mjs";

const root = join(import.meta.dirname, "..");
const themedDir = join(root, "assets/themed");
const check = process.argv.includes("--check");

/** Les fichiers à produire : chemin, variante et côté en pixels. */
const OUTPUTS = [
  { path: "assets/logo.png", variant: "light", px: 1024 },
  { path: "assets/themed/icon-dark.png", variant: "dark", px: 1024 },
  { path: "assets/themed/icon-tinted.png", variant: "tinted", px: 1024 },
  ...ANDROID_DENSITIES.map(({ name, px }) => ({
    path: `assets/themed/monochrome-${name}.png`,
    variant: "monochrome",
    px,
  })),
];

/**
 * Chromium de Playwright de préférence, celui du système en dépannage : sur un
 * poste neuf le navigateur n'est pas encore téléchargé, on le fait venir plutôt
 * que d'échouer (même repli que scripts/store-screenshots.mjs).
 */
async function launchBrowser() {
  const { chromium } = await import("playwright");
  if (process.env.PJ_CHROMIUM) {
    return chromium.launch({ executablePath: process.env.PJ_CHROMIUM });
  }
  try {
    return await chromium.launch();
  } catch {
    console.warn("generate-app-icons: Chromium absent, installation…");
    execFileSync("npx", ["playwright", "install", "chromium"], { stdio: "inherit", cwd: root });
    return chromium.launch();
  }
}

/** Le SVG rendu en PNG, à la taille exacte demandée, fond transparent compris. */
async function rasterize(browser, svg, px) {
  const page = await browser.newPage({ viewport: { width: px, height: px } });
  await page.setContent(
    `<!doctype html><meta charset="utf-8">` +
      `<style>html,body{margin:0;padding:0;background:transparent}` +
      `svg{display:block;width:100vw;height:100vh}</style>${svg}`,
  );
  const png = await page.screenshot({ omitBackground: true });
  await page.close();
  return png;
}

const browser = await launchBrowser();
const drifted = [];
let written = 0;

for (const { path, variant, px } of OUTPUTS) {
  const png = await rasterize(browser, appIconSvg(variant), px);
  const target = join(root, path);
  const same = existsSync(target) && readFileSync(target).equals(png);
  if (check) {
    if (!same) drifted.push(path);
    continue;
  }
  if (same) continue;
  mkdirSync(themedDir, { recursive: true });
  writeFileSync(target, png);
  console.log(`generate-app-icons: ${path} (${px}px)`);
  written++;
}

await browser.close();

if (check) {
  if (drifted.length) {
    console.error(
      "generate-app-icons: ces fichiers ne correspondent plus à la source vectorielle :\n" +
        drifted.map((path) => `  ${path}`).join("\n") +
        "\n  Relancer : node scripts/generate-app-icons.mjs",
    );
    process.exit(1);
  }
  console.log("generate-app-icons: toutes les icônes sont à jour.");
} else {
  console.log(
    written
      ? `generate-app-icons: ${written} fichier(s) écrit(s).`
      : "generate-app-icons: rien à faire, tout était à jour.",
  );
}
