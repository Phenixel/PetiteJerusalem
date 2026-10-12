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
  computeZmanim,
  hebrewDateFor,
  hebrewDayOf,
  isIsraelPlace,
  isWalledCityPlace,
  restPeriodAt,
  saysBirkatHalevana,
  slihotWindow,
  type ZmanKey,
  type ZmanimPlace,
} from "./zmanimService";
import type { FeastId } from "../content/sidourGroups";
import { orderTools, type SidourToolId } from "../content/sidourTools";

/**
 * Ce que la page du Sidour met en tête, à l'heure qu'il est : le texte du
 * moment en carte pleine couleur, puis deux ou trois textes qui se disent
 * aussi maintenant, et la fête dont les textes remontent dans la liste.
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
   * Sli'hot, de 'hatsot au lever du soleil, en saison.
   */
  kind: "tefila" | "next-tefila" | "hanouka" | "slihot";
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
}

/** Un texte qui se dit aussi maintenant, sous la carte du moment. */
export interface SidourExtra {
  key: "tefila" | "havdala" | "halevana" | "loulav" | "hochanot" | "slihot" | "chema" | "tikoun";
  text: string;
  tefila?: TefilaKey;
  /** L'office en cours (true) ou celui qui vient (false). */
  now?: boolean;
  start?: Date;
  end?: Date;
  /** Birkat halevana : le dernier jour où on la dit. */
  until?: HDate;
  additions?: SidourAddition[];
}

export interface SidourMoment {
  hero: SidourHero | null;
  extras: SidourExtra[];
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
  chema: "sidour/chema-al-hamita",
  tikoun: "sidour/tikoun-hatsot",
  havdala: "sidour/havdala",
  halevana: "brahot/birkat-halevana",
  hanouka: "moadim/nerot-hanouka",
  loulav: "moadim/netilat-loulav",
  hochanot: "moadim/hochanot",
  slihot: "moadim/slihot",
} as const;

/** Au plus trois textes sous la carte : au-delà, ce n'est plus un rappel. */
const MAX_EXTRAS = 3;

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
 * Souccot du lendemain de Kippour à Sim'hat Torah, 'Hanouka ses huit jours.
 */
