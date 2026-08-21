// Retire du bundle natif (Capacitor) ce qui n'a de sens que sur le web.
//
// 1. Les corpus téléchargeables à la demande : l'app mobile ne doit pas
//    embarquer les ~38 Mo de public/texts. Elle garde seulement les petits
//    fichiers transverses (tehilim.json, ~370 Ko, et talmud-chapters.json,
//    ~40 Ko) et télécharge le reste depuis le site via offlineTextStore.
//
// 2. Les pages HTML prérendues pour les moteurs de recherche (accueil SEO,
//    /horaires, /calendrier, bibliothèque, pages Tehilim par intention...) :
//    dans l'app, la navigation est entièrement côté client, ces fichiers ne
//    sont jamais chargés, et leur texte SEO ne doit pas non plus s'afficher
//    au lancement. L'entrée index.html est donc remplacée par la coquille nue
//    (app.html, celle du rewrite attrape-tout du web), et tous les autres
//    .html sont retirés, ainsi que sitemap.xml, robots.txt et llms.txt, qui
//    parlent aux robots, pas à l'app.
//
// À lancer entre `vite build` et `cap sync` (voir app:build), jamais pour le
// déploiement web, qui sert tout cela depuis dist/.
import { copyFileSync, existsSync, readdirSync, rmdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? "dist";

const PRUNED_DIRS = ["texts/talmud", "texts/mishna", "texts/tanakh", "texts/tefila"].map((d) =>
  join(root, d),
);
const PRUNED_FILES = ["sitemap.xml", "robots.txt", "llms.txt"].map((f) => join(root, f));

/** Tous les fichiers .html sous `dir`, récursivement. */
function htmlFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...htmlFiles(path));
    else if (entry.name.endsWith(".html")) found.push(path);
  }
  return found;
}

/** Supprime les dossiers devenus vides, en remontant. */
function pruneEmptyDirs(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) pruneEmptyDirs(join(dir, entry.name));
  }
  if (dir !== root && readdirSync(dir).length === 0) rmdirSync(dir);
}

// L'app démarre sur la coquille nue : aucun texte SEO au lancement.
const shell = join(root, "app.html");
const index = join(root, "index.html");
if (existsSync(shell)) {
  copyFileSync(shell, index);
  console.log("prune-native-bundle: index.html remplacé par la coquille nue (app.html)");
}

let removed = 0;
for (const path of htmlFiles(root)) {
  if (path === index) continue;
  rmSync(path);
  removed++;
}
console.log(`prune-native-bundle: ${removed} page(s) HTML prérendue(s) retirée(s) (web uniquement)`);

for (const file of PRUNED_FILES) {
  if (!existsSync(file)) continue;
  rmSync(file);
  console.log(`prune-native-bundle: ${file} retiré (web uniquement)`);
}

for (const dir of PRUNED_DIRS) {
  if (!existsSync(dir)) continue;
  rmSync(dir, { recursive: true });
  console.log(`prune-native-bundle: ${dir} retiré (téléchargeable à la demande dans l'app)`);
}

pruneEmptyDirs(root);
