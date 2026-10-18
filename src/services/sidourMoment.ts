import { HDate, months } from "@hebcal/core";
import { activeOccasions, omerDay } from "./dailyCycles";
import {
  currentTefilaWindow,
  nextTefilaWindow,
  tefilaHebrewDay,
  type TefilaKey,
  type TefilaWindow,
} from "./sidourService";
import {
  birkatHalevanaLastDay,
  birkatHalevanaWindow,
  computeZmanim,
  hebrewDateFor,
  hebrewDayOf,
  isIsraelPlace,
  isWalledCityPlace,
  moonAge,
  placeDayAfter,
  restPeriodAt,
  saysBirkatHalevana,
  slihotWindow,
  type ZmanKey,
  type ZmanimPlace,
} from "./zmanimService";
import type { FeastId } from "../content/sidourGroups";
import { orderTools, type SidourToolId } from "../content/sidourTools";

/**
 * Ce que la page du Sidour met en tête, à l'heure qu'il est : un seul texte,
 * celui du moment, en carte pleine couleur ; une ligne dessous au plus, et
 * seulement un soir d'occasion (l'office sous l'allumage de 'Hanouka, la
 * havdala sous Arvit) ; et la fête dont les textes remontent dans la liste.
 *
 * Tout se calcule sur l'appareil, au lieu des horaires, avec les mêmes règles
 * que le lecteur : les plages des offices de sidourService, les occasions de
 * dailyCycles (celles qui colorent ce que le jour ajoute dans le texte), les
 * Sli'hot de 'hatsot au lever du soleil, la bénédiction de la lune. Les
 * outils (la boussole, le miroir) suivent le même moment : celui dont c'est
 * l'heure passe devant.
 *
 * Tenu par src/__tests__/sidourMoment.test.ts.
 */

/** Ce que le jour ajoute à un office, en pastilles sous son nom. */
export type AdditionKey =
  | "yaaleVeyavo"
  | "alHanissim"
  | "hamelekh"
  | "hallel"
  | "moussaf"
  | "anenou"
  | "ataHonantanou"
  | "omer";

export interface SidourAddition {
  key: AdditionKey;
  /** Le jour du 'Omer compté ce soir. */
  n?: number;
}

/** Le jour que nomme la carte (« En ce moment · Roch 'Hodech »). */
export type DayKey =
  | "hanouka"
  | "pourim"
  | "holHamoed"
  | "roshHodech"
  | "taanit"
  | "teshuva"
  | "motsaeChabbat"
  | "eloul";

export interface SidourHero {
  /**
   * `tefila` : l'office dont c'est l'heure ; `next-tefila` : celui qui vient,
   * entre deux plages ; `hanouka` : l'allumage du soir ; `slihot` : les
   * Sli'hot, de 'hatsot au lever du soleil, en saison ; `halevana` : la
   * bénédiction de la lune, les nuits où elle se dit ; `feast` : entre deux
   * offices, le texte de la fête en cours (le loulav, l'allumage du soir, les
   * Sli'hot de la nuit qui vient).
   */
  kind: "tefila" | "next-tefila" | "hanouka" | "slihot" | "halevana" | "feast";
  /** Le texte qu'ouvre la carte, « corpus/slug » (voir sidourGroups). */
  text: string;
  tefila?: TefilaKey;
  start?: Date;
  end?: Date;
  day: DayKey | null;
  additions: SidourAddition[];
  /** Le soir de 'Hanouka, de 1 à 8. */
  night?: number;
  /** Vendredi de 'Hanouka : l'allumage se fait avant celui du Chabbat. */
  beforeShabbat?: Date;
  /** `feast` : la fête dont la carte porte le texte. */
  feast?: FeastId;
  /** Birkat halevana : le dernier jour où on la dit. */
  until?: HDate;
  /** Birkat halevana : l'âge de la lune, en jours depuis le molad (son dessin). */
  moonAge?: number;
}

/**
 * La ligne sous la carte, un soir d'occasion : l'office quand l'allumage, les
 * Sli'hot ou la lune ont pris la carte, ou la havdala quand un Chabbat ou une
 * fête sort.
 */
export interface SidourExtra {
  key: "tefila" | "havdala";
  text: string;
  tefila?: TefilaKey;
  /** L'office en cours (true) ou celui qui vient (false). */
  now?: boolean;
  start?: Date;
  end?: Date;
  additions?: SidourAddition[];
  /** Havdala: the civil day of its evening, which remembers it made. */
  evening?: Date;
}

