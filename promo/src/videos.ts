/**
 * Les vidéos, en données : leur grille, leur musique, leurs bruitages, leur
 * montage final. Lu par Remotion (src/Root.tsx) et par Node
 * (scripts/music.mjs), d'où l'absence de JSX ici.
 *
 * Chaque vidéo montre une seule partie de l'app, puis « Mais aussi… » et
 * huit autres en un temps chacune. Les temps marqués (`marks`) sont comptés
 * depuis le début de la section « feature » : la scène les lit pour placer
 * ses gestes, la musique pour y poser ses bruitages.
 */
import type { Look } from "./theme.ts";
import { buildTimeline, type Cue, type CueSound, type Durations, type MusicStyle } from "./timeline.ts";

export type MontageId =
  | "horaires"
  | "rappel"
  | "partage"
  | "bibliotheque"
  | "sidour"
  | "kotel"
  | "calendrier"
  | "mesdates"
  | "lecture"
  | "chiourim"
  | "talmud"
  | "sombre";

/** Le réservoir du montage : une étiquette, une capture, son habillage. */
export const MONTAGE: Record<MontageId, { label: string; src: string; look: Look }> = {
  horaires: { label: "Les horaires du jour", src: "sunset-horaires.jpg", look: { theme: "sunset", dark: false } },
  rappel: { label: "Un rappel d'un geste", src: "sunset-horaires-swipe-14.jpg", look: { theme: "sunset", dark: false } },
  partage: { label: "Les Tehilim à plusieurs", src: "ocean-session.jpg", look: { theme: "ocean", dark: false } },
  bibliotheque: { label: "Toute une bibliothèque", src: "emerald-bibliotheque.jpg", look: { theme: "emerald", dark: false } },
  sidour: { label: "Le sidour du jour", src: "night-chaharit.jpg", look: { theme: "sunset", dark: true } },
  kotel: { label: "La direction du Kotel", src: "night-kotel-08.jpg", look: { theme: "sunset", dark: true } },
  calendrier: { label: "Le calendrier des fêtes", src: "oceanNight-calendrier.jpg", look: { theme: "ocean", dark: true } },
  mesdates: { label: "Vos dates hébraïques", src: "oceanNight-mes-dates.jpg", look: { theme: "ocean", dark: true } },
  lecture: { label: "Une lecture par jour", src: "sunset-lecture-du-jour.jpg", look: { theme: "sunset", dark: false } },
  chiourim: { label: "Des cours audio", src: "sunset-chiour.jpg", look: { theme: "sunset", dark: false } },
  talmud: { label: "Le Talmud, daf après daf", src: "emerald-talmud.jpg", look: { theme: "emerald", dark: false } },
  sombre: { label: "Un mode sombre", src: "night-accueil.jpg", look: { theme: "sunset", dark: true } },
};

export type VideoSpec = {
  id: string;
  /** Titre lisible, pour le studio et les fichiers. */
  title: string;
  look: Look;
  music: MusicStyle;
  durations: Durations;
  /** Temps marqués de la section « feature », et le bruitage qui va avec. */
  marks: Record<string, { beat: number; sound?: CueSound }>;
  montage: MontageId[];
};

const STD: Durations = { hook: 4, feature: 24, break: 2, montage: 8, end: 6 };

