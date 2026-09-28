#!/usr/bin/env node
/**
 * Vérifie qu'une note de version est prête à coller dans la release GitHub
 * d'un tag : une section par langue (## Français, ## English, ## עברית),
 * 500 caractères au plus chacune (limite du Play Store), ni tiret long ni
 * émoji. Affiche la longueur de chaque langue, et sort en 1 si quelque chose
 * cloche. Voir checkReleaseNotes dans scripts/release-notes.mjs, et
 * docs/notes-de-version.md, la marche à suivre qui s'en sert.
 *
 * Usage : node scripts/check-release-notes.mjs note.md
 */
import { readFileSync } from "node:fs";
import {
  PLAY_NOTES_LIMIT,
  RELEASE_NOTES_LANGS,
  checkReleaseNotes,
  splitReleaseNotes,
} from "./release-notes.mjs";

const file = process.argv[2];
if (!file) {
  console.error(
    "check-release-notes: donner le fichier de la note (node scripts/check-release-notes.mjs note.md)",
  );
  process.exit(1);
}
const body = readFileSync(file, "utf8");
const notes = splitReleaseNotes(body);
for (const lang of RELEASE_NOTES_LANGS) {
  const length = notes[lang] ? [...notes[lang]].length : 0;
  console.log(`check-release-notes: ${lang} ${length}/${PLAY_NOTES_LIMIT} caractères`);
}
const problems = checkReleaseNotes(body);
for (const { lang, problem } of problems) console.error(`check-release-notes: ${lang}, ${problem}`);
if (problems.length > 0) process.exit(1);
console.log("check-release-notes: note prête");
