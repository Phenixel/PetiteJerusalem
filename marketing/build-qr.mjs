/**
 * Génère les QR codes des affiches en SVG, à partir de la librairie déjà
 * vendorée dans le site (`public/vendor/qrcode-generator.js`) — même rendu que
 * le QR affiché dans l'app (ShareModal), aucune dépendance réseau.
 *
 *   node marketing/build-qr.mjs
 *
 * Les SVG produits sont commités : `render.mjs` n'a pas besoin de rejouer cette
 * étape, elle n'est à relancer que si une URL change ci-dessous.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..");

// Le repo est en `"type": "module"` : un `import`/`require` du fichier vendoré
// le charge comme ESM, sa branche UMD `module.exports` ne s'exécute pas et on
// récupère un namespace vide. On évalue donc la source telle quelle (c'est un
// script navigateur qui déclare `var qrcode` au niveau global) et on renvoie
// la factory.
const source = readFileSync(resolve(repo, "public/vendor/qrcode-generator.js"), "utf8");
const qrcode = new Function(`${source}\nreturn qrcode;`)();

/** Les cibles de chaque affiche. Une seule URL par affiche : deux QR côte à
 *  côte sur un panneau de synagogue, personne ne sait lequel scanner. */
const TARGETS = [
  { name: "qr-site", url: "https://petite-jerusalem.fr" },
  { name: "qr-horaires", url: "https://petite-jerusalem.fr/horaires" },
];

/** Correction d'erreur haute : l'affiche est imprimée, punaisée, photographiée
 *  de travers — on veut qu'elle reste scannable même abîmée. */
const ERROR_CORRECTION = "H";

function toSvg(url, { dark = "#17497f", quiet = 2 } = {}) {
  const qr = qrcode(0, ERROR_CORRECTION); // 0 = choisit la plus petite version qui rentre
  qr.addData(url);
  qr.make();

  const n = qr.getModuleCount();
  const size = n + quiet * 2;

  // Un seul <path> pour tous les modules noirs : SVG compact et net à
  // n'importe quelle taille d'impression.
  let d = "";
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.isDark(row, col)) d += `M${col + quiet} ${row + quiet}h1v1h-1z`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code vers ${url}">
<rect width="${size}" height="${size}" fill="#ffffff"/>
<path d="${d}" fill="${dark}"/>
</svg>
`;
}

const outDir = resolve(here, "affiches/qr");
mkdirSync(outDir, { recursive: true });

for (const { name, url } of TARGETS) {
  const svg = toSvg(url);
  writeFileSync(resolve(outDir, `${name}.svg`), svg);
  console.log(`✓ ${name}.svg → ${url}`);
}
