import { GeoLocation, HDate, Zmanim } from "@hebcal/core";

/**
 * Horaires de la journée (zmanim), calculés en local.
 *
 * Aucune API, aucun réseau : `@hebcal/core` — déjà présent pour la paracha de
 * la semaine (voir dailyCycles) — embarque le moteur solaire NOAA. Les heures
 * se calculent donc sans réseau, pour n'importe quelle date et n'importe quel
 * point du globe : une fois la page chargée, elle n'a plus besoin de rien —
 * et dans l'app native, dont les fichiers sont embarqués, elle s'ouvre aussi
 * connexion coupée.
 *
 * Position et fuseau sont deux champs distincts : la position vient de
 * l'appareil (ou du repli parisien), le fuseau du navigateur.
 */

/** Lieu de calcul des horaires. */
export interface ZmanimPlace {
  /** Repli parisien, ville choisie dans la liste, ou position de l'appareil. */
  source: "default" | "city" | "device";
  latitude: number;
  longitude: number;
  /** Fuseau IANA ("Europe/Paris") : les heures sont affichées dedans. */
  tzid: string;
  /** Nom affichable — connu sauf pour une position brute de l'appareil. */
  city: string | null;
}

/** Une ville de la liste (voir src/datas/cities.json, scripts/generate-cities.mjs). */
export interface City {
  name: string;
  /** Code ISO 3166 alpha-2, affiché pour distinguer les homonymes. */
  country: string;
  lat: number;
  lon: number;
  tz: string;
}

/** La ville choisie devient le lieu de calcul. */
export function placeFromCity(city: City): ZmanimPlace {
  return {
    source: "city",
    latitude: city.lat,
    longitude: city.lon,
    tzid: city.tz,
    city: city.name,
  };
}

/**
 * Paris : le repli tant que l'utilisateur n'a pas partagé sa position (le
 * public de l'application est en France, comme le calendrier diaspora déjà
 * retenu pour la paracha). Coordonnées de la base de villes hebcal.
 */
export const DEFAULT_PLACE: ZmanimPlace = {
  source: "default",
  latitude: 48.85341,
  longitude: 2.3488,
  tzid: "Europe/Paris",
  city: "Paris",
};

/** Moments de la journée, dans l'ordre : sert à grouper l'affichage. */
export type ZmanPeriod = "dawn" | "morning" | "afternoon" | "evening";

export const ZMAN_PERIODS: ZmanPeriod[] = ["dawn", "morning", "afternoon", "evening"];

/**
 * Les horaires retenus, dans l'ordre chronologique.
 *
 * Deux opinions sont données là où la pratique les distingue vraiment (fin du
 * Chéma et de la Amida) : le Maguen Avraham compte le jour de l'aube à la
 * sortie des étoiles, le Gaon de Vilna du lever au coucher du soleil — l'écart
 * atteint facilement une demi-heure.
 */
const ZMAN_DEFS = [
  { key: "alotHaShachar", period: "dawn", at: (z: Zmanim) => z.alotHaShachar() },
  { key: "misheyakir", period: "dawn", at: (z: Zmanim) => z.misheyakir() },
  { key: "sunrise", period: "dawn", at: (z: Zmanim) => z.sunrise() },
  { key: "sofZmanShmaMGA", period: "morning", at: (z: Zmanim) => z.sofZmanShmaMGA() },
  { key: "sofZmanShma", period: "morning", at: (z: Zmanim) => z.sofZmanShma() },
  { key: "sofZmanTfillaMGA", period: "morning", at: (z: Zmanim) => z.sofZmanTfillaMGA() },
  { key: "sofZmanTfilla", period: "morning", at: (z: Zmanim) => z.sofZmanTfilla() },
  { key: "chatzot", period: "afternoon", at: (z: Zmanim) => z.chatzot() },
  { key: "minchaGedola", period: "afternoon", at: (z: Zmanim) => z.minchaGedola() },
  { key: "minchaKetana", period: "afternoon", at: (z: Zmanim) => z.minchaKetana() },
  { key: "plagHaMincha", period: "afternoon", at: (z: Zmanim) => z.plagHaMincha() },
  { key: "sunset", period: "evening", at: (z: Zmanim) => z.sunset() },
  { key: "tzeit", period: "evening", at: (z: Zmanim) => z.tzeit() },
  // Milieu de la nuit qui suit : `chatzotNight` d'un jour donné est celui de
  // la nuit qui l'a précédé, pas celui de sa propre nuit.
  { key: "chatzotNight", period: "evening", at: (_z: Zmanim, next: Zmanim) => next.chatzotNight() },
] as const satisfies readonly {
  key: string;
  period: ZmanPeriod;
  at: (z: Zmanim, next: Zmanim) => Date;
}[];

