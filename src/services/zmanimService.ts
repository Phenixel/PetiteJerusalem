import {
  GeoLocation,
  HDate,
  HebrewCalendar,
  Locale,
  Zmanim,
  flags,
  months,
  getHolidaysOnDate,
  tachanun,
} from "@hebcal/core";
// Noms des fêtes en français : hebcal ne les rend qu'en anglais ou en hébreu
// sans ce catalogue (4 Ko), qui s'enregistre auprès de hebcal à l'import.
import "@hebcal/locales/fr";

/**
 * Horaires de la journée (zmanim), calculés en local.
 *
 * Aucune API, aucun réseau : `@hebcal/core`, déjà présent pour la paracha de
 * la semaine (voir dailyCycles), embarque le moteur solaire NOAA. Les heures
 * se calculent donc sans réseau, pour n'importe quelle date et n'importe quel
 * point du globe : une fois la page chargée, elle n'a plus besoin de rien,
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
  /** Nom affichable, connu sauf pour une position brute de l'appareil. */
  city: string | null;
  /**
   * Position de l'appareil : la ville connue la plus proche, pour nommer le
   * lieu (voir services/nearestCity). `null` quand rien d'assez proche n'a été
   * trouvé, absent quand la recherche n'a pas encore eu lieu.
   */
  nearby?: NearbyPlace | null;
}

/** Ville connue la plus proche d'une position, et sa distance. */
export interface NearbyPlace {
  city: string;
  /** Code ISO 3166 alpha-2, pour nommer le pays dans la langue de l'interface. */
  country: string;
  km: number;
}

// Une position d'appareil se nomme d'autant plus prudemment qu'elle est loin
// de la ville la plus proche : dans la ville, près d'elle, ou seulement le
// pays. Le catalogue est dense en France et en Israël, clairsemé ailleurs :
// mieux vaut « États-Unis » qu'une ville à 400 km.
const IN_CITY_KM = 25;
const NEAR_KM = 150;
/** Au-delà, la ville la plus proche n'apprend plus rien, pas même le pays. */
export const KNOWN_PLACE_KM = 800;

/** Comment nommer une position d'après la ville connue la plus proche. */
export type PlaceNaming =
  | { kind: "city"; city: string }
  | { kind: "near"; city: string }
  | { kind: "country"; country: string }
  | { kind: "unknown" };

export function describeNearby(nearby: NearbyPlace | null | undefined): PlaceNaming {
  if (!nearby) return { kind: "unknown" };
  if (nearby.km <= IN_CITY_KM) return { kind: "city", city: nearby.city };
  if (nearby.km <= NEAR_KM) return { kind: "near", city: nearby.city };
  if (nearby.km <= KNOWN_PLACE_KM) return { kind: "country", country: nearby.country };
  return { kind: "unknown" };
}

/**
 * Nom affichable du lieu de calcul, LA règle de nommage, partagée entre la
 * page des horaires, la carte de l'accueil (via useZmanimPlaceLabel) et les
 * widgets d'écran d'accueil (via widgetPayloads).
 *
 * Une ville choisie porte son nom ; une position d'appareil est nommée par la
 * ville connue la plus proche, avec la prudence que commande la distance
 * (describeNearby) : la ville tout près, « Près de X » un peu plus loin,
 * seulement le pays au-delà.
 */