/**
 * The blessing of the moon, on the nights it is said, from nightfall: the
 * card itself once Arvit is said, the line under the card until then, so that
 * it is not missed. Not by day: it is put forward only once it can be said.
 */
export interface SidourMoon {
  /** The last day it is said. */
  until: HDate;
  /** The moon's age, in days since the molad (its drawing). */
  moonAge: number;
}

/** What has already been said: the Sidour page and the home deck read it from Mon parcours. */
export interface SidourSaid {
  /** A service already said, for its window. */
  office?: (window: TefilaWindow) => boolean;
  /** The moon already blessed, for its last day. */
  moon?: (until: HDate) => boolean;
  /** Havdala already made, for the evening it is made (its civil day). */
  havdala?: (evening: Date) => boolean;
}

export interface SidourMoment {
  hero: SidourHero | null;
  /** Au plus une ligne sous la carte, et pas tous les jours. */
  extra: SidourExtra | null;
  /**
   * The moon, on its nights from nightfall, unless it is said already; also
   * when it holds the card (the home deck reads it from here, the Sidour page
   * then shows no line for it).
   */
  moon: SidourMoon | null;
  /** La fête dont les textes remontent en tête de la liste. */
  feast: FeastId | null;
  /** Les outils proposés, celui du moment devant (voir content/sidourTools). */
  tools: SidourToolId[];
}

/** Les textes que la page met en avant, par leur clé « corpus/slug ». */
export const MOMENT_TEXTS = {
  chaharit: "sidour/chaharit",
  minha: "sidour/minha",
  arvit: "sidour/arvit",
  havdala: "sidour/havdala",
  halevana: "brahot/birkat-halevana",
  hanouka: "moadim/nerot-hanouka",
  loulav: "moadim/netilat-loulav",
  slihot: "moadim/slihot",
} as const;

/**
 * Le miroir passe devant une heure avant que s'ouvre Cha'harit : les
 * téfilines se posent avant l'office, et dès misheyakir.
 */
const MIRROR_LEAD_MS = 60 * 60 * 1000;

// ---- Le jour ---------------------------------------------------------------

/** Le soir de 'Hanouka (1 à 8) d'un jour hébraïque, null hors de la fête. */
export function hanoukaNight(hd: HDate): number | null {
  const first = new HDate(25, months.KISLEV, hd.getFullYear());
  const n = hd.abs() - first.abs() + 1;
  return n >= 1 && n <= 8 ? n : null;
}

/**
 * La fête dont les textes remontent en tête de la liste, au jour hébraïque
 * (bascule à la chkia) : les Sli'hot et l'Atarat nedarim depuis Roch 'Hodech
 * Eloul (l'usage séfarade, celui de l'app) jusqu'à Kippour, les textes de
 * Souccot du lendemain de Kippour à Sim'hat Torah (le 23 Tichri en diaspora,
 * le 22 en Terre d'Israël), 'Hanouka ses huit jours.
 */
export function currentFeast(hd: HDate, il = false): FeastId | null {
  const month = hd.getMonth();
  const day = hd.getDate();
  if (month === months.ELUL) return "tichri";
  if (month === months.TISHREI && day <= 10) return "tichri";
  if (month === months.TISHREI && day <= (il ? 22 : 23)) return "souccot";
  if (hanoukaNight(hd) !== null) return "hanouka";
  return null;
}

/**
 * Les matins des Sli'hot, au jour hébraïque du matin où la nuit s'achève :
 * tout Eloul, puis les jours de techouva hors Roch Hachana. Pas le Chabbat :
 * l'app ne les propose pas ce matin-là.
 */
export function isSlihotMorning(hd: HDate): boolean {
  if (hd.getDay() === 6) return false;
  if (hd.getMonth() === months.ELUL) return true;
  return hd.getMonth() === months.TISHREI && hd.getDate() >= 3 && hd.getDate() <= 9;
}

