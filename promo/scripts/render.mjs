#!/usr/bin/env node
/**
 * Rend les vidéos : out/<id>.mp4, 1080×1920, 30 images/s, H.264 et AAC,
 * le format qu'acceptent TikTok, Reels, Shorts et les statuts WhatsApp.
 * Compose d'abord les musiques qui manquent (scripts/music.mjs).
 *
 * Usage : npm run render [-- --only horaires]
 * PROMO_CHROMIUM : un Chromium à employer plutôt que celui que Remotion
 * télécharge (en session cloud : celui de Playwright).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { VIDEOS } from "../src/videos.ts";

const root = join(import.meta.dirname, "..");
const outDir = join(root, "out");
mkdirSync(outDir, { recursive: true });

const only = process.argv.flatMap((a, i, argv) => (a === "--only" ? [argv[i + 1]] : []));
const videos = only.length ? VIDEOS.filter((v) => only.includes(v.id)) : VIDEOS;

const missing = videos.filter((v) => !existsSync(join(root, "public/music", `${v.id}.wav`)));
if (missing.length) {
  execFileSync("node", [join(root, "scripts/music.mjs"), ...missing.flatMap((v) => ["--only", v.id])], { stdio: "inherit" });
}
if (!existsSync(join(root, "public/captures/marks.json"))) {
  console.error("render: pas de captures, lancer d'abord npm run captures");
  process.exit(1);
}

for (const video of videos) {
  const file = join(outDir, `${video.id}.mp4`);
  console.log(`render: ${video.id} → ${file}`);
  execFileSync(
    "npx",
    [
      "remotion",
      "render",
      "src/index.ts",
      video.id,
      file,
      "--codec=h264",
      "--crf=17",
      "--pixel-format=yuv420p",
      "--audio-codec=aac",
      "--audio-bitrate=320k",
      "--log=error",
      ...(process.env.PROMO_CHROMIUM ? [`--browser-executable=${process.env.PROMO_CHROMIUM}`] : []),
    ],
    { cwd: root, stdio: "inherit" },
  );
}
