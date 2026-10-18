/**
 * The cut of the version 4.0 videos, as data: its chapters, their length in
 * beats and their marked beats (a tap, a page that opens), each with the
 * sound the music plays there. Read by Remotion (src/v4/chapters.tsx places
 * the gestures on these beats) and by Node (src/videos.ts, then
 * scripts/music.mjs), hence no JSX here.
 *
 * Two videos:
 *  - `promo`, for the networks, French: 37 seconds, eight chapters of six
 *    beats (three seconds), the pace of the earlier series;
 *  - `app`, the "what's new" video that plays in the app after the update,
 *    in the reader's language: a minute, chapters of eight to twelve beats,
 *    time enough to read where things moved.
 *
 * Sections hold whole bars: the music lays its chords and its piano four
 * beats at a time, and a bar running over into the next section would
 * collide with it. Hence a four-beat opening and chapters adding up to a
 * multiple of four.
 */
import type { CueSound, Durations } from "../timeline.ts";
import type { Locale } from "./strings.ts";

export type ChapterId =
  | "bars"
  | "etude"
  | "sidour"
  | "deck"
  | "parcours"
  | "daf"
  | "translation"
  | "commentaries"
  | "texte"
  | "table"
  | "audio"
  | "contact";

export type Mark = { beat: number; sound?: CueSound };

export type ChapterPlan = { id: ChapterId; beats: number; marks: Record<string, Mark> };

export type MontageShot = "halakha" | "moussar" | "tikoun" | "chnei" | "signet" | "tehilim" | "sidour" | "contact";

export type CutPlan = {
  chapters: ChapterPlan[];
  montage: MontageShot[];
  hook: number;
  end: number;
};

const ch = (id: ChapterId, beats: number, marks: Record<string, Mark>): ChapterPlan => ({
  id,
  beats,
  marks: { in: { beat: 0, sound: "whoosh" }, ...marks },
});

/** For the networks: one chapter every three seconds. */
export const PROMO_PLAN: CutPlan = {
  hook: 4,
  chapters: [
    ch("bars", 6, { after: { beat: 1.1, sound: "whoosh" }, arrow0: { beat: 2, sound: "swipe" }, arrow1: { beat: 2.4, sound: "swipe" }, fresh: { beat: 3, sound: "pop" } }),
    ch("deck", 6, { swipe: { beat: 1.2, sound: "swipe" }, done: { beat: 2.2, sound: "chime" } }),
    ch("parcours", 6, { scroll: { beat: 3, sound: "whoosh" } }),
    ch("daf", 6, { tap: { beat: 1.2, sound: "tap" }, page: { beat: 1.4, sound: "impact" }, zoom: { beat: 2.6 } }),
    ch("translation", 6, { tap: { beat: 1, sound: "tap" }, on: { beat: 1.3, sound: "pop" }, zoom: { beat: 2.2 } }),
    ch("commentaries", 6, { passage: { beat: 0.9, sound: "tap" }, sheet: { beat: 1.1, sound: "swipe" }, open: { beat: 2.6, sound: "tap" }, panel: { beat: 2.8, sound: "swipe" } }),
    ch("audio", 6, { play: { beat: 0.8, sound: "tap" }, bar: { beat: 2.4, sound: "tap" }, full: { beat: 2.5, sound: "swipe" } }),
    ch("table", 6, { aside: { beat: 0.8, sound: "tap" }, fly: { beat: 0.9, sound: "whoosh" }, second: { beat: 3, sound: "whoosh" }, bar: { beat: 3.9, sound: "tap" }, sheet: { beat: 4.1, sound: "swipe" } }),
  ],
  montage: ["halakha", "tikoun", "chnei", "contact", "tehilim", "sidour"],
  end: 8,
};

