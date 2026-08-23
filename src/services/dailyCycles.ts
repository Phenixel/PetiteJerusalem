import { HDate, Sedra, flags, getHolidaysOnDate, months, tachanun } from "@hebcal/core";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { TORAH_LIVRES } from "../content/etudeTexts";

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
 * La paracha lue à un Chabbat donné, ou null si ce Chabbat n'en a pas.
 *
 * `getWeeklyParasha` anticipe : sur une semaine de fête, elle renvoie la
 * paracha du Chabbat ordinaire suivant, ce que veut le chnei mikra. Pour
 * annoncer « la paracha de CE Chabbat », cette anticipation est trompeuse
 * on ne garde donc le résultat que s'il tombe bien sur le samedi demandé.
 */
export function getParashaForShabbat(saturday: Date): WeeklyParasha | null {
  const parasha = getWeeklyParasha(saturday);
  if (!parasha) return null;
  const month = String(saturday.getMonth() + 1).padStart(2, "0");
  const day = String(saturday.getDate()).padStart(2, "0");
  return parasha.weekKey === `${saturday.getFullYear()}-${month}-${day}` ? parasha : null;
}

/** Le Chabbat d'une `weekKey` ("2026-08-08"), dans le repère local. */
export function shabbatOfWeek(weekKey: string): Date {
  const [year, month, day] = weekKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

/**
 * La paracha du Chabbat ordinaire qui suit (`direction` = 1) ou précède (-1)
 * celui de `weekKey` : de quoi feuilleter les parachiot une à une.
 *
 * Les Chabbats de fête n'ont pas de paracha ordinaire (`getParashaForShabbat`
 * renvoie null) ; on les enjambe plutôt que de s'arrêter sur une semaine vide.
 * Deux Chabbats de fête ne se suivent jamais de plus de deux crans, la borne
 * est large.
 */
export function adjacentParasha(weekKey: string, direction: 1 | -1): WeeklyParasha | null {
  const saturday = shabbatOfWeek(weekKey);
  for (let step = 0; step < 8; step++) {
    saturday.setDate(saturday.getDate() + direction * 7);
    const parasha = getParashaForShabbat(saturday);
    if (parasha) return parasha;
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
  /** Jour du cycle : jour du mois hébraïque (1..30). */
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

/**
 * L'hiver de la Amida (« machiv haroua'h oumorid haguéchem ») : du 22 Tichri
 * au 14 Nissan inclus. Les bascules exactes se font à Moussaf de Chemini
 * Atséret et de Pessah, deux Yom Tov où le sidour de semaine ne se lit pas :
 * à la journée près, la règle est exacte pour tous les jours qu'il couvre.
 */
export function isWinterMention(hd: HDate): boolean {
  const year = hd.getFullYear();
  const start = new HDate(22, months.TISHREI, year).abs();
  const end = new HDate(14, months.NISAN, year).abs();
  const abs = hd.abs();
  return abs >= start && abs <= end;
}

/** Année civile bissextile (grégorienne). */
const isGregLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * La demande de pluie (« barekh alénou », avec tal oumatar) : en Israël dès le
 * 7 'Hechvan, en diaspora depuis Arvit du 4 décembre (du 5 quand le février
 * suivant compte 29 jours). Le jour hébraïque bascule à la chkia : celui qui
 * commence le 4 décembre au soir porte la date civile du 5, la comparaison se
 * fait donc sur le 5 (ou le 6). Dans les deux calendriers, on la dit jusqu'au
 * 14 Nissan inclus, la veille de Pessah.
 */
export function isRainRequest(hd: HDate, il: boolean): boolean {
  const year = hd.getFullYear();
  const abs = hd.abs();
  const end = new HDate(14, months.NISAN, year).abs();
  if (abs > end) return false;
  return abs >= rainRequestStart(year, il);
}

/** Le jour (absolu) où la demande de pluie commence pour l'année hébraïque. */
function rainRequestStart(year: number, il: boolean): number {
  if (il) return new HDate(7, months.CHESHVAN, year).abs();
  // Décembre de l'année civile où cette année hébraïque a commencé.
  const civilYear = new HDate(1, months.TISHREI, year).greg().getFullYear();
  const startDay = isGregLeap(civilYear + 1) ? 6 : 5;
  return new HDate(new Date(civilYear, 11, startDay)).abs();
}

/**
 * Les variantes saisonnières de la 'Amida qui viennent de basculer : pendant
 * les trois premières semaines d'une mention (machiv haroua'h / morid hatal)
 * ou d'une demande (barekh 'alénou / barkhénou), le lecteur affiche le
 * passage en rouge plutôt qu'à la couleur du thème, le temps que le pli se
 * prenne, c'est là qu'on se trompe.
 */
const RECENT_CHANGE_DAYS = 21;

export function recentSeasonalChanges(hd: HDate, il: boolean): Set<string> {
  const recent = new Set<string>();
  const abs = hd.abs();
  const year = hd.getFullYear();
  // L'été (mention et demande) commence le 15 Nissan ; pour les jours entre
  // Tichri et Nissan, celui de l'année hébraïque précédente.
  const summerStart = (() => {
    const nissan = new HDate(15, months.NISAN, year).abs();
    return abs >= nissan ? nissan : new HDate(15, months.NISAN, year - 1).abs();
  })();
  if (isWinterMention(hd)) {
    if (abs - new HDate(22, months.TISHREI, year).abs() < RECENT_CHANGE_DAYS)
      recent.add("hiver");
  } else if (abs - summerStart < RECENT_CHANGE_DAYS) {
    recent.add("ete");
  }
  if (isRainRequest(hd, il)) {
    if (abs - rainRequestStart(year, il) < RECENT_CHANGE_DAYS) recent.add("barekh-alenou");
  } else if (abs - summerStart < RECENT_CHANGE_DAYS) {
    recent.add("barkhenou");
  }
  return recent;
}

/**
 * Occasions du calendrier actives un jour hébraïque donné : les clés `when`
 * des blocs conditionnels des textes de tefila (public/texts/tefila/*),
 * qui ne s'affichent que le jour où leur ajout se dit, Retsé le Chabbat,
 * Yaalé véyavo à Roch Hodech et aux fêtes, Al hanissim à Hanouka et Pourim…
 *
 * `il` : calendrier d'Israël (un seul jour de Yom Tov) ou de diaspora.
 */
export function activeOccasions(hd: HDate, il: boolean): Set<string> {
  const events = getHolidaysOnDate(hd, il) ?? [];
  const has = (mask: number) => events.some((ev) => (ev.getFlags() & mask) !== 0);
  // La fête elle-même, reconnue à son `basename` : « Pessah III (CH''M) » et
  // « Roch Hachana 5787 » se ramènent à « Pesach » et « Rosh Hashana ». Un
  // préfixe ne suffirait pas : « Rosh Hashana LaBehemot » (1 Eloul) et
  // « Pesach Sheni » (14 Iyar) sont des fêtes mineures, sans aucun ajout, et
  // commencent pourtant par le nom de la grande. Les veilles sont écartées :
  // le basename d'« Erev Pessah » est « Pesach », mais on n'y dit rien.
  const festival = (name: string) =>
    events.some((ev) => (ev.getFlags() & flags.EREV) === 0 && ev.basename() === name);
  const occ = new Set<string>();
  if (hd.getDay() === 6) occ.add("shabbat");
  if (has(flags.ROSH_CHODESH)) occ.add("rosh-chodesh");
  if (festival("Rosh Hashana")) occ.add("rosh-hashana");
  if (has(flags.CHAG)) occ.add("yom-tov");
  if (festival("Sukkot")) occ.add("sukkot");
  // Hanouka : hebcal pose « 1 Candle » sur la VEILLE (l'allumage du soir) ;
  // le premier jour porte « 2 Candles », le dernier « 8th Day ».
  const hanukkah = events.some((ev) => /^Chanukah: (?:[2-8] Candles|8th Day)/.test(ev.getDesc()));
  const purim = events.some((ev) => ev.getDesc() === "Purim");
  if (hanukkah || purim) occ.add("nissim");
  if (["Pesach", "Shavuot", "Sukkot", "Shmini Atzeret", "Simchat Torah"].some(festival))
    occ.add("moadim");
  // La fête nommée, pour les ajouts qui la citent (le Mé'ein chaloch dit
  // laquelle) : à Souccot déjà posée plus haut, ici ses trois sœurs.
  if (festival("Pesach")) occ.add("pesach");
  if (festival("Shavuot")) occ.add("shavuot");
  if (festival("Shmini Atzeret") || festival("Simchat Torah")) occ.add("shemini-atzeret");
  if (occ.has("rosh-chodesh") || has(flags.CHAG) || has(flags.CHOL_HAMOED)) occ.add("moed");
  if (occ.has("shabbat") || occ.has("moed")) occ.add("shabbat-or-moed");
  // Les dix jours de pénitence : de Roch Hachana à Yom Kippour, 1 au 10 Tichri.
  // Ils n'ouvrent aucun ajout à eux seuls, ils déplient les encadrés des
  // Sli'hot, qui restent lisibles le reste de l'année (voir TextBlock.fold).
  if (hd.getMonth() === months.TISHREI && hd.getDate() <= 10) occ.add("teshuva");

  // --- Sidour de semaine ---------------------------------------------------
  // L'été et l'hiver de la Amida : la mention de la pluie (22 Tichri au
  // 14 Nissan) et sa demande (7 'Hechvan en Israël, début décembre en
  // diaspora). Deux paires de clés exclusives : chaque variante du texte
  // porte la sienne, seule celle du jour s'affiche.
  occ.add(isWinterMention(hd) ? "hiver" : "ete");
  occ.add(isRainRequest(hd, il) ? "barekh-alenou" : "barkhenou");
  // Le tahanoun, par office : il tombe à Roch Hodech, aux fêtes, tout
  // Nissan… et l'après-midi seulement la veille d'un jour où il tombe.
  // Rien le Chabbat : le sidour de semaine ne s'y lit pas.
  if (hd.getDay() !== 6) {
    const said = tachanun(hd, il);
    if (said.shacharit) occ.add("tahanoun");
    if (said.mincha) occ.add("tahanoun-minha");
    // Les supplications longues du lundi et du jeudi accompagnent le
    // tahanoun : elles tombent avec lui.
    if (said.shacharit && (hd.getDay() === 1 || hd.getDay() === 4))
      occ.add("tahanoun-lundi-jeudi");
  }
  // La lecture de la Torah des lundis et jeudis ordinaires : le début de la
  // paracha de la semaine. Les jours à lecture propre (Roch Hodech, 'Hanouka,
  // Pourim, jeûnes publics, 'Hol haMoed) lisent leur passage, pas celui-là.
  // Les jeûnes de coutume (BeHaB, Yom Kippour Katan) gardent la lecture
  // ordinaire : hebcal les marque pourtant comme jeûnes, on les écarte.
  const publicFast = events.some(
    (ev) =>
      (ev.getFlags() & (flags.MAJOR_FAST | flags.MINOR_FAST)) !== 0 &&
      !/^(Ta'anit BeHaB|Yom Kippur Katan)/.test(ev.getDesc()),
  );
  const ownReading =
    occ.has("rosh-chodesh") || occ.has("nissim") || publicFast || has(flags.CHOL_HAMOED);
  if ((hd.getDay() === 1 || hd.getDay() === 4) && !ownReading) occ.add("torah-semaine");
  // Un séfer Torah est sorti à Cha'harit : lundi et jeudi, Chabbat, et les
  // jours à lecture propre. C'est la clé de ce qui accompagne son retour
  // (Yehalelou), quel que soit le passage lu.
  if (hd.getDay() === 1 || hd.getDay() === 4 || hd.getDay() === 6 || ownReading)
    occ.add("sefer-torah");
  // Le birkat hamazon dit מגדול les jours où l'on dit Moussaf (Chabbat, Roch
  // Hodech, fêtes et 'Hol haMoed) et à Pourim (pour sa séouda), מגדיל les
  // autres jours. Paire exclusive, comme ete/hiver : le texte porte les deux,
  // seule celle du jour s'affiche.
  occ.add(occ.has("shabbat-or-moed") || purim ? "migdol" : "magdil");
  // Le jour de la semaine (0 = dimanche) : le chir chel yom n'affiche que le
  // psaume du jour.
  occ.add(`jour-${hd.getDay()}`);
  // Lédavid (psaume 27) : du 1er Eloul à Hochana Rabba (21 Tichri).
  if (
    hd.getMonth() === months.ELUL ||
    (hd.getMonth() === months.TISHREI && hd.getDate() <= 21)
  )
    occ.add("ledavid");
  return occ;
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
