#!/usr/bin/env node
/**
 * Gathers the media the composition reads, from the repository itself, so
 * nothing but the source is versioned:
 *
 * - the app's screens: the store listing screenshots (store-assets/), and
 *   three screens cut out of the published 4.0 video (public/videos/), which
 *   films the app on its demo data: the Sidour on the moment, the home page
 *   at 106 days and Mon parcours;
 * - the designer's logo (assets/brand/);
 * - the fonts, Manrope and Playfair Display, from promo/'s Fontsource
 *   packages (`npm ci` in promo/ first).
 *
 * Usage: node scripts/preparer.mjs
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const depot = join(root, "../..");
const dossier = (...p) => {
  const d = join(root, "assets", ...p);
  mkdirSync(d, { recursive: true });
  return d;
};

const ecrans = dossier("ecrans");
const STORE = ["02-horaires", "03-partage-session", "05-bibliotheque", "07-chiour"];
for (const nom of STORE) {
  copyFileSync(join(depot, "store-assets/screenshots/fr-FR", `phone-${nom}.jpg`), join(ecrans, `${nom}.jpg`));
}

// The 4.0 video is 720 x 1280; its phone's screen spans x 168 to 552 and,
// under the status bar, y 478 to 1262. Doubled with Lanczos, lightly
// sharpened: the composition shows it at about 1.5 times its size.
const VIDEO = join(depot, "public/videos/nouveautes-4.0-fr.mp4");
const IMAGES_40 = { sidour: 17.2, accueil: 41, parcours: 46.2 };
for (const [nom, t] of Object.entries(IMAGES_40)) {
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-ss", String(t), "-i", VIDEO, "-frames:v", "1",
    "-vf", "crop=384:784:168:478,scale=768:1568:flags=lanczos,unsharp=5:5:0.6",
    "-q:v", "2", join(ecrans, `v4-${nom}.jpg`),
  ]);
}

const marque = dossier("marque");
copyFileSync(join(depot, "assets/brand/logo-transparent.png"), join(marque, "logo-transparent.png"));

const fontsource = join(root, "../node_modules/@fontsource");
if (!existsSync(fontsource)) throw new Error("Fonts not found: run npm ci in promo/ first");
const polices = dossier("fonts");
for (const w of [400, 500, 600, 700, 800]) {
  copyFileSync(join(fontsource, "manrope/files", `manrope-latin-${w}-normal.woff2`), join(polices, `manrope-latin-${w}-normal.woff2`));
}
for (const w of [400, 500, 600, 700]) {
  for (const style of ["normal", "italic"]) {
    const nom = `playfair-display-latin-${w}-${style}.woff2`;
    copyFileSync(join(fontsource, "playfair-display/files", nom), join(polices, nom));
  }
}
console.log("assets: screens, logo and fonts in place");