/** In the app: where things moved first, then what is new, slower. */
export function appPlan(locale: Locale): CutPlan {
  // Hebrew readers get no translation chapter (the translations go into
  // French and English): the commentaries take the whole chapter.
  const texte =
    locale === "he"
      ? ch("texte", 12, { passage: { beat: 1.5, sound: "tap" }, sheet: { beat: 1.7, sound: "swipe" }, open: { beat: 4.5, sound: "tap" }, panel: { beat: 4.7, sound: "swipe" } })
      : ch("texte", 12, {
          tap: { beat: 1, sound: "tap" },
          on: { beat: 1.3, sound: "pop" },
          zoom: { beat: 2 },
          passage: { beat: 6, sound: "tap" },
          sheet: { beat: 6.2, sound: "swipe" },
          open: { beat: 8.3, sound: "tap" },
          panel: { beat: 8.5, sound: "swipe" },
        });
  return {
    hook: 4,
    chapters: [
      ch("bars", 8, { after: { beat: 1.5, sound: "whoosh" }, arrow0: { beat: 2.6, sound: "swipe" }, arrow1: { beat: 3.2, sound: "swipe" }, fresh: { beat: 4, sound: "pop" } }),
      ch("etude", 8, { tap1: { beat: 1.5, sound: "tap" }, tap2: { beat: 4.5, sound: "tap" } }),
      ch("sidour", 8, { tap: { beat: 1.6, sound: "tap" }, push: { beat: 2, sound: "swipe" }, focus: { beat: 3.2, sound: "pop" } }),
      ch("deck", 12, { swipe: { beat: 1.5, sound: "swipe" }, done: { beat: 2.6, sound: "chime" }, edit: { beat: 6, sound: "whoosh" } }),
      ch("parcours", 12, { tap: { beat: 1, sound: "tap" }, push: { beat: 1.4, sound: "swipe" }, scroll: { beat: 4, sound: "whoosh" }, goal: { beat: 7.5, sound: "swipe" } }),
      ch("daf", 8, { tap: { beat: 1.5, sound: "tap" }, page: { beat: 1.7, sound: "impact" }, zoom: { beat: 3 } }),
      texte,
      ch("table", 8, { aside: { beat: 1, sound: "tap" }, fly: { beat: 1.1, sound: "whoosh" }, second: { beat: 4, sound: "whoosh" }, bar: { beat: 5, sound: "tap" }, sheet: { beat: 5.2, sound: "swipe" } }),
      ch("audio", 8, { play: { beat: 1, sound: "tap" }, bar: { beat: 3, sound: "tap" }, full: { beat: 3.1, sound: "swipe" } }),
      ch("contact", 8, { badge: { beat: 0.6, sound: "pop" }, row: { beat: 2.5, sound: "tap" }, push: { beat: 2.9, sound: "swipe" } }),
    ],
    montage: ["halakha", "moussar", "tikoun", "chnei", "signet", "tehilim"],
    end: 8,
  };
}

/** The five sections of a cut, for the shared grid (timeline.ts). */
export function planDurations(plan: CutPlan): Durations {
  return {
    hook: plan.hook,
    feature: plan.chapters.reduce((sum, c) => sum + c.beats, 0),
    break: 2,
    montage: plan.montage.length * 2,
    end: plan.end,
  };
}

/** The chapters' marks, counted from the start of the feature section: the music's cues. */
export function planMarks(plan: CutPlan): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  let from = 0;
  for (const chapter of plan.chapters) {
    for (const [name, mark] of Object.entries(chapter.marks)) {
      out[`${chapter.id}.${name}`] = { ...mark, beat: from + mark.beat };
    }
    from += chapter.beats;
  }
  return out;
}

/** Where the music drops: at each chapter's start, every other one. */
export function planDrops(plan: CutPlan): number[] {
  const drops: number[] = [];
  let from = 0;
  plan.chapters.forEach((chapter, i) => {
    if (i > 0 && i % 2 === 0) drops.push(from);
    from += chapter.beats;
  });
  return drops;
}