/** Ce que le jour ajoute à un office, d'après les occasions de son jour. */
export function tefilaAdditions(
  tefila: TefilaKey,
  occasions: Set<string>,
  hd: HDate,
): SidourAddition[] {
  const list: SidourAddition[] = [];
  const add = (key: AdditionKey) => list.push({ key });
  if (tefila === "arvit") {
    const saturdayNight = occasions.has("jour-0") && !occasions.has("yom-tov");
    if (saturdayNight || occasions.has("motsae-yom-tov")) add("ataHonantanou");
  }
  if (occasions.has("moed") && !occasions.has("yom-tov")) add("yaaleVeyavo");
  if (occasions.has("nissim")) add("alHanissim");
  if (occasions.has("teshuva")) add("hamelekh");
  if (tefila !== "arvit" && occasions.has("taanit")) add("anenou");
  if (tefila === "chaharit" && occasions.has("hallel")) add("hallel");
  if (tefila === "chaharit" && occasions.has("moussaf")) add("moussaf");
  if (tefila === "arvit") {
    const n = omerDay(hd);
    if (n !== null) list.push({ key: "omer", n });
  }
  return list;
}

/** Le jour que nomme la carte d'un office, le plus parlant d'abord. */
export function dayOf(tefila: TefilaKey, occasions: Set<string>): DayKey | null {
  if (occasions.has("hanouka")) return "hanouka";
  if (occasions.has("pourim")) return "pourim";
  if (occasions.has("hol-hamoed")) return "holHamoed";
  if (occasions.has("rosh-chodesh")) return "roshHodech";
  if (occasions.has("taanit")) return "taanit";
  if (occasions.has("teshuva")) return "teshuva";
  if (tefila === "arvit" && occasions.has("jour-0") && !occasions.has("yom-tov"))
    return "motsaeChabbat";
  return null;
}

// ---- Le moment -------------------------------------------------------------

function occasionsOf(place: ZmanimPlace, hd: HDate): Set<string> {
  return activeOccasions(hd, isIsraelPlace(place), isWalledCityPlace(place));
}

/** Un office, avec le jour qu'il porte : celui où sa plage s'ouvre. */
function officeOf(place: ZmanimPlace, window: TefilaWindow) {
  const hd = tefilaHebrewDay(place, window.tefila, window.start);
  const occasions = occasionsOf(place, hd);
  return {
    tefila: window.tefila,
    start: window.start,
    end: window.end,
    day: dayOf(window.tefila, occasions),
    additions: tefilaAdditions(window.tefila, occasions, hd),
  };
}

type ZmanMap = Map<ZmanKey, Date>;

function zmanMap(place: ZmanimPlace, day: Date): ZmanMap {
  return new Map(computeZmanim(place, day).map((z) => [z.key, z.date]));
}

/**
 * Le soir dont la nuit est en cours : celui du jour, ou celui de la veille
 * entre minuit et 'hatsot de la nuit, quand 'hatsot tombe après minuit. Un
 * soir d'occasion (l'allumage, la havdala) court jusqu'à 'hatsot : passé
 * minuit, les horaires du jour civil sont déjà ceux du lendemain, et il
 * s'effaçait à minuit.
 */
function eveningOf(place: ZmanimPlace, now: Date, times: ZmanMap): { day: Date; times: ZmanMap } {
  const dawnMidnight = times.get("chatzotNightDawn");
  if (!dawnMidnight || now.getTime() >= dawnMidnight.getTime()) return { day: now, times };
  const day = placeDayAfter(place, now, -1);
  return { day, times: zmanMap(place, day) };
}

/**
 * L'allumage de 'Hanouka, s'il est l'heure : le soir, de la chkia (de la
 * sortie du Chabbat le samedi) à 'hatsot ; le vendredi, de plag hamin'ha à la
 * chkia, avant l'allumage du Chabbat.
 */
function hanoukaEvening(
  place: ZmanimPlace,
  now: Date,
  evening: { day: Date; times: ZmanMap },
): { night: number; beforeShabbat?: Date } | null {
  const { times } = evening;
  const sunset = times.get("sunset");
  const plag = times.get("plagHaMincha");
  const midnight = times.get("chatzotNight");
  const today = hebrewDayOf(place, evening.day);
  const t = now.getTime();

  if (today.getDay() === 5) {
    if (!plag || !sunset || t < plag.getTime() || t >= sunset.getTime()) return null;
    const night = hanoukaNight(today.next());
    if (night === null) return null;
    return { night, beforeShabbat: restPeriodAt(place, today.next(), "fr")?.start ?? sunset };
  }
  if (!sunset || t < sunset.getTime() || (midnight && t >= midnight.getTime())) return null;
  const night = hanoukaNight(today.next());
  if (night === null) return null;
  if (today.getDay() === 6) {
    const end = restPeriodAt(place, today, "fr")?.end;
    if (end && t < end.getTime()) return null;
  }
  return { night };
}

