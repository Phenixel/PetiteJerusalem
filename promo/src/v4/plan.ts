/**
 * The cut of the version 4.0 video, as data: its chapters, their length in
 * beats and their marked beats (a tap, a caption that changes), each with
 * the sound the music plays there. Read by Remotion (src/v4/chapters.tsx
 * places the gestures on these beats) and by Node (src/videos.ts, then
 * scripts/music.mjs), hence no JSX here.
 *
 * One video, a presentation rather than an ad: the first series' language
 * (a phone held calmly, two-line captions, real gestures, a card coming out
 * of the screen), slowed down. Five to eight seconds per change instead of
 * one: first where things moved, then what is new.
 *
 * Sections hold whole bars: the music lays its chords four beats at a time,
 * and a bar running over into the next section would collide with it.
 * Hence an eight-beat opening and chapters adding up to a multiple of four.
 */
import type { CueSound, Durations } from "../timeline.ts";
import type { Locale } from "./strings.ts";

export type ChapterId =
  | "bars"
  | "etude"
  | "sidour"
  | "accueil"
  | "parcours"
  | "calme"
  | "moment"
  | "fin"
  | "daf"
  | "progress"
  | "translation"
  | "commentaries"
  | "table"
  | "audio"
  | "contact";

export type Mark = { beat: number; sound?: CueSound };

export type ChapterPlan = { id: ChapterId; beats: number; marks: Record<string, Mark> };

export type MontageShot =
  | "halakha"
  | "tikoun"
  | "chnei"
  | "signet"
  | "tehilim"
  | "nichmat40"
  | "sidourAjouts"
  | "boussole"
  | "recherche"
  | "rappels"
  | "epingles"
  | "contraste";

export type CutPlan = {
  hook: number;
  chapters: ChapterPlan[];
  montage: MontageShot[];
  end: number;
};

const ch = (id: ChapterId, beats: number, marks: Record<string, Mark>): ChapterPlan => ({ id, beats, marks });

export function presentationPlan(locale: Locale): CutPlan {
  return {
    hook: 8,
    chapters: [
      ch("bars", 12, {
        old: { beat: 0.3, sound: "whoosh" },
        now: { beat: 2, sound: "whoosh" },
        arrow0: { beat: 3.5, sound: "swipe" },
        arrow1: { beat: 4.2, sound: "swipe" },
        fresh: { beat: 5.2, sound: "pop" },
        second: { beat: 6.5 },
      }),
      ch("etude", 10, {
        rise: { beat: 0, sound: "whoosh" },
        tap1: { beat: 2.5, sound: "tap" },
        second: { beat: 4.8 },
        tap2: { beat: 6, sound: "tap" },
      }),
      ch("sidour", 10, {
        tap: { beat: 1.2, sound: "tap" },
        push: { beat: 1.5, sound: "swipe" },
        second: { beat: 4.5 },
        pop: { beat: 5, sound: "pop" },
        open: { beat: 9, sound: "tap" },
      }),
      // A tefila opens: the phone's quiet modes come down (the Android app).
      ch("calme", 10, {
        push: { beat: 0, sound: "swipe" },
        drop: { beat: 1, sound: "whoosh" },
        pop: { beat: 3, sound: "pop" },
        second: { beat: 5.5 },
        dnd: { beat: 6.5, sound: "tap" },
      }),
      // Its time, a pill with its sky; touched, the cycle of the day.
      ch("moment", 12, {
        pop: { beat: 1, sound: "pop" },
        tap: { beat: 4.5, sound: "tap" },
        sheet: { beat: 4.7, sound: "swipe" },
        second: { beat: 6 },
      }),
      // At its end, the page pushed up: the service is said.
      ch("fin", 10, {
        push: { beat: 0, sound: "swipe" },
        pull: { beat: 2, sound: "swipe" },
        second: { beat: 5 },
        done: { beat: 5.2, sound: "chime" },
      }),
      ch("accueil", 14, {
        split: { beat: 0.2, sound: "whoosh" },
        join: { beat: 4, sound: "whoosh" },
        swipe: { beat: 6, sound: "swipe" },
        done: { beat: 7, sound: "chime" },
        edit: { beat: 11, sound: "pop" },
      }),
      ch("parcours", 14, {
        tap: { beat: 1, sound: "tap" },
        push: { beat: 1.3, sound: "swipe" },
        pop: { beat: 2.6, sound: "pop" },
        wall: { beat: 6.5, sound: "whoosh" },
        goal: { beat: 10, sound: "swipe" },
      }),
      ch("daf", 10, {
        push: { beat: 0, sound: "swipe" },
        tap: { beat: 1.5, sound: "tap" },
        page: { beat: 1.7, sound: "impact" },
        zoom: { beat: 3, sound: "whoosh" },
        second: { beat: 6 },
      }),
      ch("progress", 12, {
        push: { beat: 0, sound: "swipe" },
        slide: { beat: 2.5, sound: "swipe" },
        second: { beat: 6.5 },
        release: { beat: 6.3, sound: "pop" },
      }),
      // The translations go into French and English: the Hebrew video has none.
      ...(locale === "he"
        ? []
        : [ch("translation", 8, { tap: { beat: 1.2, sound: "tap" }, on: { beat: 1.5, sound: "pop" }, pop: { beat: 3, sound: "pop" } })]),
      ch("commentaries", 10, {
        passage: { beat: 1.5, sound: "tap" },
        sheet: { beat: 1.7, sound: "swipe" },
        open: { beat: 4, sound: "tap" },
        panel: { beat: 4.2, sound: "swipe" },
      }),
      ch("table", 10, {
        aside: { beat: 1.2, sound: "tap" },
        fly: { beat: 1.3, sound: "whoosh" },
        second: { beat: 5, sound: "whoosh" },
        bar: { beat: 7, sound: "tap" },
        sheet: { beat: 7.2, sound: "swipe" },
      }),
      ch("audio", 8, {
        push: { beat: 0, sound: "swipe" },
        play: { beat: 1.2, sound: "tap" },
        bar: { beat: 3.6, sound: "tap" },
        full: { beat: 3.7, sound: "swipe" },
      }),
      ch("contact", 10, {
        push: { beat: 0, sound: "swipe" },
        badge: { beat: 1, sound: "pop" },
        row: { beat: 3, sound: "tap" },
        open: { beat: 3.3, sound: "swipe" },
        second: { beat: 5 },
      }),
    ],
    montage: [
      "halakha",
      "tikoun",
      "chnei",
      "signet",
      "tehilim",
      "nichmat40",
      "sidourAjouts",
      "boussole",
      "recherche",
      "rappels",
      "epingles",
      "contraste",
    ],
    end: 8,
  };
}

/** The five sections of the cut, for the shared grid (timeline.ts). */
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
