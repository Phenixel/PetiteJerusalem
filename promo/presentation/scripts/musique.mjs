#!/usr/bin/env node
/**
 * Composes the music bed with the promo videos' own engine
 * (../scripts/music-engine.js: Tone.js rendered offline in Chromium, no
 * sample and no licensed piece), at the 4.0 video's style, on this film's
 * grid: 120 beats per minute, the hook over the first two bars, the long
 * feature section under the narration, a two-beat break as the last light
 * is lit, then the end card. The sounds of the picture (whooshes on the
 * camera's flights, taps, pops, chimes) are cues on the same grid.
 *
 * Output: assets/musique.wav, normalized to -14 LUFS like the other promo
 * videos (the composition plays it far lower, under the voice).
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

// Sections in beats, whole bars each: hook 0-4 s, feature 4-76 s,
// break 76-77 s, the end card from 77 s. The film has no closing montage:
// its empty section sits past the end of the track, where its impact and
// snare roll are never heard (on the end card's beat, they would collide
// with its own impact).
const sections = [
  { kind: "hook", from: 0, beats: 8 },
  { kind: "feature", from: 8, beats: 144 },
  { kind: "break", from: 152, beats: 2 },
  { kind: "montage", from: 1000, beats: 0 },
  { kind: "end", from: 154, beats: totalBeats - 154 },
];

// The picture's sounds, in seconds (SPEC.md, SHOTS).
const sons = [
  [3.9, "pop"], // the star lands on the tower
  [11.6, "whoosh"], // flight to the sharing district
  [12.0, "pop"],
  [13.3, "swipe"], // the session card
  [21.0, "pop"], // the parts land on the readers
  [22.5, "chime"], // checked
  [25.0, "impact"], // the siyoum
  [26.6, "whoosh"], // flight to the library
  [30.0, "tap"],
  [31.2, "tap"],
  [31.8, "tap"],
  [32.8, "swipe"], // the library screen
  [36.0, "swipe"], // the class
  [39.4, "whoosh"], // back over the city
  [42.0, "swipe"], // the Sidour
  [47.5, "whoosh"], // night falls
  [47.9, "chime"], // the candles
  [50.0, "whoosh"], // flight to the goals
  [51.7, "pop"],
  [53.5, "pop"],
  [55.2, "pop"],
  [57.0, "swipe"], // the home screen
  [59.4, "chime"], // the reminder
  [60.6, "swipe"], // the card swiped
  [61.5, "pop"],
  [63.0, "whoosh"], // flight to the wall
  [63.8, "tap"], // the first stones
  [64.25, "tap"],
  [64.7, "tap"],
  [69.5, "whoosh"], // the year
  [71.5, "pop"], // the lamp lights
  [74.5, "chime"], // the stars
  [75.0, "swipe"], // Mon parcours
];
const cues = sons.map(([t, sound]) => ({ beat: beat(t), sound }));

const style = {
  bpm: BPM,
  root: 60,
  motif: "nigoun",
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
