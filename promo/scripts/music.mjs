#!/usr/bin/env node
/**
 * Compose la musique de chaque vidéo, à la durée exacte et sur sa grille
 * (src/videos.ts) : public/music/<id>.wav. Le calcul se fait dans Chromium,
 * en Web Audio hors ligne (scripts/music-engine.js), plus vite que le temps
 * réel et sans carte son.
 *
 * Usage : npm run music [-- --only horaires]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { VIDEOS, videoCues, videoTimeline } from "../src/videos.ts";

const root = join(import.meta.dirname, "..");
const outDir = join(root, "public/music");
mkdirSync(outDir, { recursive: true });

const only = process.argv.flatMap((a, i, argv) => (a === "--only" ? [argv[i + 1]] : []));
const videos = only.length ? VIDEOS.filter((v) => only.includes(v.id)) : VIDEOS;

const browser = await chromium.launch({
  executablePath: process.env.PROMO_CHROMIUM || undefined,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
try {
  const page = await browser.newPage();
  await page.goto("about:blank");
  await page.addScriptTag({ path: join(root, "node_modules/tone/build/Tone.js") });
  await page.addScriptTag({ path: join(root, "scripts/music-engine.js") });
  for (const video of videos) {
    const started = Date.now();
    const spec = { timeline: videoTimeline(video), style: video.music, cues: videoCues(video) };
    const base64 = await page.evaluate((s) => window.renderTrack(s), spec);
    const raw = join(outDir, `${video.id}.raw.wav`);
    writeFileSync(raw, Buffer.from(base64, "base64"));
    // Volume des réseaux sociaux : -14 LUFS intégrés, crêtes à -1 dB.
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", "-i", raw,
      "-af", "loudnorm=I=-14:TP=-1:LRA=11", "-ar", "48000",
      join(outDir, `${video.id}.wav`),
    ]);
    rmSync(raw);
    console.log(`music: ${video.id} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  }
} finally {
  await browser.close();
}