export const VIDEOS: VideoSpec[] = [
  {
    id: "horaires",
    title: "Les horaires du jour",
    look: { theme: "sunset", dark: false },
    music: {
      bpm: 120,
      root: 62,
      motif: "freygish",
      progression: [[0, 4, 7], [1, 5, 8], [-2, 1, 5], [0, 4, 7]],
    },
    durations: STD,
    marks: {
      phone: { beat: 0, sound: "whoosh" },
      fab: { beat: 2, sound: "tap" },
      zmanim: { beat: 2.5, sound: "swipe" },
      position: { beat: 6, sound: "whoosh" },
      swipe: { beat: 10, sound: "swipe" },
      toast: { beat: 13, sound: "pop" },
      notif: { beat: 16, sound: "chime" },
      jerusalem: { beat: 20, sound: "whoosh" },
      newYork: { beat: 21, sound: "whoosh" },
      montreal: { beat: 22, sound: "whoosh" },
    },
    montage: ["bibliotheque", "partage", "calendrier", "kotel", "lecture", "chiourim", "talmud", "sombre"],
  },
  {
    id: "partage",
    title: "Les Tehilim à plusieurs",
    look: { theme: "ocean", dark: false },
    music: {
      bpm: 120,
      root: 64,
      motif: "envol",
      progression: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
    },
    durations: STD,
    marks: {
      phone: { beat: 0, sound: "whoosh" },
      progress: { beat: 4.5, sound: "whoosh" },
      reserve: { beat: 8.5, sound: "whoosh" },
      box42: { beat: 9.5, sound: "tap" },
      box43: { beat: 10.5, sound: "tap" },
      box44: { beat: 11.5, sound: "tap" },
      confirm: { beat: 13, sound: "tap" },
      done: { beat: 13.5, sound: "chime" },
      shareTap: { beat: 15.5, sound: "tap" },
      share: { beat: 16, sound: "pop" },
      siyoum: { beat: 19.5, sound: "whoosh" },
      full: { beat: 22, sound: "impact" },
    },
    montage: ["horaires", "bibliotheque", "calendrier", "kotel", "rappel", "lecture", "chiourim", "sombre"],
  },
  {
    id: "bibliotheque",
    title: "Toute la Torah dans la poche",
    look: { theme: "emerald", dark: false },
    music: {
      bpm: 120,
      root: 60,
      motif: "nigoun",
      progression: [[0, 4, 7], [1, 5, 8], [0, 4, 7], [-2, 1, 5]],
    },
    durations: STD,
    marks: {
      phone: { beat: 0, sound: "whoosh" },
      books: { beat: 1, sound: "pop" },
      list: { beat: 4, sound: "swipe" },
      reader: { beat: 6, sound: "swipe" },
      phonetiqueTap: { beat: 10, sound: "tap" },
      phonetique: { beat: 10.5, sound: "pop" },
      plusTap: { beat: 13, sound: "tap" },
      grand: { beat: 14, sound: "pop" },
      doubleTap: { beat: 16, sound: "tap" },
      scroll: { beat: 16.5, sound: "whoosh" },
      offlineTap: { beat: 20.5, sound: "tap" },
      offline: { beat: 21, sound: "chime" },
    },
    montage: ["horaires", "partage", "sidour", "calendrier", "mesdates", "lecture", "chiourim", "rappel"],
  },
  {
    id: "sidour",
    title: "Le sidour du jour",
    look: { theme: "sunset", dark: true },
    music: {
      bpm: 120,
      root: 62,
      motif: "lumiere",
      progression: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2]],
    },
    durations: STD,
    marks: {
      phone: { beat: 0, sound: "whoosh" },
      chaharitTap: { beat: 3, sound: "tap" },
      chaharit: { beat: 3.5, sound: "swipe" },
      horaire: { beat: 4.5, sound: "pop" },
      menuTap: { beat: 8.5, sound: "tap" },
      menu: { beat: 9, sound: "pop" },
      amida: { beat: 12, sound: "whoosh" },
      kotelTap: { beat: 12.5, sound: "tap" },
      kotel: { beat: 13, sound: "pop" },
      parchemin: { beat: 18, sound: "whoosh" },
    },
    montage: ["horaires", "partage", "bibliotheque", "calendrier", "lecture", "talmud", "chiourim", "mesdates"],
  },
  {
    id: "calendrier",
    title: "Le calendrier des fêtes",
    look: { theme: "ocean", dark: true },
    music: {
      bpm: 120,
      root: 65,
      motif: "dabke",
      progression: [[0, 4, 7], [1, 5, 8], [-2, 1, 5], [0, 4, 7]],
    },
    durations: STD,
    marks: {
      phone: { beat: 0, sound: "whoosh" },
      fetes: { beat: 1.5, sound: "whoosh" },
      hanoukah: { beat: 5, sound: "whoosh" },
      mesDatesTap: { beat: 9, sound: "tap" },
      mesDates: { beat: 9.5, sound: "pop" },
      ajout: { beat: 13, sound: "swipe" },
      accueil: { beat: 17, sound: "whoosh" },
      occasion: { beat: 17.5, sound: "chime" },
      convertir: { beat: 21, sound: "pop" },
    },
    montage: ["horaires", "partage", "bibliotheque", "kotel", "rappel", "lecture", "talmud", "chiourim"],
  },
  {
    id: "lecture-du-jour",
    title: "Une lecture par jour",
    look: { theme: "emerald", dark: false },
    music: {
      bpm: 120,
      root: 67,
      motif: "envol",
      progression: [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-5, -2, 2]],
    },
    durations: STD,
    marks: {
      phone: { beat: 0, sound: "whoosh" },
      card: { beat: 1.5, sound: "pop" },
      openTap: { beat: 5, sound: "tap" },
      open: { beat: 5.5, sound: "swipe" },
      listeTap: { beat: 9.5, sound: "tap" },
      liste: { beat: 10, sound: "pop" },
      rappelTap: { beat: 13.5, sound: "tap" },
      rappel: { beat: 14, sound: "pop" },
      notif: { beat: 17.5, sound: "chime" },
      suivi: { beat: 20, sound: "whoosh" },
      tick1: { beat: 20.5, sound: "tap" },
      tick2: { beat: 21, sound: "tap" },
      tick3: { beat: 21.5, sound: "tap" },
      done: { beat: 22, sound: "impact" },
    },
    montage: ["horaires", "partage", "sidour", "kotel", "calendrier", "mesdates", "chiourim", "sombre"],
  },
];

export const videoTimeline = (v: VideoSpec) => buildTimeline(v.music.bpm, v.durations);

/** Les bruitages de la vidéo, en temps absolus. */
export function videoCues(v: VideoSpec): Cue[] {
  const t = videoTimeline(v);
  const feature = t.sections.find((s) => s.kind === "feature")!;
  const montage = t.sections.find((s) => s.kind === "montage")!;
  const cues: Cue[] = [];
  for (const mark of Object.values(v.marks)) {
    if (mark.sound) cues.push({ beat: feature.from + mark.beat, sound: mark.sound });
  }
  // Un souffle par plan du montage (le premier tombe avec l'impact).
  for (let i = 1; i < montage.beats; i++) cues.push({ beat: montage.from + i, sound: "whoosh" });
  return cues;
}