/**
 * La havdala, le soir où finit un Chabbat ou un Yom Tov (le dernier jour d'un
 * bloc de repos), de la chkia à 'hatsot ; avec l'heure de la sortie.
 *
 * Quand Tich'a beAv, reporté, commence à la sortie du Chabbat, on ne dit ce
 * soir-là que la bénédiction du feu : la havdala attend la sortie du jeûne,
 * le dimanche soir.
 */
function havdalaEvening(
  place: ZmanimPlace,
  now: Date,
  evening: { day: Date; times: ZmanMap },
): SidourExtra | null {
  const { times } = evening;
  const sunset = times.get("sunset");
  const midnight = times.get("chatzotNight");
  const t = now.getTime();
  if (!sunset || t < sunset.getTime() || (midnight && t >= midnight.getTime())) return null;
  const today = hebrewDayOf(place, evening.day);
  if (occasionsOf(place, today.next()).has("tisha-beav")) return null;
  const rest = restPeriodAt(place, today, "fr");
  if (rest && rest.last.abs() === today.abs()) {
    return {
      key: "havdala",
      text: MOMENT_TEXTS.havdala,
      start: rest.end ?? undefined,
      evening: evening.day,
    };
  }
  if (today.getDay() === 0 && occasionsOf(place, today).has("tisha-beav")) {
    return {
      key: "havdala",
      text: MOMENT_TEXTS.havdala,
      start: times.get("tzeit"),
      evening: evening.day,
    };
  }
  return null;
}

/** Le moment du Sidour, au lieu des horaires et à l'heure qu'il est. */
/**
 * Les outils de la rangée, dans l'ordre du moment.
 *
 * - Les six côtés du na'anou'a sont de saison : de l'entrée de Souccot à la
 *   fin de Hochana Rabba. Ils passent devant le jour, quand on prend le
 *   loulav (pas le Chabbat, où on ne le prend pas).
 * - Le miroir passe devant le matin d'un jour où l'on met les téfilines :
 *   Cha'harit en cours, ou qui s'ouvre dans l'heure. Pas le Chabbat ni un Yom
 *   Tov, pas à 'Hol hamoed (les Séfarades, et toute la Terre d'Israël, ne les
 *   y mettent pas), pas le 9 Av, où on les met à Min'ha.
 * - La boussole du Kotel sert à chaque 'Amida : elle n'a pas de moment, et
 *   tient la tête le reste du temps.
 */
function momentTools(
  place: ZmanimPlace,
  now: Date,
  office: { tefila: TefilaKey; start: Date; current: boolean } | null,
  day: boolean,
): SidourToolId[] {
  const first: SidourToolId[] = [];
  const inSeason = new Set<SidourToolId>();

  // La saison suit le jour hébraïque : elle s'ouvre à la chkia du 14 Tichri
  // et se ferme à celle de Hochana Rabba, pas à minuit.
  const today = hebrewDayOf(place, now);
  const eveningOccasions = occasionsOf(place, hebrewDateFor(place, now, now));
  if (eveningOccasions.has("sukkot")) inSeason.add("naanouim");
  if (day && occasionsOf(place, today).has("sukkot") && today.getDay() !== 6) {
    first.push("naanouim");
  }

  if (office?.tefila === "chaharit") {
    const soon = office.current || office.start.getTime() - now.getTime() <= MIRROR_LEAD_MS;
    const occasions = occasionsOf(place, tefilaHebrewDay(place, "chaharit", office.start));
    const withoutTefilin = ["shabbat", "yom-tov", "hol-hamoed", "tisha-beav"].some((key) =>
      occasions.has(key),
    );
    if (soon && !withoutTefilin) first.push("tefilin");
  }

  return orderTools(first, inSeason);
}

