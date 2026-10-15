/**
 * Capture notre rendu d'une page, dans la forme du livre, pour le comparer au
 * scan (compare.py) : chaque amoud d'un chapitre de guemara en forme « Page »,
 * ou une paracha en forme « Sefer Torah ».
 *
 *   node scripts/layout/capture.mjs <adresse de l'app> <chemin> <dossier>
 *   node scripts/layout/capture.mjs http://localhost:5173 /bibliotheque/talmud/berakhot/1 /tmp/rendu
 *
 * L'app doit tourner (npm run dev). Les captures vont hors du dépôt.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const [base, path, out] = process.argv.slice(2);
if (!base || !path || !out) {
  console.error("Usage : node scripts/layout/capture.mjs <adresse> <chemin> <dossier>");
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1100, height: 1400 },
  deviceScaleFactor: 2,
});
// La forme de la page est une préférence de l'appareil (usePageForm).
await page.addInitScript(() => {
  localStorage.setItem("pj-page-form", "1");
});
await page.goto(base + path, { waitUntil: "networkidle" });
await page.waitForSelector(".daf-page, .torah-scroll", { timeout: 30000 });
await page.evaluate(() => document.fonts.ready);
// Le bandeau de mesure d'audience : on refuse, puis on écarte ce qui flotte
// au-dessus de la page (barres, pastilles) pour ne capturer que le texte.
const decline = page.getByRole("button", { name: /^(Decline|Refuser|Non merci)/i });
if (await decline.count()) await decline.first().click();
await page.addStyleTag({ content: ".fixed, .sticky { visibility: hidden !important; }" });
await page.waitForTimeout(1500);

const dafs = page.locator(".daf-page");
if ((await dafs.count()) > 0) {
  // Les amoudim se composent à mesure qu'on descend : on avance jusqu'au
  // dernier, en recomptant.
  let i = 0;
  for (; i < (await dafs.count()); i++) {
    const daf = dafs.nth(i);
    await daf.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await daf.screenshot({ path: join(out, `daf-${String(i).padStart(2, "0")}.png`) });
  }
  console.log(`${i} amoudim dans ${out}`);
} else {
  const scroll = page.locator(".torah-scroll").first();
  await scroll.screenshot({ path: join(out, "torah.png") });
  console.log(`paracha dans ${out}`);
}
await browser.close();