export function formatPlaceLabel(
  place: ZmanimPlace,
  t: (key: string, params?: Record<string, unknown>) => string,
  locale: string,
): string {
  if (place.city) return place.city;
  const naming = describeNearby(place.nearby);
  switch (naming.kind) {
    case "city":
      return naming.city;
    case "near":
      return t("zmanim.place.near", { city: naming.city });
    case "country":
      try {
        return (
          new Intl.DisplayNames([locale], { type: "region" }).of(naming.country) ??
          t("zmanim.place.device")
        );
      } catch {
        return t("zmanim.place.device"); // API absente ou code inconnu
      }
    default:
      return t("zmanim.place.device");
  }
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
 * sortie des étoiles, le Gaon de Vilna du lever au coucher du soleil, l'écart
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

/**
 * Les villes dont l'usage local fixe l'allumage plus tôt que les 18 minutes
 * habituelles. La table est volontairement courte : on n'y met qu'un usage
 * unanime et vérifiable, sous peine d'annoncer une heure fausse. Jérusalem
 * allume 40 minutes avant la chkia ; ailleurs, tant qu'un usage n'est pas
 * établi ici, le calcul reste celui de la diaspora.
 *
 * La clé est le nom exact de la ville du catalogue (src/datas/cities.json) :
 * une position relevée par l'appareil, elle, n'a pas de nom et suit donc la
 * règle générale.
 */
const CANDLE_LIGHTING_BY_CITY: Record<string, number> = {
  "Jérusalem": 40,
};

/** Les minutes d'avance de l'allumage à ce lieu : 18, sauf usage local. */
export function candleLightingMinutes(place: ZmanimPlace): number {
  const local = place.city ? CANDLE_LIGHTING_BY_CITY[place.city] : undefined;
  return local ?? CANDLE_LIGHTING_MINUTES;
}

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
export function dayInPlace(place: ZmanimPlace, date: Date): Date {
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

/** La chkia (coucher du soleil) d'un jour civil, null aux latitudes extrêmes. */
export function getSunset(place: ZmanimPlace, day: Date = new Date()): Date | null {
  const sunset = new Zmanim(geoLocationOf(place), dayInPlace(place, day), false).sunset();
  return isUsable(sunset) ? sunset : null;
}

/** La plage où se disent les Sli'hot : de hatsot au lever du soleil. */
export interface SlihotWindow {
  /** Hatsot halayla, le milieu de la nuit, à partir duquel on peut commencer. */
  start: Date;
  /** Le lever du soleil (netz) : passé lui, ce n'est plus l'heure des Sli'hot. */
  end: Date;
  /** La nuit en cours (on est entre hatsot et le netz) ou celle qui vient. */
  tonight: boolean;
}

/**
 * La plage horaire des Sli'hot pour la nuit en cours, ou, une fois le jour
 * levé, pour la nuit qui vient.
 *
 * L'usage séfarade est de les dire à l'achmoret haboker, la dernière veille de
 * la nuit : jamais avant hatsot (le milieu de la nuit) et jusqu'au lever du
 * soleil, la prière du matin prenant alors le relais.
 *
 * `chatzotNight` d'un jour hébraïque donné est le milieu de la nuit qui l'a
 * précédé (voir ZMAN_DEFS) : le début et la fin se lisent donc tous deux sur
 * le jour du MATIN où les Sli'hot s'achèvent.
 */
export function slihotWindow(place: ZmanimPlace, now: Date = new Date()): SlihotWindow | null {
  const gloc = geoLocationOf(place);
  const today = dayInPlace(place, now);
  const sunriseToday = new Zmanim(gloc, today, false).sunrise();
  // Avant le lever du soleil, la nuit en cours est encore celle des Sli'hot ;
  // après, on annonce déjà la nuit suivante.
  const tonight = !isUsable(sunriseToday) || now.getTime() < sunriseToday.getTime();
  const morning = new Date(today);
  if (!tonight) morning.setDate(morning.getDate() + 1);
  const zmanim = new Zmanim(gloc, morning, false);
  const start = zmanim.chatzotNight();
  const end = zmanim.sunrise();
  if (!isUsable(start) || !isUsable(end)) return null;
  return { start, end, tonight };
}

/**
 * Combien de minutes avant la chkia part le rappel « dernier appel ».
 * Recopié dans functions/src/sunsetReminder.ts, qui ne peut pas importer src/.
 */
export const SUNSET_REMINDER_OFFSET_MINUTES = 20;

/** L'instant du rappel d'avant-chkia, pour le jour civil demandé. */
export function sunsetReminderAt(place: ZmanimPlace, day: Date = new Date()): Date | null {
  const sunset = getSunset(place, day);
  return sunset ? new Date(sunset.getTime() - SUNSET_REMINDER_OFFSET_MINUTES * 60_000) : null;
}

/** Le strict nécessaire au calcul de la chkia côté serveur. */
export interface ReminderPlace {
  latitude: number;
  longitude: number;
  /** Fuseau IANA : sert à savoir de quel jour civil la chkia est calculée. */
  tzid: string;
}

/**
 * Le lieu tel qu'il est confié au serveur pour le rappel d'avant-chkia.
 *
 * C'est la seule chose que l'application envoie de la position de l'appareil,
 * et seulement si l'utilisateur active ce rappel : la Cloud Function tourne
 * quand le téléphone dort, elle ne peut pas demander sa position. On l'arrondit
 * donc au dixième de degré (~11 km), de quoi ne pas transmettre une position
 * précise, sans rien changer à l'heure obtenue : 0,1° de longitude déplace la
 * chkia de 24 secondes, quand le rappel part par créneaux de 5 minutes.
 */
export function coarsePlace(place: ZmanimPlace): ReminderPlace {
  return {
    latitude: Math.round(place.latitude * 10) / 10,
    longitude: Math.round(place.longitude * 10) / 10,
    tzid: place.tzid,
  };
}

/**
 * Le jour hébraïque d'un jour civil au lieu, sans bascule à la chkia : celui
 * qui court de la chkia de la veille à la sienne.
 */
export function hebrewDayOf(place: ZmanimPlace, day: Date): HDate {
  return new HDate(dayInPlace(place, day));
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
  const hd = hebrewDayOf(place, day);
  if (localDay.getTime() !== dayInPlace(place, now).getTime()) return hd;

  // Aujourd'hui : après la chkia, le jour hébraïque a déjà changé. Le calcul
  // est fait ici plutôt qu'avec `Zmanim.makeSunsetAwareHDate`, qui déduit le
  // jour de base du fuseau du navigateur et se trompe d'un jour dès que
  // l'appareil est réglé loin du lieu affiché.
  const sunset = new Zmanim(geoLocationOf(place), localDay, false).sunset();
  return isUsable(sunset) && now.getTime() >= sunset.getTime() ? hd.next() : hd;
}

/**
 * Israël ou diaspora : décide du calendrier des fêtes (deuxièmes jours de Yom
 * Tov) et des règles du tahanoun. Le fuseau suffit à trancher : une ville
 * d'Israël du catalogue comme une position d'appareil en Israël vivent toutes
 * deux en Asia/Jerusalem.
 */
const isIsraelPlace = (place: ZmanimPlace): boolean => place.tzid === "Asia/Jerusalem";

/** hebcal ne porte que trois catalogues : en, he et fr (voir l'import en tête). */
const hebcalLocale = (locale: string): string =>
  locale === "he" || locale === "fr" ? locale : "en";

/** Jour où le travail est interdit : Chabbat ou Yom Tov, pas 'Hol haMoed. */
function isRestDay(hd: HDate, il: boolean): boolean {
  if (hd.getDay() === 6) return true;
  return (getHolidaysOnDate(hd, il) ?? []).some((ev) => (ev.getFlags() & flags.CHAG) !== 0);
}

/**
 * Le nom d'une fête, sans son numéro de jour ni son millésime : « Pessah II »
 * et « Roch Hachanah 5787 » se ramènent à la fête elle-même, qu'on ne nomme
 * qu'une fois pour un bloc de deux jours.
 */
const festivalName = (ev: { basename(): string }, lg: string): string =>
  Locale.gettext(ev.basename(), lg);

/**
 * Ce que le jour a de particulier hors temps de repos : Roch Hodech, 'Hanouka,
 * un jeûne, 'Hol haMoed, un Chabbat spécial… nommés dans la langue de
 * l'interface (hebcal porte les catalogues en, he et fr, voir l'import de
 * @hebcal/locales/fr en tête de fichier).
 *
 * Les Yom Tov en sont exclus : ils ont leur propre cadre, avec leurs heures
 * d'entrée et de sortie (voir RestPeriod).
 */
export function dayHighlights(place: ZmanimPlace, hd: HDate, locale: string): string[] {
  const events = getHolidaysOnDate(hd, isIsraelPlace(place)) ?? [];
  return events
    .filter((ev) => (ev.getFlags() & flags.CHAG) === 0)
    .map((ev) => ev.render(hebcalLocale(locale)));
}

/**
 * Les Yom Tov d'un jour hébraïque, sans leur numéro de jour : « Pessah », pas
 * « Pessah II ».
 *
 * Le cadre du repos les porte d'ordinaire (voir RestPeriod), et c'est pour
 * cela que `dayHighlights` les écarte. Mais ce cadre n'est pas toujours là :
 * un jour parcouru avec les flèches dont le bloc est déjà sorti à l'heure
 * qu'il est, ou un lieu où l'entrée et la sortie ne se calculent pas. Le jour
 * ne doit pas rester anonyme pour autant : la page redemande alors les noms
 * ici.
 */
export function festivalsOn(place: ZmanimPlace, hd: HDate, locale: string): string[] {
  const lg = hebcalLocale(locale);
  const names: string[] = [];
  for (const ev of getHolidaysOnDate(hd, isIsraelPlace(place)) ?? []) {
    if ((ev.getFlags() & flags.CHAG) === 0) continue;
    const name = festivalName(ev, lg);
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/** Le jour civil d'une date hébraïque, à midi, comme le veut `dayInPlace`. */
function civilNoon(hd: HDate): Date {
  const greg = hd.greg();
  return new Date(greg.getFullYear(), greg.getMonth(), greg.getDate(), 12);
}

/**
 * Un temps de repos : le Chabbat, un Yom Tov, ou la suite des deux quand ils
 * se touchent, Roch Hachana un dimanche prolonge le Chabbat de la veille, et
 * l'ensemble n'a qu'une entrée et qu'une sortie. C'est ce bloc-là qu'on
 * affiche, pas un cadre par jour.
 */
export interface RestPeriod {
  /** Allumage des bougies : 18 minutes avant la chkia de la veille (40 à Jérusalem). */
  start: Date;
  /** Sortie des étoiles du dernier jour. */
  end: Date;
  first: HDate;
  last: HDate;
  /** Le bloc couvre un Chabbat, son jour civil, pour retrouver la paracha. */
  shabbat: Date | null;
  /** Fêtes couvertes, nommées dans la langue demandée, sans numéro de jour. */
  festivals: string[];
}

/** Trois jours de repos d'affilée au maximum (Yom Tov de deux jours + Chabbat). */
const MAX_REST_DAYS = 3;

/**
 * Le temps de repos auquel appartient ce jour hébraïque, ou null si c'en est
 * un ordinaire. Le bloc s'étend de part et d'autre tant que les jours se
 * suivent : c'est ce qui réunit « Chabbat » et « Roch Hachana » sous un seul
 * cadre au lieu de deux.
 */
export function restPeriodAt(place: ZmanimPlace, hd: HDate, locale: string): RestPeriod | null {
  const il = isIsraelPlace(place);
  if (!isRestDay(hd, il)) return null;

  let first = hd;
  for (let i = 0; i < MAX_REST_DAYS && isRestDay(first.prev(), il); i++) first = first.prev();
  let last = hd;
  for (let i = 0; i < MAX_REST_DAYS && isRestDay(last.next(), il); i++) last = last.next();

  const gloc = geoLocationOf(place);
  const eve = civilNoon(first);
  eve.setDate(eve.getDate() - 1);
  const start = new Zmanim(gloc, eve, false).sunsetOffset(-candleLightingMinutes(place), true);
  const end = new Zmanim(gloc, civilNoon(last), false).tzeit();
  if (!isUsable(start) || !isUsable(end)) return null;

  const festivals: string[] = [];
  let shabbat: Date | null = null;
  for (let day = first; day.abs() <= last.abs(); day = day.next()) {
    if (day.getDay() === 6) shabbat = civilNoon(day);
    for (const name of festivalsOn(place, day, locale)) {
      if (!festivals.includes(name)) festivals.push(name);
    }
  }
  return { start, end, first, last, shabbat, festivals };
}

/**
 * Dit-on la bénédiction de la lune (Birkat Halevana) cette nuit-là ?
 *
 * Usage séfarade (Ben Ich 'Haï) : on attend sept jours complets depuis le
 * molad, et on ne la dit plus passé la moitié de la lunaison. Deux reports
 * d'usage, pour la dire dans la joie : en Av on attend la sortie de Tich'a
 * beAv, en Tichri celle de Kippour.
 */
export function saysBirkatHalevana(hd: HDate): boolean {
  const day = hd.getDate();
  if (day > BIRKAT_HALEVANA_LAST_DAY) return false;
  if (hd.getMonth() === months.AV) return day >= 10;
  if (hd.getMonth() === months.TISHREI) return day >= 11;
  return day >= 7;
}

/** La moitié de la lunaison : passé ce jour, la bénédiction ne se dit plus. */
const BIRKAT_HALEVANA_LAST_DAY = 14;

/** Le dernier jour où la bénédiction de la lune se dit, ce mois-là. */
export function birkatHalevanaLastDay(hd: HDate): HDate {
  return new HDate(BIRKAT_HALEVANA_LAST_DAY, hd.getMonth(), hd.getFullYear());
}

/**
 * Une entrée du calendrier des fêtes : une fête (ou un bloc de fêtes qui se
 * suivent), avec ses dates et, quand le travail y est interdit, ses heures.
 */
export interface CalendarEntry {
  /** Clé stable d'affichage. */
  key: string;
  /** Nom localisé, pour les fêtes sans horaires ('Hanouka, Pourim, jeûnes). */
  name: string;
  first: HDate;
  last: HDate;
  /** Le temps de repos, quand c'en est un : ses heures et les fêtes couvertes. */
  period: RestPeriod | null;
}

/**
 * Ce que porte le calendrier : les fêtes et les jeûnes. Les Roch Hodech en
 * sont exclus (douze par an, ils noieraient le reste), les commémorations
 * civiles israéliennes aussi, la page sert à savoir quand commence et
 * quand finit une fête.
 */
const CALENDAR_FLAGS = flags.CHAG | flags.MAJOR_FAST | flags.MINOR_FAST | flags.MINOR_HOLIDAY;

/**
 * Les fêtes d'une année hébraïque, dans l'ordre.
 *
 * Les jours de Yom Tov qui se suivent, et le Chabbat qui les prolonge, sont
 * réunis en un seul bloc, avec une entrée et une sortie : c'est ainsi qu'on
 * les vit, et Pessah y compte bien deux blocs séparés par le 'Hol haMoed. Les
 * fêtes sans interdit de travail ('Hanouka, Pourim, les jeûnes) donnent une
 * entrée par fête, 'Hanouka couvrant ses huit jours d'un trait.
 */
export function yearCalendar(
  place: ZmanimPlace,
  hebrewYear: number,
  locale: string,
): CalendarEntry[] {
  const il = isIsraelPlace(place);
  const lg = hebcalLocale(locale);
  const events = HebrewCalendar.calendar({
    year: hebrewYear,
    isHebrewYear: true,
    il,
    noRoshChodesh: true,
    noSpecialShabbat: true,
    noModern: true,
    sedrot: false,
    omer: false,
  });

  const entries: CalendarEntry[] = [];
  // Un bloc de repos est atteint par chacun de ses jours : on ne le garde
  // qu'une fois, reconnu à son premier jour.
  const seenPeriods = new Set<number>();
  // Dernière entrée ouverte par fête, pour recoller les jours qui se suivent.
  const running = new Map<string, CalendarEntry>();

  for (const ev of events) {
    const eventFlags = ev.getFlags();
    if ((eventFlags & CALENDAR_FLAGS) === 0 || (eventFlags & flags.EREV) !== 0) continue;
    const hd = ev.getDate();

    // Une fête dont le bloc de repos n'a pas d'heures (pas de chkia ni de
    // sortie des étoiles, aux latitudes extrêmes) reste une fête : elle rejoint
    // alors les entrées sans horaires plus bas, plutôt que de disparaître du
    // calendrier de qui vit à Tromsø.
    const period = (eventFlags & flags.CHAG) !== 0 ? restPeriodAt(place, hd, locale) : null;
    if (period) {
      if (seenPeriods.has(period.first.abs())) continue;
      seenPeriods.add(period.first.abs());
      entries.push({
        key: `rest-${period.first.abs()}`,
        name: period.festivals.join(" · "),
        first: period.first,
        last: period.last,
        period,
      });
      continue;
    }

    const family = ev.basename();
    const open = running.get(family);
    if (open && hd.abs() === open.last.abs() + 1) {
      open.last = hd;
      continue;
    }
    const entry: CalendarEntry = {
      key: `${family}-${hd.abs()}`,
      name: festivalName(ev, lg),
      first: hd,
      last: hd,
      period: null,
    };
    running.set(family, entry);
    entries.push(entry);
  }

  return entries.sort((a, b) => a.first.abs() - b.first.abs());
}

/**
 * Les temps de repos qui concernent le jour affiché : celui qui est en cours
 * ou qui vient, puis le suivant s'il tombe dans la semaine. Une semaine de
 * fête en compte deux (le Yom Tov, puis le Chabbat) ; une semaine ordinaire
 * n'en a qu'un, le Chabbat.
 *
 * Un bloc déjà sorti ne s'annonce plus : le samedi soir après la sortie des
 * étoiles, c'est le Chabbat suivant qui prend la place.
 */
export function restPeriodsNear(
  place: ZmanimPlace,
  day: Date,
  locale: string,
  horizonDays = 7,
  limit = 2,
): RestPeriod[] {
  const periods: RestPeriod[] = [];
  const firstAbs = new HDate(dayInPlace(place, day)).abs();
  let abs = firstAbs;
  while (abs <= firstAbs + horizonDays && periods.length < limit) {
    const period = restPeriodAt(place, new HDate(abs), locale);
    if (!period) {
      abs++;
      continue;
    }
    if (period.end.getTime() > day.getTime()) periods.push(period);
    abs = period.last.abs() + 1;
  }
  // Une fois dedans, le bloc en cours suffit : annoncer le Chabbat suivant en
  // plein Roch Hachana n'aide personne. C'est avant qu'il faut les deux.
  const inProgress = periods[0] && periods[0].start.getTime() <= day.getTime();
  return inProgress ? periods.slice(0, 1) : periods;
}

/**
 * Dit-on le tahanoun ce jour hébraïque-là ?
 *
 * - "full" : à Cha'harit et à Min'ha (jour ordinaire) ;
 * - "shacharitOnly" : le matin seulement, veille d'un jour sans tahanoun
 *   (dont chaque vendredi, veille de Chabbat) ;
 * - "none" : pas du tout (Roch Hodech, fêtes, tout Nissan…).
 *
 * Le Chabbat renvoie null : le tahanoun n'y existe pas, la question ne se
 * pose pas (le champ mincha de hebcal y décrit le Tsidkatekha, pas un
 * tahanoun, l'afficher sèmerait la confusion).
 */
export type TachanunStatus = "full" | "shacharitOnly" | "none";

export function tachanunStatus(place: ZmanimPlace, hd: HDate): TachanunStatus | null {
  if (hd.getDay() === 6) return null;
  const said = tachanun(hd, isIsraelPlace(place));
  if (!said.shacharit) return "none";
  return said.mincha ? "full" : "shacharitOnly";
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

/** "21 Av 5786", en hébreu pointé pour la locale he, translittéré sinon. */
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
 * sur New York est encore la veille, et le vendredi, celui qui décide d'
 * afficher le Chabbat, se déclencherait au mauvais moment.
 */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayIn(place: ZmanimPlace, date: Date): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: place.tzid,
    weekday: "short",
  }).format(date);
  return WEEKDAYS.indexOf(short);
}

/** Deux instants tombent-ils le même jour civil, au lieu affiché ? */
export function sameCivilDay(place: ZmanimPlace, a: Date, b: Date): boolean {
  return dayInPlace(place, a).getTime() === dayInPlace(place, b).getTime();
}

/** "06:27" dans le fuseau du lieu, jamais celui du navigateur. */
export function formatZmanTime(date: Date, tzid: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tzid,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** "vendredi 7 août", le jour d'un horaire, dans le fuseau du lieu. */
export function formatZmanDay(date: Date, tzid: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tzid,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}
