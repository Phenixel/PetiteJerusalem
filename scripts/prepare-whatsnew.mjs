#!/usr/bin/env node
/**
 * Prépare le dossier whatsnew/ (notes « Nouveautés » du Play Store) lu par
 * upload-google-play dans la CI.
 *
 * Source des notes, par ordre de priorité :
 * 1. Le fichier passé en argument, que la CI remplit avec le texte écrit à la
 *    main pour ce tag : celui de la release GitHub si elle existe déjà, sinon
 *    le message du tag annoté (`git tag -a`, la source la plus commode : les
 *    notes s'écrivent au moment même où la release part). Chaque langue de
 *    la fiche reçoit la section écrite pour elle (`## Français`,
 *    `## English`, `## עברית`, voir splitReleaseNotes dans
 *    scripts/release-notes.mjs) ; un texte sans ces titres est du français.
 *    Une langue sans section n'a pas de fichier : la Play Console lui montre
 *    celles de la langue par défaut.
 * 2. Sinon, la phrase par défaut de scripts/release-notes.mjs
 *    (« Correction de bugs mineurs. », traduite par langue).
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
import { defaultReleaseNotes, releaseNotesFor, splitReleaseNotes } from "./release-notes.mjs";

const LIMIT = 500;
const root = join(import.meta.dirname, "..");
const metadataDir = join(root, "store-assets/metadata/android");
const outDir = join(root, "whatsnew");
mkdirSync(outDir, { recursive: true });

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
const releaseNotes = splitReleaseNotes(
  bodyFile && existsSync(bodyFile) ? readFileSync(bodyFile, "utf8") : "",
);
const hasReleaseBody = Object.keys(releaseNotes).length > 0;
const locales = readdirSync(metadataDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

if (hasReleaseBody) {
  const written = [];
  for (const locale of locales) {
    const notes = releaseNotesFor(releaseNotes, locale);
    if (!notes) continue;
    writeFileSync(
      join(outDir, `whatsnew-${locale}`),
      truncate(notes, `le texte de la release GitHub (${locale})`),
    );
    written.push(locale);
  }
  console.log(
    `prepare-whatsnew: notes prises depuis la release GitHub (${written.join(", ")}), les autres langues retombent sur la langue par défaut`,
  );
} else {
  for (const locale of locales) {
    writeFileSync(join(outDir, `whatsnew-${locale}`), defaultReleaseNotes(locale));
  }
  console.log(
    `prepare-whatsnew: pas de release GitHub pour ce tag, phrase par défaut (${locales.join(", ")})`,
  );
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `has_release_body=${hasReleaseBody}\n`);
}
