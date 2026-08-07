/**
 * Relit les QR codes tels qu'ils apparaissent dans les PNG finaux et vérifie
 * qu'ils pointent bien où on croit.
 *
 *   npm install --no-save jsqr pngjs && node marketing/verify-qr.mjs
 *
 * On décode l'affiche rendue, pas le SVG source : c'est le seul moyen de
 * détecter qu'un QR a été rogné, écrasé ou rendu trop petit par la mise en
 * page. Une affiche part à l'impression et se retrouve punaisée pendant des
 * mois — un QR mort ne se rattrape pas.
 */
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "out");

const EXPECTED = {
  "affiche-generale-A4.png": "https://petite-jerusalem.fr",
  "affiche-generale-whatsapp.png": "https://petite-jerusalem.fr",
  "affiche-horaires-A4.png": "https://petite-jerusalem.fr/horaires",
  "affiche-horaires-whatsapp.png": "https://petite-jerusalem.fr/horaires",
};

let failed = 0;

for (const [file, expected] of Object.entries(EXPECTED)) {
  const png = PNG.sync.read(readFileSync(resolve(outDir, file)));
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

  if (!result) {
    console.error(`✗ ${file} — aucun QR code lisible dans l'image`);
    failed++;
  } else if (result.data !== expected) {
    console.error(`✗ ${file} — pointe vers « ${result.data} », attendu « ${expected} »`);
    failed++;
  } else {
    console.log(`✓ ${file} → ${result.data}`);
  }
}

if (failed) {
  console.error(`\n${failed} QR code(s) en échec — ne pas imprimer.`);
  process.exit(1);
}
console.log("\nTous les QR codes sont lisibles et pointent au bon endroit.");
