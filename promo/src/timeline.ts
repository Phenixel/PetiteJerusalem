/**
 * La grille commune à l'image et au son. Une vidéo se découpe en temps
 * musicaux (beats) : la musique est composée sur ces mêmes temps
 * (scripts/music.mjs), si bien que chaque coupe, chaque titre et chaque
 * geste tombe sur un temps fort. Ce fichier ne contient que des données,
 * lisibles par Remotion comme par Node (qui l'importe tel quel).
 */

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** Les cinq temps d'une vidéo, toujours dans cet ordre. */
export type SectionKind = "hook" | "feature" | "break" | "montage" | "end";

/** Bruitages posés sur la grille, joués par la musique. */
export type CueSound = "whoosh" | "tap" | "pop" | "impact" | "swipe" | "chime" | "type";

export type Cue = { beat: number; sound: CueSound };

/** Couleur et caractère musical d'une vidéo. */
export type MusicStyle = {
  bpm: number;
  /** Tonique en MIDI (62 = ré). */
  root: number;
  /** Motif mélodique, voir MOTIFS dans scripts/music.mjs. */
  motif: "freygish" | "envol" | "nigoun" | "lumiere" | "dabke";
  /** Accords d'une mesure à l'autre, en demi-tons depuis la tonique. */
  progression: number[][];
  /**
   * Le genre (série 2) : « pop » est celui de la série 1 ; « mizrahi »,
   * « halftime » et « cinematic » changent la batterie et ajoutent piano,
   * bégaiements avant les drops et arrêt de bande sur la coupure.
   */
  genre?: "pop" | "mizrahi" | "halftime" | "cinematic";
  /** Temps de la feature où la musique retombe, en drop. */
  drops?: number[];
};

export type Timeline = {
  bpm: number;
  sections: { kind: SectionKind; from: number; beats: number }[];
  totalBeats: number;
  /** Secondes de queue (réverbération, fondu) après le dernier temps. */
  tail: number;
};

/** Durées en temps de chaque section : l'accroche, la fonctionnalité, etc. */
export type Durations = Record<SectionKind, number>;

export function buildTimeline(bpm: number, durations: Durations): Timeline {
  const order: SectionKind[] = ["hook", "feature", "break", "montage", "end"];
  let from = 0;
  const sections = order.map((kind) => {
    const section = { kind, from, beats: durations[kind] };
    from += durations[kind];
    return section;
  });
  return { bpm, sections, totalBeats: from, tail: 1 };
}

export const framesPerBeat = (bpm: number) => (FPS * 60) / bpm;

export const beatToFrame = (bpm: number, beat: number) => Math.round(beat * framesPerBeat(bpm));

export const totalFrames = (t: Timeline) =>
  beatToFrame(t.bpm, t.totalBeats) + Math.round(t.tail * FPS);
