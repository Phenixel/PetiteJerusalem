import { HDate, Sedra } from "@hebcal/core";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";

/**
 * Lectures « du moment » de la lecture quotidienne : des entrées qui suivent
 * le calendrier hébraïque au lieu d'être choisies une à une.
 *
 * - Paracha de la semaine (chnei mikra) : la paracha lue au prochain Chabbat,
 *   affichée toute la semaine. Calendrier de diaspora (le public de
 *   l'application est en France). C'est une lecture de la semaine : son suivi
 *   tient jusqu'au changement de paracha, pas jusqu'à minuit.
 * - Tehilim du jour : le cycle mensuel traditionnel (les 150 psaumes répartis
 *   sur les jours du mois hébraïque).
 */

export const DAILY_OPTION_KEYS = ["parasha", "tehilim-jour"] as const;
export type DailyOptionKey = (typeof DAILY_OPTION_KEYS)[number];

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;

const TORAH_LIVRES = new Set(["Berechit", "Chemot", "Vayikra", "Bamidbar", "Devarim"]);

const normalize = (name: string): string => name.toLowerCase().replace(/[^a-z]/g, "");

// Parachiot du catalogue, indexées par nom normalisé (Torah uniquement,
// le Choftim des Nevi'im ne doit pas masquer celui du Deutéronome).
const parashaByKey = new Map<string, TextStudyJsonEntry>();
for (const entry of allTexts) {
  if (String(entry.type) === "Tanakh" && TORAH_LIVRES.has(entry.livre)) {
    parashaByKey.set(normalize(entry.name), entry);
  }
}

// Psaumes du catalogue par numéro (lien "…/Psalms.N").
const psalmByNumber = new Map<number, TextStudyJsonEntry>();
for (const entry of allTexts) {
  if (String(entry.type) === "Tehilim") {
    const num = Number(String(entry.link).split(".").pop());
    if (Number.isInteger(num)) psalmByNumber.set(num, entry);
  }
}

// Graphies hebcal → graphies du catalogue (après normalisation des deux côtés).
const HEBCAL_ALIASES: Record<string, string> = {
  bereshit: "berechit",
  noach: "noah",
  chayeisara: "chayeisarah",
  vayetzei: "vayetze",
  shmini: "shemini",
  achreimot: "achareimot",
  shlach: "shelach",
  eikev: "ekev",
  kiteitzei: "kitetze",
  vayeilech: "vayelech",
  vezothaberakhah: "vzothaberachah",
};

export interface WeeklyParasha {
  /** Noms hebcal ("Eikev", ou deux noms pour une paracha double). */
  names: string[];
  /** Entrées du catalogue correspondantes (2 pour une paracha double). */
  entries: TextStudyJsonEntry[];
  /**
   * Identifiant de la semaine : la date civile (YYYY-MM-DD) du Chabbat où
   * cette paracha est lue. Sert au suivi hebdomadaire du chnei mikra.
   */
  weekKey: string;
}

/**
 * La paracha de la semaine : celle du Chabbat à venir (aujourd'hui si Chabbat).
 * Les semaines de fête n'ont pas de paracha ordinaire ; on affiche alors celle
 * du prochain Chabbat ordinaire, que le chnei mikra anticipe.
 */
export function getWeeklyParasha(date: Date = new Date()): WeeklyParasha | null {
  const saturday = new Date(date);
  saturday.setDate(saturday.getDate() + ((6 - saturday.getDay() + 7) % 7));
  for (let i = 0; i < 6; i++) {
    const hd = new HDate(saturday);
    const reading = new Sedra(hd.getFullYear(), false).lookup(hd);
    if (!reading.chag) {
      const entries = reading.parsha
        .map((name) => parashaByKey.get(HEBCAL_ALIASES[normalize(name)] ?? normalize(name)))
        .filter((e): e is TextStudyJsonEntry => Boolean(e));
      const month = String(saturday.getMonth() + 1).padStart(2, "0");
      const day = String(saturday.getDate()).padStart(2, "0");
      const weekKey = `${saturday.getFullYear()}-${month}-${day}`;
      return entries.length === reading.parsha.length
        ? { names: [...reading.parsha], entries, weekKey }
        : null;
    }
    saturday.setDate(saturday.getDate() + 7);
  }
  return null;
}

/**
 * Cycle mensuel des Tehilim : plages de psaumes par jour du mois hébraïque
 * (1..30). Les jours 25 et 26 se partagent traditionnellement le psaume 119
 * (moitié chacun) ; l'application affiche le psaume entier les deux jours.
 */
export const TEHILIM_MONTHLY: [number, number][] = [
  [1, 9],
  [10, 17],
  [18, 22],
  [23, 28],
  [29, 34],
  [35, 38],
  [39, 43],
  [44, 48],
  [49, 54],
  [55, 59],
  [60, 65],
  [66, 68],
  [69, 71],
  [72, 76],
  [77, 78],
  [79, 82],
  [83, 87],
  [88, 89],
  [90, 96],
  [97, 103],
  [104, 105],
  [106, 107],
  [108, 112],
  [113, 118],
  [119, 119],
  [119, 119],
  [120, 134],
  [135, 139],
  [140, 144],
  [145, 150],
];

export interface TehilimCycle {
  /** Jour du cycle : jour du mois hébraïque (1..30) ou de la semaine (0..6). */
  day: number;
  /** Numéros des psaumes du jour. */
  psalms: number[];
  entries: TextStudyJsonEntry[];
}

function expand(ranges: [number, number][]): number[] {
  const psalms: number[] = [];
  for (const [from, to] of ranges) {
    for (let n = from; n <= to; n++) if (!psalms.includes(n)) psalms.push(n);
  }
  return psalms;
}

function toCycle(day: number, ranges: [number, number][]): TehilimCycle {
  const psalms = expand(ranges);
  return {
    day,
    psalms,
    entries: psalms
      .map((n) => psalmByNumber.get(n))
      .filter((e): e is TextStudyJsonEntry => Boolean(e)),
  };
}

/** Les psaumes du jour du mois hébraïque. */
export function getTehilimOfDay(date: Date = new Date()): TehilimCycle {
  const hd = new HDate(date);
  const day = hd.getDate();
  const ranges: [number, number][] = [TEHILIM_MONTHLY[day - 1]];
  // Mois de 29 jours : le 29 couvre aussi la part du 30.
  if (day === 29 && hd.daysInMonth() === 29) ranges.push(TEHILIM_MONTHLY[29]);
  return toCycle(day, ranges);
}
