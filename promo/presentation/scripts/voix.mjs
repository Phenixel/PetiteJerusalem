#!/usr/bin/env node
/**
 * Synthesizes the narration (scripts/lignes.mjs) with Kokoro, the local
 * voice of the HyperFrames CLI (`hyperframes tts`, French voice ff_siwis),
 * slowed a little (0.92: at 1 it reads about 200 words a minute), then lays
 * the sentences on the music's grid (120 beats per minute): each starts on
 * a beat (0.5 s), after a breath, a longer one between two chapters.
 *
 * Output: assets/voix/<id>.wav (one file per sentence, placed by the
 * composition) and voix.json (where each sentence starts and ends, which the
 * captions and the cut are built from).
 *
 * Usage: node scripts/voix.mjs [--vitesse 0.92] [--force]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LIGNES } from "./lignes.mjs";

const root = join(import.meta.dirname, "..");
const outDir = join(root, "assets/voix");
mkdirSync(outDir, { recursive: true });

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const vitesse = Number(arg("--vitesse", "0.92"));
const force = process.argv.includes("--force");

const BEAT = 0.5;
const BAR = 4 * BEAT;
/** Silence before the first word, so the hook's picture lands first. */
const DEBUT = 0.5;
/** Breath between two sentences of a chapter, and between two chapters. */
const SOUFFLE = 0.35;
const PAUSE_CHAPITRE = 1;
/** The end card holds after the last word. */
const QUEUE = 3.2;

const duree = (file) =>
  Number(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
      encoding: "utf8",
    }).trim(),
  );

const lignes = [];
let fin = 0;
let chapitre = null;
for (const ligne of LIGNES) {
  const brut = join(outDir, `${ligne.id}.brut.wav`);
  const file = join(outDir, `${ligne.id}.wav`);
  if (force || !existsSync(file)) {
    execFileSync(
      "npx",
      ["--yes", "hyperframes@0.8.221", "tts", ligne.dit, "-v", "ff_siwis", "-s", String(vitesse), "-o", brut, "--json"],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    // Trims the silence Kokoro leaves around the sentence, then resamples to
    // 48 kHz stereo like the music.
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", "-i", brut,
      "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse",
      "-ar", "48000", "-ac", "2", file,
    ]);
    execFileSync("rm", ["-f", brut]);
  }
  const longueur = duree(file);
  let debut;
  if (lignes.length === 0) debut = DEBUT;
  else if (ligne.chapitre !== chapitre) debut = Math.ceil((fin + PAUSE_CHAPITRE) / BEAT) * BEAT;
  else debut = Math.ceil((fin + SOUFFLE) / BEAT) * BEAT;
  chapitre = ligne.chapitre;
  fin = debut + longueur;
  lignes.push({ ...ligne, debut: +debut.toFixed(3), fin: +fin.toFixed(3), duree: +longueur.toFixed(3) });
  console.log(`${ligne.id} ${ligne.chapitre.padEnd(10)} ${debut.toFixed(2)} → ${fin.toFixed(2)} (${longueur.toFixed(2)} s)`);
}

const total = Math.ceil((fin + QUEUE) / BAR) * BAR;
writeFileSync(join(root, "voix.json"), JSON.stringify({ vitesse, total, lignes }, null, 2) + "\n");
console.log(`total: ${total} s`);