/**
 * The moment, in order of priority. The card takes the first one that holds:
 *
 * 1. the 'Hanouka lighting, in the evening;
 * 2. the Sli'hot, from 'hatsot until sunrise, in season;
 * 3. the service whose time it is;
 * 4. the blessing of the moon, on the nights it is said, once Arvit is said
 *    (or its time is over): it is said after Arvit;
 * 5. between two services, the text of the current holiday, if one is said
 *    now or tonight;
 * 6. the service coming up.
 *
 * One line below, at most, and only under an occasion: havdala on the
 * evening a Chabbat or a holiday ends, otherwise the service under the first
 * three. The rest (the bedtime Chema, the loulav, the Hochanot) is in the
 * list, just below, and the current holiday moves up to its top: repeating
 * it above made three cards for one.
 *
 * The moon, which comes back about ten nights a month and gets missed for
 * lack of a reminder, also has its line of its own (`moon`) on its nights,
 * from nightfall, as long as it is not said and does not hold the card.
 *
 * A service already said (`said.office`: checked off in Mon parcours, or its
 * card swiped) gives way: the card goes to what comes next (the moon at
 * night, the holiday, then the next service not yet said), and it is no
 * longer the line under an occasion. A moon already blessed
 * (`said.moon`) is neither card nor line, nor is a havdala already made
 * (`said.havdala`).
 */
export function sidourMoment(
  place: ZmanimPlace,
  now: Date = new Date(),
  said: SidourSaid = {},
): SidourMoment {
  const isDone = said.office ?? (() => false);
  const t = now.getTime();
  const times = zmanMap(place, now);
  const evening = hebrewDateFor(place, now, now);
  const today = hebrewDayOf(place, now);
  const currentEvening = eveningOf(place, now, times);
  // Le vendredi 24 Kislev, de plag à la chkia, l'allumage tient la carte
  // alors que 'Hanouka ne commence qu'au soir : ses textes remontent déjà.
  const hanouka = hanoukaEvening(place, now, currentEvening);
  const feast = currentFeast(evening, isIsraelPlace(place)) ?? (hanouka ? "hanouka" : null);
  let hero: SidourHero | null = null;

  const sunrise = times.get("sunrise");
  const sunset = times.get("sunset");
  const tzeit = times.get("tzeit");
  const misheyakir = times.get("misheyakir");
  const night = (!!tzeit && t >= tzeit.getTime()) || (!!misheyakir && t < misheyakir.getTime());
  const day = !!sunrise && !!sunset && t >= sunrise.getTime() && t < sunset.getTime();

  // 1. 'Hanouka : l'allumage passe devant l'office du soir.
  if (hanouka) {
    hero = {
      kind: "hanouka",
      text: MOMENT_TEXTS.hanouka,
      day: "hanouka",
      additions: [],
      night: hanouka.night,
      beforeShabbat: hanouka.beforeShabbat,
    };
  }

  // 2. Les Sli'hot, de 'hatsot au lever du soleil, les matins de la saison.
  const slihot = slihotWindow(place, now);
  const slihotSeason = !!slihot && isSlihotMorning(hebrewDayOf(place, slihot.end));
  if (!hero && slihot && slihotSeason && slihot.tonight && t >= slihot.start.getTime()) {
    const morning = hebrewDayOf(place, slihot.end);
    hero = {
      kind: "slihot",
      text: MOMENT_TEXTS.slihot,
      start: slihot.start,
      end: slihot.end,
      day: morning.getMonth() === months.ELUL ? "eloul" : "teshuva",
      additions: [],
    };
  }

  // The current service; the one coming up. A service already said is
  // neither: the next one not yet said takes its place.
  const current = currentTefilaWindow(place, now);
  const currentDone = !!current && isDone(current);
  const live = currentDone ? null : current;
  const window = live ?? nextOpenWindow(place, now, isDone);
  const office = window ? officeOf(place, window) : null;

  // The moon, on its nights: until the instant the period closes (the last
  // night, often before dawn).
  const moon = moonOf(place, now, evening, night, said.moon);

  // 3. The service whose time it is (at night, Arvit), when no occasion holds
  // the card; 4. the moon, once Arvit is said or its time is over.
  if (!hero && moon && !live) {
    hero = {
      kind: "halevana",
      text: MOMENT_TEXTS.halevana,
      day: null,
      additions: [],
      until: moon.until,
      moonAge: moon.moonAge,
    };
  }
  const occasion = hero !== null;
  if (!hero && office && live) {
    hero = { kind: "tefila", text: MOMENT_TEXTS[office.tefila], ...office };
  }

  // 5. Entre deux offices, la fête.
  if (!hero && feast) {
    hero = feastHero(place, now, feast, today, day, times.get("sunset"), slihot, slihotSeason);
  }

  if (!hero && office) {
    hero = { kind: "next-tefila", text: MOMENT_TEXTS[office.tefila], ...office };
  }

  // La ligne dessous : la havdala d'abord, sinon l'office sous une occasion.
  let extra: SidourExtra | null = havdalaEvening(place, now, currentEvening);
  // Havdala already made leaves the line to the service, if any.
  if (extra?.evening && said.havdala?.(extra.evening)) extra = null;
  if (!extra && occasion && office && !currentDone) {
    extra = {
      key: "tefila",
      text: MOMENT_TEXTS[office.tefila],
      tefila: office.tefila,
      now: !!live,
      start: office.start,
      end: office.end,
      additions: live ? office.additions : [],
    };
  }
  // Pas de havdala sous une carte qui n'est ni l'office du soir ni une
  // occasion (la havdala elle-même n'est pas une carte).
  // Arvit already said keeps it: havdala comes after it.
  if (extra?.key === "havdala" && hero?.kind !== "tefila" && !occasion && !currentDone) {
    extra = null;
  }

  return {
    hero,
    extra,
    moon,
    feast,
    tools: momentTools(
      place,
      now,
      office ? { tefila: office.tefila, start: office.start, current: !!live } : null,
      day,
    ),
  };
}

