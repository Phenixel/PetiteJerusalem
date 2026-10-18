#!/usr/bin/env node
/**
 * Renders the videos: out/<id>.mp4, 1080×1920, 30 frames/s, H.264 and AAC,
 * the format TikTok, Reels, Shorts and WhatsApp statuses accept (series 2
 * goes to out/s2-<id>.mp4). Composes the missing music first
 * (scripts/music.mjs).
 *
 * The "what's new" videos of 4.0 (`appFile` in src/videos.ts) also get the
 * copy the app plays, lighter (720×1280, about 6 MB for eighty seconds) and with
 * its index at the front so it starts before it has fully arrived, plus a
 * poster image: public/videos/ of the app, served by the site (see
 * docs/design.md, "What's new plays once, after the update").
 *
 * Usage: npm run render [-- --only v4] [-- --series 4]
 * PROMO_CHROMIUM: a Chromium to use instead of the one Remotion downloads
 * (in a cloud session: Playwright's headless shell).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { VIDEOS } from "../src/videos.ts";

const root = join(import.meta.dirname, "..");
const outDir = join(root, "out");
const appVideos = join(root, "../public/videos");
mkdirSync(outDir, { recursive: true });

const only = process.argv.flatMap((a, i, argv) => (a === "--only" ? [argv[i + 1]] : []));
const series = process.argv.flatMap((a, i, argv) => (a === "--series" ? [Number(argv[i + 1])] : []));
const videos = VIDEOS.filter(
  (v) => (!only.length || only.includes(v.id)) && (!series.length || series.includes(v.series ?? 1)),
);

const missing = videos.filter((v) => !existsSync(join(root, "public/music", `${v.id}.wav`)));
if (missing.length) {
  execFileSync("node", [join(root, "scripts/music.mjs"), ...missing.flatMap((v) => ["--only", v.id])], { stdio: "inherit" });
}
if (!existsSync(join(root, "public/captures/marks.json"))) {
  console.error("render: no captures, run npm run captures first");
  process.exit(1);
}

for (const video of videos) {
  const file = join(outDir, `${video.series === 2 ? "s2-" : ""}${video.id}.mp4`);
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
  if (video.appFile) {
    mkdirSync(appVideos, { recursive: true });
    const app = join(appVideos, `${video.appFile}.mp4`);
    console.log(`render: ${video.id} → ${app} (the app's copy)`);
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", "-i", file,
      "-vf", "scale=720:1280:flags=lanczos",
      "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-profile:v", "high", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "96k",
      "-movflags", "+faststart",
      app,
    ]);
    // The poster: the « 4.0 » of the opening, shown while the video loads.
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", "-ss", "1.4", "-i", file,
      "-frames:v", "1", "-vf", "scale=540:960:flags=lanczos", "-q:v", "5",
      join(appVideos, `${video.appFile}.jpg`),
    ]);
  }
}
