/**
 * Écrit `public/texts/manifest.json` : l'empreinte du contenu de chacun des
 * fichiers de textes que sert le site.
 *
 * Ce qu'elle répare. L'app garde sur l'appareil les textes qu'on lui a demandé
 * de télécharger, et les relit de là sans plus jamais interroger le site. Une
 * correction apportée à un texte, une bénédiction ajoutée au sidour, une
 * coquille, n'atteignait donc plus personne : le fichier était là, l'app s'en
 * contentait. Une empreinte par fichier permet à l'app de comparer ce qu'elle
 * garde à ce que le site sert, et de ne reprendre que ce qui a changé, sans
 * retélécharger les mégaoctets qui n'ont pas bougé.
 *
 * Lancer avec : node scripts/texts-manifest.mjs [--check]
 *
 * `--check` ne réécrit rien : il échoue si le manifeste ne correspond plus aux
 * fichiers, ce que vérifie src/__tests__/textsManifest.test.ts. Le build
 * l'appelle avant `vite build`, pour que dist/ parte avec un manifeste
 * d'accord avec ses textes.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TEXTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "texts");
const MANIFEST_NAME = "manifest.json";
const MANIFEST_PATH = join(TEXTS_DIR, MANIFEST_NAME);
/** Chemin web du manifeste lui-même : il ne se décrit pas. */
const MANIFEST_WEB_PATH = `/texts/${MANIFEST_NAME}`;

/** Les .json de public/texts, en chemin web (« /texts/… »), dans l'ordre. */
function textFiles(dir = TEXTS_DIR, prefix = "/texts") {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : 1,
  );
  const found = [];
  for (const entry of entries) {
    const webPath = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) found.push(...textFiles(join(dir, entry.name), webPath));
    else if (entry.name.endsWith(".json") && webPath !== MANIFEST_WEB_PATH) found.push(webPath);
  }
  return found;
}

/**
 * Douze caractères de l'empreinte du contenu. Il ne s'agit pas de se prémunir
 * de quoi que ce soit, seulement de savoir si deux fichiers sont le même :
 * l'empreinte entière ne dirait pas mieux, et pèserait le double dans un
 * fichier que chaque appareil télécharge.
 */
function empreinte(webPath) {
  const bytes = readFileSync(join(TEXTS_DIR, webPath.slice("/texts/".length)));
  return createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

function buildManifest() {
  const files = {};
  for (const webPath of textFiles()) files[webPath] = empreinte(webPath);
  return { files };
}

const manifest = buildManifest();
const serialise = `${JSON.stringify(manifest, null, 2)}\n`;
const nombre = Object.keys(manifest.files).length;

if (process.argv.includes("--check")) {
  let actuel = null;
  try {
    actuel = readFileSync(MANIFEST_PATH, "utf-8");
  } catch {
    // Manifeste absent : le message ci-dessous dit quoi faire.
  }
  if (actuel !== serialise) {
    console.error(
      "texts-manifest: public/texts/manifest.json ne correspond plus aux textes servis.\n" +
        "Lancez « node scripts/texts-manifest.mjs » et validez le fichier obtenu :\n" +
        "sans lui, les appareils qui ont téléchargé ces textes garderaient l'ancienne version.",
    );
    process.exit(1);
  }
  console.log(`texts-manifest: à jour (${nombre} fichiers)`);
} else {
  writeFileSync(MANIFEST_PATH, serialise);
  console.log(`texts-manifest: ${nombre} fichiers`);
}