export function currentFeast(hd: HDate): FeastId | null {
  const month = hd.getMonth();
  const day = hd.getDate();
  if (month === months.ELUL) return "tichri";
  if (month === months.TISHREI && day <= 10) return "tichri";
  if (month === months.TISHREI && day <= 23) return "souccot";
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

/**
 * L'allumage de 'Hanouka, s'il est l'heure : le soir, de la chkia (de la
 * sortie du Chabbat le samedi) à 'hatsot ; le vendredi, de plag hamin'ha à la
 * chkia, avant l'allumage du Chabbat.
 */
function hanoukaEvening(
  place: ZmanimPlace,
  now: Date,
  times: Map<ZmanKey, Date>,
): { night: number; beforeShabbat?: Date } | null {
  const sunset = times.get("sunset");
  const plag = times.get("plagHaMincha");
  const midnight = times.get("chatzotNight");
  const today = hebrewDayOf(place, now);
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
 */
function havdalaEvening(
  place: ZmanimPlace,
  now: Date,
  times: Map<ZmanKey, Date>,
): SidourExtra | null {
  const sunset = times.get("sunset");
  const midnight = times.get("chatzotNight");
  const t = now.getTime();
  if (!sunset || t < sunset.getTime() || (midnight && t >= midnight.getTime())) return null;
  const today = hebrewDayOf(place, now);
  const rest = restPeriodAt(place, today, "fr");
  if (!rest || rest.last.abs() !== today.abs()) return null;
  return { key: "havdala", text: MOMENT_TEXTS.havdala, start: rest.end ?? undefined };
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
  hero: SidourHero | null,
  day: boolean,
): SidourToolId[] {
  const first: SidourToolId[] = [];
  const inSeason = new Set<SidourToolId>();

  const today = hebrewDayOf(place, now);
  const todayOccasions = occasionsOf(place, today);
  const eveningOccasions = occasionsOf(place, hebrewDateFor(place, now, now));
  if (todayOccasions.has("sukkot") || eveningOccasions.has("sukkot")) inSeason.add("naanouim");
  if (day && todayOccasions.has("sukkot") && today.getDay() !== 6) first.push("naanouim");

  if (hero?.tefila === "chaharit" && hero.start) {
    const soon = hero.kind === "tefila" || hero.start.getTime() - now.getTime() <= MIRROR_LEAD_MS;
    const occasions = occasionsOf(place, tefilaHebrewDay(place, "chaharit", hero.start));
    const withoutTefilin = ["shabbat", "yom-tov", "hol-hamoed", "tisha-beav"].some((key) =>
      occasions.has(key),
    );
    if (soon && !withoutTefilin) first.push("tefilin");
  }

  return orderTools(first, inSeason);
}

export function sidourMoment(place: ZmanimPlace, now: Date = new Date()): SidourMoment {
  const t = now.getTime();
  const times = new Map(computeZmanim(place, now).map((z) => [z.key, z.date]));
  const evening = hebrewDateFor(place, now, now);
  const extras: SidourExtra[] = [];
  let hero: SidourHero | null = null;

  // 'Hanouka : l'allumage passe devant l'office du soir.
  const hanouka = hanoukaEvening(place, now, times);
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

  // Les Sli'hot, de 'hatsot au lever du soleil, les matins de la saison.
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

  // L'office en cours, ou celui qui vient.
  const current = currentTefilaWindow(place, now);
  const window = current ?? nextTefilaWindow(place, now);
  if (window) {
    const office = officeOf(place, window);
    if (!hero) {
      hero = {
        kind: current ? "tefila" : "next-tefila",
        text: MOMENT_TEXTS[office.tefila],
        ...office,
      };
    } else {
      extras.push({
        key: "tefila",
        text: MOMENT_TEXTS[office.tefila],
        tefila: office.tefila,
        now: !!current,
        start: office.start,
        end: office.end,
        additions: current ? office.additions : [],
      });
    }
  }

  const sunrise = times.get("sunrise");
  const sunset = times.get("sunset");
  const tzeit = times.get("tzeit");
  const misheyakir = times.get("misheyakir");
  const chatzot = times.get("chatzot");
  const night = (!!tzeit && t >= tzeit.getTime()) || (!!misheyakir && t < misheyakir.getTime());
  const day = !!sunrise && !!sunset && t >= sunrise.getTime() && t < sunset.getTime();

  const havdala = havdalaEvening(place, now, times);
  if (havdala) extras.push(havdala);

  if (night && saysBirkatHalevana(place, evening)) {
    extras.push({
      key: "halevana",
      text: MOMENT_TEXTS.halevana,
      until: birkatHalevanaLastDay(place, evening),
    });
  }

  // Souccot : le loulav le jour, les Hochanot le matin, après le Hallel.
  if (day) {
    const occasions = occasionsOf(place, hebrewDayOf(place, now));
    if (occasions.has("loulav")) extras.push({ key: "loulav", text: MOMENT_TEXTS.loulav });
    const morning = !!chatzot && t < chatzot.getTime();
    if (morning && occasions.has("sukkot") && !occasions.has("shemini-atzeret"))
      extras.push({ key: "hochanot", text: MOMENT_TEXTS.hochanot });
  }

  // Les Sli'hot de la nuit qui vient, annoncées dès la chkia.
  const afterSunset = !!sunset && t >= sunset.getTime();
  if (hero?.kind !== "slihot" && slihot && slihotSeason && afterSunset) {
    extras.push({ key: "slihot", text: MOMENT_TEXTS.slihot, start: slihot.start, end: slihot.end });
  }

  // La nuit : le Chema du coucher, et le tikoun 'hatsot (pas les nuits de
  // Chabbat ni de fête, où il ne se dit pas).
  if (night) {
    extras.push({ key: "chema", text: MOMENT_TEXTS.chema });
    const nightOccasions = occasionsOf(place, evening);
    const restNight = nightOccasions.has("shabbat") || nightOccasions.has("yom-tov");
    if (!restNight && slihot) {
      extras.push({
        key: "tikoun",
        text: MOMENT_TEXTS.tikoun,
        start: slihot.start,
        end: slihot.end,
      });
    }
  }

  return {
    hero,
    extras: extras.slice(0, MAX_EXTRAS),
    feast: currentFeast(evening),
    tools: momentTools(place, now, hero, day),
  };
}
