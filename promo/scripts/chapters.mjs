#!/usr/bin/env node
/**
 * Writes where each passage of the "what's new" videos starts and ends, in
 * seconds, for the app: src/content/help/whatsNewChapters.json. The help
 * center's page of a version (/aide/nouveautes/4.0) lists the passages and
 * plays the video from the one asked for.
 *
 * Derived from the cut the videos are rendered from (`chapters` in
 * src/videos.ts, src/v4/plan.ts); scripts/render.mjs runs it after the
 * app's copies, so that the times always match the published videos.
 *
 * Usage: node scripts/chapters.mjs
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { VIDEOS } from "../src/videos.ts";

const target = join(import.meta.dirname, "../../src/content/help/whatsNewChapters.json");

/** { "4.0": { "fr": [{ "id": "bars", "start": 4, "end": 10 }, ...], "en": ..., "he": ... } } */
const chapters = {};
for (const video of VIDEOS) {
  const name = video.appFile?.match(/^nouveautes-(.+)-(fr|en|he)$/);
  if (!name || !video.chapters) continue;
  const [, version, locale] = name;
  const seconds = (beat) => (beat * 60) / video.music.bpm;
  chapters[version] ??= {};
  chapters[version][locale] = video.chapters.map((chapter) => ({
    id: chapter.id,
    start: seconds(chapter.from),
    end: seconds(chapter.from + chapter.beats),
  }));
}

// One passage per line, as Prettier writes it in the app.
const json = JSON.stringify(chapters, null, 2).replace(/\{\s+("id"[^}]*?)\s+\}/g, (_, body) => `{ ${body.replace(/,\s+/g, ", ")} }`);
writeFileSync(target, `${json}\n`);
console.log(`chapters: ${target}`);