export type ZmanKey = (typeof ZMAN_DEFS)[number]["key"];

export interface ZmanTime {
  key: ZmanKey;
  period: ZmanPeriod;
  date: Date;
}

/** Minutes avant le coucher du soleil pour l'allumage des bougies (usage diaspora). */
const CANDLE_LIGHTING_MINUTES = 18;

function geoLocationOf(place: ZmanimPlace): GeoLocation {
  return new GeoLocation(
    place.city ?? "",
    place.latitude,
    place.longitude,
    0, // altitude : les zmanim sont calculés au niveau de la mer
    place.tzid,
  );
}

/**
 * Le jour civil du lieu, ramené dans le repère local de la machine.
 *
 * hebcal lit l'année, le mois et le jour d'une `Date` dans le fuseau du
 * navigateur. Sans cette conversion, un appareil réglé loin du lieu affiché
 * calcule le mauvais jour : à 9 h à Auckland il est encore la veille à Paris,
 * et la page servirait les horaires du lendemain. On repasse donc par la date
 * telle qu'elle est vécue **au lieu**, à midi pour ne jamais frôler un
 * changement de jour.
 */
function dayInPlace(place: ZmanimPlace, date: Date): Date {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: place.tzid,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .split("-")
    .map(Number);
  return new Date(year, month - 1, day, 12);
}