/**
 * The moon, if it can be said now: at night, from nightfall, on the nights
 * of its period, until the instant the period closes.
 */
function moonOf(
  place: ZmanimPlace,
  now: Date,
  evening: HDate,
  night: boolean,
  blessed: ((until: HDate) => boolean) | undefined,
): SidourMoon | null {
  if (!night || !saysBirkatHalevana(place, evening)) return null;
  if (now.getTime() > birkatHalevanaWindow(evening).end.getTime()) return null;
  const until = birkatHalevanaLastDay(place, evening);
  if (blessed?.(until)) return null;
  return { until, moonAge: moonAge(evening, now) };
}

/**
 * The next service whose window has not opened yet and that is not already
 * said (Min'ha checked off in the morning, from the wallet), within the three
 * that follow.
 */
function nextOpenWindow(
  place: ZmanimPlace,
  now: Date,
  isDone: (window: TefilaWindow) => boolean,
): TefilaWindow | null {
  let from = now;
  for (let i = 0; i < 3; i++) {
    const next = nextTefilaWindow(place, from);
    if (!next || !isDone(next)) return next;
    from = next.start;
  }
  return null;
}

/**
 * La fête en carte, entre deux offices : le loulav le jour où on le prend,
 * l'allumage de 'Hanouka du soir qui vient, les Sli'hot de la nuit qui vient.
 * Rien pour une fête qui n'a pas de texte à dire maintenant : l'office qui
 * vient garde alors la carte.
 */
function feastHero(
  place: ZmanimPlace,
  now: Date,
  feast: FeastId,
  today: HDate,
  day: boolean,
  sunset: Date | undefined,
  slihot: ReturnType<typeof slihotWindow>,
  slihotSeason: boolean,
): SidourHero | null {
  if (feast === "souccot") {
    // Le loulav se prend chaque jour de Souccot, Yom Tov compris, sauf le
    // Chabbat : la même règle que la rangée des outils. (L'occasion `loulav`
    // écarte le Yom Tov pour le texte de Cha'harit, pas pour la carte.)
    if (!day || !occasionsOf(place, today).has("sukkot") || today.getDay() === 6) return null;
    return {
      kind: "feast",
      feast,
      text: MOMENT_TEXTS.loulav,
      day: null,
      additions: [],
      end: sunset,
    };
  }
  if (feast === "hanouka") {
    // Passé la chkia, l'allumage du soir a sa carte jusqu'à 'hatsot, ou
    // c'est le Chabbat qui est entré : « ce soir » serait déjà passé.
    if (sunset && now.getTime() >= sunset.getTime()) return null;
    const night = hanoukaNight(today.next());
    if (night === null) return null;
    return { kind: "feast", feast, text: MOMENT_TEXTS.hanouka, day: null, additions: [], night };
  }
  if (!slihot || !slihotSeason) return null;
  return {
    kind: "feast",
    feast,
    text: MOMENT_TEXTS.slihot,
    day: null,
    additions: [],
    start: slihot.start,
    end: slihot.end,
  };
}
