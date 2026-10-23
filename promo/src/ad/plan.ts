/**
 * The cut of the advertisement (`pub`), as data: its scenes, their length
 * in beats and their marked beats, each with the sound the music plays
 * there. Read by Remotion (src/ad/scenes.tsx) and by Node (src/videos.ts,
 * then scripts/music.mjs), hence no JSX here.
 *
 * An advertisement, not a presentation: the app told in motion design
 * along one day, from dawn to night (the times under the rising sun, the
 * Sidour that opens, the phone that goes quiet, the shelf and the daf page,
 * the classes, a chain of 150 psalms completed together, the wall of Mon
 * parcours and its light), then the real screens in a quick montage, then
 * the stores. Under a minute and a half.
 *
 * Sections hold whole bars, as in the other cuts: the scenes add up to a
 * multiple of four beats.
 */
import type { CueSound, Durations } from "../timeline.ts";

export type AdSceneId = "aube" | "tefila" | "etude" | "ecoute" | "ensemble" | "parcours";

export type AdMark = { beat: number; sound?: CueSound };

export type AdScene = { id: AdSceneId; beats: number; marks: Record<string, AdMark> };

export type AdShot = { label: string; src: string };

export type AdPlan = { hook: number; scenes: AdScene[]; montage: AdShot[]; end: number };

const scene = (id: AdSceneId, beats: number, marks: Record<string, AdMark>): AdScene => ({ id, beats, marks });

/** Beats `from`, `from + step`... `count` of them, each with the same sound. */
const run = (name: string, from: number, count: number, step: number, sound: CueSound): Record<string, AdMark> =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [`${name}${i}`, { beat: from + i * step, sound }]));

export function adPlan(): AdPlan {
  return {
    hook: 8,
    scenes: [
      // Night, then the sun rising behind the logo's wall, the day's times along its path.
      scene("aube", 20, {
        sunrise: { beat: 2, sound: "whoosh" },
        ...run("chip", 5, 4, 1.5, "pop"),
        title2: { beat: 12 },
        phone: { beat: 13, sound: "swipe" },
        ...run("city", 15.5, 4, 0.75, "tap"),
      }),
      // The Sidour opens on its morning page; then the phone rings, and goes quiet.
      scene("tefila", 20, {
        book: { beat: 0, sound: "whoosh" },
        open: { beat: 1.5, sound: "swipe" },
        pill: { beat: 5, sound: "pop" },
        ring: { beat: 9, sound: "impact" },
        ...run("toggle", 11, 3, 1, "tap"),
        quiet: { beat: 14.5, sound: "chime" },
      }),
      // Six volumes on the shelf; the Talmud's opens into its page; then the translation.
      scene("etude", 24, {
        ...run("book", 1, 6, 0.75, "pop"),
        pull: { beat: 7.5, sound: "whoosh" },
        daf: { beat: 8.5, sound: "swipe" },
        gemara: { beat: 9.5, sound: "pop" },
        rashi: { beat: 11.5, sound: "swipe" },
        tossafot: { beat: 12.5, sound: "swipe" },
        trans: { beat: 16, sound: "whoosh" },
        line: { beat: 18, sound: "pop" },
      }),
      // A class: the round button, the sound that moves, the rabbanim.
      scene("ecoute", 12, {
        button: { beat: 0.5, sound: "pop" },
        play: { beat: 2, sound: "tap" },
        ...run("rav", 4.5, 3, 0.75, "pop"),
      }),
      // 150 psalms, six readers, each takes a share: the chain fills, then completes.
      scene("ensemble", 24, {
        grid: { beat: 0.5, sound: "whoosh" },
        ...run("reader", 3, 6, 1.5, "pop"),
        full: { beat: 13.5, sound: "chime" },
        link: { beat: 18, sound: "whoosh" },
        ...run("bubble", 19.5, 3, 0.75, "pop"),
      }),
      // Mon parcours: a stone a day, the light that grows, a goal; the night falls.
      scene("parcours", 20, {
        stones: { beat: 1, sound: "impact" },
        ...run("light", 4, 3, 2.5, "chime"),
        goal: { beat: 13, sound: "swipe" },
        night: { beat: 17, sound: "whoosh" },
      }),
    ],
    montage: [
      { label: "Votre journée", src: "fr-accueil.jpg" },
      { label: "Le Sidour", src: "fr-sidour.jpg" },
      { label: "Les horaires", src: "fr-horaires.jpg" },
      { label: "La boussole du Kotel", src: "fr-boussole-17.jpg" },
      { label: "Le Talmud dans sa page", src: "fr-daf-06.jpg" },
      { label: "Lire à plusieurs", src: "fr-chaine-00.jpg" },
      { label: "Les cours", src: "fr-audio-08.jpg" },
      { label: "Mon parcours", src: "fr-parcours-00.jpg" },
    ],
    end: 10,
  };
}

/** The five sections of the cut, for the shared grid (timeline.ts). */
export function adDurations(plan: AdPlan): Durations {
  return {
    hook: plan.hook,
    feature: plan.scenes.reduce((sum, s) => sum + s.beats, 0),
    break: 2,
    montage: plan.montage.length * 2,
    end: plan.end,
  };
}

/** The scenes' marks, counted from the start of the feature section: the music's cues. */
export function adMarks(plan: AdPlan): Record<string, AdMark> {
  const out: Record<string, AdMark> = {};
  let from = 0;
  for (const s of plan.scenes) {
    for (const [name, mark] of Object.entries(s.marks)) out[`${s.id}.${name}`] = { ...mark, beat: from + mark.beat };
    from += s.beats;
  }
  return out;
}

/** Where each scene starts, in beats from the start of the feature section (the music's relaunches). */
export function adSceneStarts(plan: AdPlan): number[] {
  const starts: number[] = [];
  let from = 0;
  for (const s of plan.scenes) {
    starts.push(from);
    from += s.beats;
  }
  return starts;
}