/** Une date renvoyée par hebcal peut être invalide aux latitudes extrêmes. */
function isUsable(date: Date): boolean {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

/** Les horaires d'un jour civil, dans l'ordre chronologique. */
export function computeZmanim(place: ZmanimPlace, day: Date = new Date()): ZmanTime[] {
  const gloc = geoLocationOf(place);
  const localDay = dayInPlace(place, day);
  const zmanim = new Zmanim(gloc, localDay, false);
  const nextDay = new Date(localDay);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextZmanim = new Zmanim(gloc, nextDay, false);

  const times: ZmanTime[] = [];
  for (const def of ZMAN_DEFS) {
    const date = def.at(zmanim, nextZmanim);
    // Nuit ou jour polaire : l'horaire n'existe pas, on ne l'affiche pas.
    if (isUsable(date)) times.push({ key: def.key, period: def.period, date });
  }
  return times;
}

/** Le prochain horaire à venir, pour mettre en avant « ce qui arrive ». */
export function nextZman(times: ZmanTime[], now: Date = new Date()): ZmanTime | null {
  return times.find((zman) => zman.date.getTime() > now.getTime()) ?? null;
}

export interface ShabbatTimes {
  /** Vendredi, 18 minutes avant le coucher du soleil. */
  candleLighting: Date;
  /** Samedi, à la sortie des étoiles. */
  havdalah: Date;
}

/**
 * L'entrée et la sortie du Chabbat en cours, ou du prochain.
 *
 * Le samedi soir avant la sortie des étoiles, on est encore dans le Chabbat en
 * cours : c'est sa sortie qui intéresse, pas l'allumage de la semaine
 * suivante. Les fêtes ne sont pas couvertes ici — leurs allumages suivent le
 * calendrier des chagim, pas la semaine civile.
 */
export function getShabbatTimes(place: ZmanimPlace, now: Date = new Date()): ShabbatTimes | null {
  const gloc = geoLocationOf(place);

  const times = (weeksAhead: number): ShabbatTimes | null => {
    const saturday = dayInPlace(place, now);
    // 6 = samedi : on recule sur le samedi de la semaine en cours.
    saturday.setDate(saturday.getDate() - saturday.getDay() + 6 + weeksAhead * 7);
    const friday = new Date(saturday);
    friday.setDate(friday.getDate() - 1);

    const candleLighting = new Zmanim(gloc, friday, false).sunsetOffset(
      -CANDLE_LIGHTING_MINUTES,
      true,
    );
    const havdalah = new Zmanim(gloc, saturday, false).tzeit();
    return isUsable(candleLighting) && isUsable(havdalah) ? { candleLighting, havdalah } : null;
  };

  const current = times(0);
  if (current && current.havdalah.getTime() > now.getTime()) return current;
  return times(1);
}

/**
 * La date hébraïque du jour affiché.
 *
 * Le jour hébraïque commence au coucher du soleil : pour aujourd'hui, on tient
 * compte de l'heure qu'il est (après la chkia, on est déjà demain). Pour un
 * autre jour, seule la date civile compte.
 */
export function hebrewDateFor(place: ZmanimPlace, day: Date, now: Date = new Date()): HDate {
  const localDay = dayInPlace(place, day);
  const hd = new HDate(localDay);
  if (localDay.getTime() !== dayInPlace(place, now).getTime()) return hd;

  // Aujourd'hui : après la chkia, le jour hébraïque a déjà changé. Le calcul
  // est fait ici plutôt qu'avec `Zmanim.makeSunsetAwareHDate`, qui déduit le
  // jour de base du fuseau du navigateur et se trompe d'un jour dès que
  // l'appareil est réglé loin du lieu affiché.
  const sunset = new Zmanim(geoLocationOf(place), localDay, false).sunset();
  return isUsable(sunset) && now.getTime() >= sunset.getTime() ? hd.next() : hd;
}

/**
 * Noms des mois hébraïques en français : hebcal ne les rend qu'en anglais ou
 * en hébreu, et les graphies anglaises ("Cheshvan", "Sh'vat") ne sont pas
 * celles que lit le public francophone de l'application.
 */
const FRENCH_MONTHS: Record<string, string> = {
  Nisan: "Nissan",
  Iyyar: "Iyar",
  Sivan: "Sivan",
  Tamuz: "Tamouz",
  Av: "Av",
  Elul: "Eloul",
  Tishrei: "Tichri",
  Cheshvan: "'Hechvan",
  Kislev: "Kislev",
  Tevet: "Tévet",
  "Sh'vat": "Chevat",
  Adar: "Adar",
  "Adar I": "Adar I",
  "Adar II": "Adar II",
};

/** "21 Av 5786" — en hébreu pointé pour la locale he, translittéré sinon. */
export function formatHebrewDate(hd: HDate, locale: string): string {
  if (locale === "he") return hd.renderGematriya();
  if (locale === "fr") {
    const month = hd.getMonthName();
    return `${hd.getDate()} ${FRENCH_MONTHS[month] ?? month} ${hd.getFullYear()}`;
  }
  return hd.render("en");
}

/**
 * Jour de la semaine au lieu affiché (0 = dimanche … 6 = samedi).
 *
 * Le fuseau de la machine ne fait pas foi : à 23 h à Paris, un appareil réglé
 * sur New York est encore la veille, et le vendredi — celui qui décide d'
 * afficher le Chabbat — se déclencherait au mauvais moment.
 */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayIn(place: ZmanimPlace, date: Date): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: place.tzid,
    weekday: "short",
  }).format(date);
  return WEEKDAYS.indexOf(short);
}

/** Vendredi : le jour où l'on regarde d'abord l'entrée du Chabbat. */
export function isErevShabbat(place: ZmanimPlace, date: Date): boolean {
  return weekdayIn(place, date) === 5;
}

/** "06:27" dans le fuseau du lieu — jamais celui du navigateur. */
export function formatZmanTime(date: Date, tzid: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tzid,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** "vendredi 7 août" — le jour d'un horaire, dans le fuseau du lieu. */
export function formatZmanDay(date: Date, tzid: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tzid,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}
