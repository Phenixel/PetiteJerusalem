#!/usr/bin/env node
/**
 * Prépare le dossier whatsnew/ (notes « Nouveautés » du Play Store) lu par
 * upload-google-play dans la CI.
 *
 * Source des notes, par ordre de priorité :
 * 1. Le texte de la release GitHub du tag (fichier passé en argument, récupéré
 *    par la CI via `gh api`) : c'est ce que l'utilisateur a écrit à la main en
 *    créant la release. Français → whatsnew-fr-FR uniquement, les autres
 *    langues retombent sur la langue par défaut dans la Play Console.
 * 2. Sinon, store-assets/metadata/android/<locale>/changelogs/default.txt
 *    pour chaque langue.
 *
 * Le markdown est allégé (titres, puces, gras, liens) car le Play Store
 * affiche du texte brut, et le tout est tronqué à 500 caractères (limite
 * Play Console) avec un avertissement.
 *
 * Usage : node scripts/prepare-whatsnew.mjs [release-body.md]
 * Écrit has_release_body=true|false dans $GITHUB_OUTPUT si défini.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const LIMIT = 500;
const root = join(import.meta.dirname, "..");
const metadataDir = join(root, "store-assets/metadata/android");
const outDir = join(root, "whatsnew");
mkdirSync(outDir, { recursive: true });

function markdownToPlain(text) {
  return text
    .replace(/\r/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\*\*|__/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncate(text, label) {
  const chars = [...text];
  if (chars.length <= LIMIT) return text;
  // Coupe au dernier saut de ligne ou espace avant la limite (moins l'ellipse).
  let cut = chars.slice(0, LIMIT - 1).join("");
  const lastBreak = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(" "));
  if (lastBreak > LIMIT / 2) cut = cut.slice(0, lastBreak);
  console.warn(
    `prepare-whatsnew: ${label} fait ${chars.length} caractères, tronqué à ${LIMIT} (limite Play Console)`,
  );
  return `${cut.trimEnd()}…`;
}

const bodyFile = process.argv[2];
const releaseBody =
  bodyFile && existsSync(bodyFile) ? markdownToPlain(readFileSync(bodyFile, "utf8")) : "";

if (releaseBody) {
  writeFileSync(
    join(outDir, "whatsnew-fr-FR"),
    truncate(releaseBody, "le texte de la release GitHub"),
  );
  console.log(
    "prepare-whatsnew: notes prises depuis la release GitHub (fr-FR, les autres langues retombent sur la langue par défaut)",
  );
} else {
  const locales = readdirSync(metadataDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const locale of locales) {
    const text = readFileSync(join(metadataDir, locale, "changelogs/default.txt"), "utf8").trim();
    writeFileSync(
      join(outDir, `whatsnew-${locale}`),
      truncate(text, `${locale}/changelogs/default.txt`),
    );
  }
  console.log(
    `prepare-whatsnew: pas de release GitHub pour ce tag, notes prises depuis changelogs/default.txt (${locales.join(", ")})`,
  );
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `has_release_body=${Boolean(releaseBody)}\n`);
}
