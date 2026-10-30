#!/usr/bin/env node
/**
 * Writes the audio tracks into index.html, between its markers: the voice,
 * one clip a line (voix.json), and the sound effects (scripts/sons.mjs),
 * each placed so its peak lands on the picture's moment.
 *
 * Usage: node scripts/pistes.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PICS, SONS } from "./sons.mjs";

const root = join(import.meta.dirname, "..");
const voix = JSON.parse(readFileSync(join(root, "voix.json"), "utf8"));
const s3 = (n) => Number(n.toFixed(3));

const DURES = {};
for (const nom of Object.keys(PICS)) {
  // Duration from the file itself, so a clip never outlasts its sound.
  DURES[nom] = Number(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", join(root, `assets/sfx/${nom}.mp3`)], {
      encoding: "utf8",
    }).trim(),
  );
}

const pisteVoix = voix.lignes
  .map(
    (l) =>
      `      <audio id="voix-${l.id}" src="assets/voix/${l.id}.wav" data-start="${l.debut}" data-duration="${l.duree}" data-track-index="11" data-volume="1.58"></audio>`,
  )
  .join("\n");

// Sounds that overlap go on separate lanes (12, 13...), so each lane plays
// one sound at a time.
const fins = [];
const pisteSons = SONS.map(([t, nom, volume]) => ({ t, nom, volume, debut: Math.max(0, t - PICS[nom]) }))
  .sort((a, b) => a.debut - b.debut)
  .map(({ nom, volume, debut }, i) => {
    const duree = Math.min(DURES[nom], voix.total - debut);
    let voie = fins.findIndex((f) => f <= debut);
    if (voie < 0) voie = fins.push(0) - 1;
    fins[voie] = debut + duree;
    return `      <audio id="son-${String(i + 1).padStart(2, "0")}" src="assets/sfx/${nom}.mp3" data-start="${s3(debut)}" data-duration="${s3(duree)}" data-track-index="${12 + voie}" data-volume="${volume}"></audio>`;
  })
  .join("\n");

const fichier = join(root, "index.html");
let html = readFileSync(fichier, "utf8");
const remplacer = (nom, bloc) => {
  const re = new RegExp(`(<!-- ${nom}:debut[^>]*-->)[\\s\\S]*?(\\s*<!-- ${nom}:fin -->)`);
  if (!re.test(html)) throw new Error(`marker ${nom} missing in index.html`);
  html = html.replace(re, `$1\n${bloc}$2`);
};
remplacer("voix", pisteVoix);
remplacer("sons", pisteSons);
writeFileSync(fichier, html);
console.log(`${voix.lignes.length} voice clips, ${SONS.length} sounds`);
