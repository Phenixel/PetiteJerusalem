#!/usr/bin/env node
/**
 * Brings the rendered video's sound to the networks' level, like the other
 * promo videos: -14 LUFS integrated, true peak under -1 dBTP (measured
 * first, then a linear gain, then a limiter for the last peaks). The picture
 * is copied as it is.
 *
 * Usage: node scripts/normaliser.mjs [renders/petite-jerusalem-iso.mp4]
 */
import { execFileSync } from "node:child_process";
import { renameSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const video = join(root, process.argv[2] ?? "renders/petite-jerusalem-iso.mp4");
const tmp = video.replace(/\.mp4$/, ".tmp.mp4");

const ffmpeg = (args) => execFileSync("ffmpeg", ["-hide_banner", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
// ffmpeg prints the measure on stderr.
const sortie = execFileSync(
  "bash",
  ["-c", `ffmpeg -hide_banner -i "${video}" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1`],
  { encoding: "utf8" },
);
const m = JSON.parse(sortie.slice(sortie.lastIndexOf("{"), sortie.lastIndexOf("}") + 1));
const filtre = [
  `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
  "alimiter=limit=0.87:level=false",
  "volume=-0.2dB",
].join(",");
ffmpeg(["-loglevel", "error", "-y", "-i", video, "-c:v", "copy", "-af", filtre, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", tmp]);
renameSync(tmp, video);
console.log(`normalized: ${video} (was ${m.input_i} LUFS, ${m.input_tp} dBTP)`);
