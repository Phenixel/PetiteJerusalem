// Retire du bundle natif (Capacitor) ce qui n'a de sens que sur le web.
//
// 1. Les corpus téléchargeables à la demande : l'app mobile ne doit pas
//    embarquer les ~38 Mo de public/texts. Elle garde seulement ce qu'on doit
//    pouvoir lire sans réseau dès l'installation, listé dans
//    src/datas/bundledTexts.json : les Tehilim (~370 Ko), Cha'harit, Min'ha et
//    Arvit (~950 Ko), le découpage du Talmud (~40 Ko). Le reste se télécharge
//    depuis le site via offlineTextStore.
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
// 3. Les fichiers de preuve des liens d'application (`.well-known/`) : ils
//    s'adressent au système depuis le site, pour qu'un lien ouvre l'app
//    installée ; embarqués dans le bundle, ils ne servent à rien.
//
// À lancer entre `vite build` et `cap sync` (voir app:build), jamais pour le
// déploiement web, qui sert tout cela depuis dist/.
import { copyFileSync, existsSync, readdirSync, readFileSync, rmdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? "dist";

/** Ce que l'app embarque, liste partagée avec offlineLibraryService. */
const bundledTexts = JSON.parse(
  readFileSync(new URL("../src/datas/bundledTexts.json", import.meta.url), "utf-8"),
);
/** "/texts/tefila/chaharit.json" → chemin sous `root`. */
const KEPT_FILES = new Set(
  [...bundledTexts.authoritative, ...bundledTexts.fallback].map((path) =>
    join(root, path.replace(/^\//, "")),
  ),
);

const PRUNED_DIRS = [
  "texts/talmud",
  "texts/mishna",
  "texts/tanakh",
  "texts/rashi",
  "texts/tefila",
].map((d) => join(root, d));
// Ce que seul le site sert : plan du site, fichiers pour les robots, image
// de partage, preuve de propriété pour un moteur, manifeste des textes (l'app
// va le chercher en ligne, jamais dans son bundle), version publiée.
const PRUNED_FILES = [
  "sitemap.xml",
  "sitemap-pages.xml",
  "sitemap-bibliotheque.xml",
  "sitemap-horaires.xml",
  "sitemap-calendrier.xml",
  "robots.txt",
  "llms.txt",
  "llms-full.txt",
  "og-image.jpg",
  "7928be0e14242cf92e167550affa3215.txt",
  "texts/manifest.json",
  "app-version.json",
].map((f) => join(root, f));
/** Ce que seul le site sert : les preuves des liens d'application. */
const WEB_ONLY_DIRS = [".well-known"].map((d) => join(root, d));

/** Tous les fichiers sous `dir`, récursivement. */
function allFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...allFiles(path));
    else found.push(path);
  }
  return found;
}

/** Tous les fichiers .html sous `dir`, récursivement. */
function htmlFiles(dir) {
  return allFiles(dir).filter((path) => path.endsWith(".html"));
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
console.log(
  `prune-native-bundle: ${removed} page(s) HTML prérendue(s) retirée(s) (web uniquement)`,
);

for (const file of PRUNED_FILES) {
  if (!existsSync(file)) continue;
  rmSync(file);
  console.log(`prune-native-bundle: ${file} retiré (web uniquement)`);
}

// Un corpus s'en va entier, sauf les fichiers que l'app embarque (les trois
// tefilot du jour, dans texts/tefila) ; ses dossiers vides partent ensuite.
for (const dir of PRUNED_DIRS) {
  if (!existsSync(dir)) continue;
  const kept = allFiles(dir).filter((path) => KEPT_FILES.has(path));
  if (kept.length === 0) {
    rmSync(dir, { recursive: true });
    console.log(`prune-native-bundle: ${dir} retiré (téléchargeable à la demande dans l'app)`);
    continue;
  }
  for (const path of allFiles(dir)) {
    if (!KEPT_FILES.has(path)) rmSync(path);
  }
  console.log(
    `prune-native-bundle: ${dir} retiré (téléchargeable à la demande dans l'app), sauf ${kept.length} fichier(s) embarqué(s)`,
  );
}

for (const dir of WEB_ONLY_DIRS) {
  if (!existsSync(dir)) continue;
  rmSync(dir, { recursive: true });
  console.log(`prune-native-bundle: ${dir} retiré (web uniquement)`);
}

pruneEmptyDirs(root);
