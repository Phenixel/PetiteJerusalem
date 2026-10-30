#!/usr/bin/env node
/**
 * Composes the music bed with the promo videos' own engine
 * (../scripts/music-engine.js: Tone.js rendered offline in Chromium, no
 * sample and no licensed piece), in its « mizrahi » genre: darbuka in
 * sixteenths, tambourine, claps on the off-beats, the motif of the 4.0
 * video. On the film's grid, 120 beats per minute: the hook over the first
 * two bars, the long section under the narration, a two-beat break as the
 * camera leaves the last island, then the end card. The picture's sounds
 * are placed apart (scripts/sons.mjs).
 *
 * Output: assets/musique.wav, normalized to -14 LUFS like the other promo
 * videos (the composition plays it lower, under the voice).
 *
 * Needs `npm ci` in promo/ (Tone.js and Playwright), or TONE_JS pointing to
 * a Tone.js build; PROMO_CHROMIUM as in promo/README.md.
 * Usage: node scripts/musique.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const promo = join(root, "..");
const require = createRequire(join(promo, "package.json"));
const { chromium } = require("playwright");

const toneJs = process.env.TONE_JS || join(promo, "node_modules/tone/build/Tone.js");
if (!existsSync(toneJs)) throw new Error(`Tone.js not found at ${toneJs}: run npm ci in promo/, or set TONE_JS`);

const { total } = JSON.parse(readFileSync(join(root, "voix.json"), "utf8"));
const BPM = 120;
const beat = (seconds) => (seconds * BPM) / 60;
const totalBeats = beat(total);

// Sections in beats, whole bars each: hook 0-4 s, feature 4-58 s, break
// 58-59 s, the end card from 59 s. The film has no closing montage: its
// empty section sits past the end of the track, where its impact and snare
// roll are never heard (on the end card's beat, they would collide with its
// own impact).
const sections = [
  { kind: "hook", from: 0, beats: 8 },
  { kind: "feature", from: 8, beats: 108 },
  { kind: "break", from: 116, beats: 2 },
  { kind: "montage", from: 1000, beats: 0 },
  { kind: "end", from: 118, beats: totalBeats - 118 },
];
const cues = [];

const style = {
  bpm: BPM,
  root: 60,
  motif: "nigoun",
  genre: "mizrahi",
  progression: [
    [0, 4, 7],
    [1, 5, 8],
    [0, 4, 7],
    [-2, 1, 5],
  ],
};

const browser = await chromium.launch({
  executablePath: process.env.PROMO_CHROMIUM || undefined,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
try {
  const page = await browser.newPage();
  await page.goto("about:blank");
  await page.addScriptTag({ path: toneJs });
  await page.addScriptTag({ path: join(promo, "scripts/music-engine.js") });
  const spec = { timeline: { bpm: BPM, sections, totalBeats, tail: 1 }, style, cues };
  const base64 = await page.evaluate((s) => window.renderTrack(s), spec);
  const raw = join(root, "assets/musique.raw.wav");
  writeFileSync(raw, Buffer.from(base64, "base64"));
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", raw,
    "-af", "loudnorm=I=-14:TP=-1:LRA=11", "-ar", "48000",
    join(root, "assets/musique.wav"),
  ]);
  rmSync(raw);
  console.log(`musique: ${total} s, ${cues.length} sounds`);
} finally {
  await browser.close();
}
