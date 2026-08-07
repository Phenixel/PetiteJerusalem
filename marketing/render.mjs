/**
 * Rend les affiches HTML en fichiers partageables.
 *
 *   node marketing/render.mjs             # tout
 *   node marketing/render.mjs generale    # seulement les affiches dont le nom contient « generale »
 *
 * Produit dans `marketing/out/` :
 *   - un PNG par affiche (A4 en ~190 dpi, carré en 1080×1080) — WhatsApp
 *   - un PDF par affiche A4 — impression
 *
 * Prérequis : Playwright + Chromium. Le conteneur de dev les fournit déjà
 * (PLAYWRIGHT_BROWSERS_PATH) ; en local : `npx playwright install chromium`.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "out");

const POSTERS = [
  { file: "generale-a4.html", out: "affiche-generale-A4", format: "a4" },
  { file: "generale-carre.html", out: "affiche-generale-whatsapp", format: "square" },
  { file: "horaires-a4.html", out: "affiche-horaires-A4", format: "a4" },
  { file: "horaires-carre.html", out: "affiche-horaires-whatsapp", format: "square" },
];

// A4 à 96 dpi = 794 × 1123 px ; ×2 à la capture ≈ 190 dpi, largement assez
// pour une impression de bureau tout en gardant un PNG partageable.
const SIZES = {
  a4: { width: 794, height: 1123, scale: 2 },
  square: { width: 1080, height: 1080, scale: 1 },
};

const filter = process.argv[2];
const todo = filter ? POSTERS.filter((p) => p.file.includes(filter)) : POSTERS;

if (!todo.length) {
  console.error(`Aucune affiche ne correspond à « ${filter} ».`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

for (const poster of todo) {
  const { width, height, scale } = SIZES[poster.format];
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: scale,
  });

  await page.goto(pathToFileURL(resolve(here, "affiches", poster.file)).href, {
    waitUntil: "load",
  });
  // Les woff2 sont en `font-display: block` : sans cette attente, la capture
  // peut partir avant la substitution et figer le texte en police système.
  await page.evaluate(() => document.fonts.ready);

  const sheet = page.locator(".sheet");
  await sheet.screenshot({ path: resolve(outDir, `${poster.out}.png`) });
  console.log(`✓ ${poster.out}.png`);

  if (poster.format === "a4") {
    await page.pdf({
      path: resolve(outDir, `${poster.out}.pdf`),
      format: "A4",
      printBackground: true,
    });
    console.log(`✓ ${poster.out}.pdf`);
  }

  await page.close();
}

await browser.close();

// Garde-fou : une affiche qui déborde de sa page se voit tout de suite à
// l'écran mais pas dans un PNG rogné. On le signale plutôt que de le taire.
console.log(`\nFichiers dans marketing/out/ — vérifiez qu'aucun texte n'est coupé en bas de page.`);
