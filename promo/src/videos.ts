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
  /** 1 : la première série ; 2 : les histoires (gabarit Story, 31 s). */
  series?: 1 | 2;
  /** Temps par plan du montage (2 dans la série 2, pour avoir le temps de lire). */
  montageStep?: number;
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

// === Série 2 : les histoires =====================================================

/** 31 secondes : une histoire de 36 temps, six plans de montage à deux temps. */
const S2: Durations = { hook: 4, feature: 36, break: 2, montage: 12, end: 8 };

/** Des temps marqués d'un même bruitage : cues("w", "whoosh", 0, 6, 12). */
function cues(prefix: string, sound: CueSound, ...beats: number[]) {
  return Object.fromEntries(beats.map((beat, i) => [`${prefix}${i}`, { beat, sound }]));
}

VIDEOS.push(
  {
    id: "refoua",
    title: "Un proche est malade",
    series: 2,
    montageStep: 2,
    look: { theme: "ocean", dark: false },
    music: {
      bpm: 120,
      root: 62,
      motif: "lumiere",
      genre: "cinematic",
      drops: [16, 30],
      progression: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
    },
    durations: S2,
    marks: {
      cree: { beat: 6, sound: "swipe" },
      envoi: { beat: 16 },
      reserve: { beat: 24, sound: "whoosh" },
      siyoum: { beat: 30 },
      ctaTap: { beat: 5.33, sound: "tap" },
      submitTap: { beat: 15.6, sound: "tap" },
      sent: { beat: 17, sound: "chime" },
      full: { beat: 33, sound: "chime" },
      ...cues("type", "type", 6.5, 7.3, 8.1),
      ...cues("ami", "pop", 17, 17.2, 17.4, 17.6, 17.8, 18, 18.2, 18.4),
    },
    montage: ["horaires", "bibliotheque", "sidour", "calendrier", "lecture", "kotel"],
  },
  {
    id: "journee",
    title: "Une journée avec l'app",
    series: 2,
    montageStep: 2,
    look: { theme: "sunset", dark: false },
    music: {
      bpm: 120,
      root: 64,
      motif: "freygish",
      genre: "halftime",
      drops: [18],
      progression: [[0, 4, 7], [1, 5, 8], [-2, 1, 5], [0, 4, 7]],
    },
    durations: S2,
    marks: {
      ...cues("heure", "whoosh", 6, 12, 18, 24, 30),
      notif1: { beat: 13, sound: "chime" },
      notif2: { beat: 25.5, sound: "chime" },
      minha: { beat: 21, sound: "swipe" },
    },
    montage: ["partage", "bibliotheque", "calendrier", "kotel", "mesdates", "chiourim"],
  },
  {
    id: "secrets",
    title: "3 gestes que personne ne connaît",
    series: 2,
    montageStep: 2,
    look: { theme: "sunset", dark: false },
    music: {
      bpm: 120,
      root: 65,
      motif: "dabke",
      genre: "halftime",
      drops: [12, 24],
      progression: [[0, 4, 7], [1, 5, 8], [-2, 1, 5], [0, 4, 7]],
    },
    durations: S2,
    marks: {
      deux: { beat: 12 },
      trois: { beat: 24 },
      swipe: { beat: 4, sound: "swipe" },
      toast: { beat: 7.5, sound: "pop" },
      ...cues("double", "tap", 16, 16.33),
      defile: { beat: 16.5, sound: "whoosh" },
      kotelTap: { beat: 27, sound: "tap" },
      kotel: { beat: 27.5, sound: "chime" },
    },
    montage: ["partage", "bibliotheque", "calendrier", "lecture", "mesdates", "chiourim"],
  },
  {
    id: "chiffres",
    title: "Petite Jérusalem en chiffres",
    series: 2,
    montageStep: 2,
    look: { theme: "emerald", dark: false },
    music: {
      bpm: 120,
      root: 60,
      motif: "nigoun",
      genre: "mizrahi",
      drops: [18],
      progression: [[0, 4, 7], [1, 5, 8], [0, 4, 7], [-2, 1, 5]],
    },
    durations: S2,
    marks: {
      ...cues("plan", "whoosh", 6, 12, 18, 24, 30),
      ...cues("compte", "pop", 1.33, 7.33, 13.33, 19.33, 25.33, 31.33),
    },
    montage: ["horaires", "partage", "sidour", "kotel", "calendrier", "lecture"],
  },
  {
    id: "fetes",
    title: "L'app se met en fête",
    series: 2,
    montageStep: 2,
    look: { theme: "sunset", dark: false },
    music: {
      bpm: 120,
      root: 62,
      motif: "freygish",
      genre: "mizrahi",
      drops: [8, 22],
      progression: [[0, 4, 7], [1, 5, 8], [-2, 1, 5], [0, 4, 7]],
    },
    durations: S2,
    marks: {
      ...cues("fete", "whoosh", 15, 29),
      ...cues("voeu", "pop", 1, 9, 16, 23, 30),
      ...cues("rond", "swipe", 3.2, 11.2, 18.2, 25.2, 32.2),
    },
    montage: ["horaires", "partage", "bibliotheque", "calendrier", "mesdates", "sombre"],
  },
  {
    id: "langues",
    title: "Français, English, עברית",
    series: 2,
    montageStep: 2,
    look: { theme: "sunset", dark: false },
    music: {
      bpm: 120,
      root: 67,
      motif: "envol",
      genre: "mizrahi",
      drops: [12, 24],
      progression: [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-5, -2, 2]],
    },
    durations: S2,
    marks: {
      ...cues("flip", "swipe", 4, 8),
      ...cues("fan", "pop", 12.2, 12.4, 12.6, 24.2, 24.4, 24.6),
    },
    montage: ["partage", "bibliotheque", "sidour", "kotel", "calendrier", "lecture"],
  },
);

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
  const step = v.montageStep ?? 1;
  for (let i = step; i < montage.beats; i += step) cues.push({ beat: montage.from + i, sound: "whoosh" });
  return cues;
}
