import {
  GeoLocation,
  HDate,
  HebrewCalendar,
  Locale,
  Molad,
  Zmanim,
  flags,
  holidayDesc,
  months,
  getHolidaysOnDate,
} from "@hebcal/core";
// Noms des fêtes en français : hebcal ne les rend qu'en anglais ou en hébreu
// sans ce catalogue (4 Ko), qui s'enregistre auprès de hebcal à l'import.
import "@hebcal/locales/fr";
import { dateTimeFormat, displayNames } from "./intlCache";
import { devicePreference } from "./devicePreference";
import { saidTachanun } from "./tachanun";
import {
  DEFAULT_ZMANIM_OPINION,
  opinionZmanim,
  zmanimOpinionStore,
  type EndRule,
  type OpinionContext,
  type OpinionZmanim,
  type RabbenouTamRule,
  type ZmanimOpinion,
} from "./zmanimOpinions";

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
          displayNames(locale, { type: "region" }).of(naming.country) ?? t("zmanim.place.device")
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
 * Le sens dans lequel un horaire s'arrondit à la minute.
 *
 * Un horaire ne tombe jamais sur une minute ronde, et l'afficher demande de
 * couper les secondes. Le sens n'est pas indifférent :
 *
 *  - une FIN, dernier moment pour faire quelque chose (la fin du Chéma, la fin
 *    de la consommation du 'hamets, l'allumage, hatsot, la chkia), se coupe
 *    vers le BAS. La fin du Chéma à 10:37:48 s'affiche 10:37 : on se presse un
 *    peu, on ne dépasse pas ;
 *  - un DÉBUT, premier moment où une chose est permise (le talith, le netz,
 *    min'ha guedola, min'ha ketana, plag, la sortie des étoiles, la sortie du
 *    Chabbat, la fin d'un jeûne), monte à la minute SUPÉRIEURE. La sortie du
 *    Chabbat à 20:42:09 s'affiche 20:43, et non 20:42, qui la relâcherait
 *    cinquante et une secondes trop tôt ; le talith à 06:25:02 s'affiche
 *    06:26, et non 06:25, qui le ferait mettre deux secondes trop tôt.
 *
 * L'aube fait exception aux débuts, et se coupe vers le bas : elle n'ouvre pas
 * une permission, elle ouvre le JOUR du Maguen Avraham, dont tout le reste se
 * compte ; c'est aussi le sens que lui donne le calendrier source.
 *
 * Ces sens ne sont pas devinés : ce sont ceux que le calendrier Rabbi Ovadiah
 * Yosef marque zman par zman (`ROUND_EARLIER` et `ROUND_LATER` dans son
 * `ZmanimFactory.java`), relu pour l'occasion.
 *
 * L'arrondi se fait AU CALCUL, et non à l'affichage : le décompte de la page,
 * les rappels, les widgets et la montre lisent le même instant que la ligne
 * d'horaire, et annoncent donc la même minute. Voir
 * `docs/audit-horaires-2026-09.md`, point 3.3.
 */
export type ZmanRounding = "down" | "up";

/**
 * L'horaire coupé à la minute, dans le sens que sa nature commande.
 *
 * Le calcul se fait sur l'instant (l'epoch), jamais avec un setter de `Date` :
 * un setter recalculerait l'instant depuis les champs locaux de la machine, et
 * sauterait d'une heure à l'heure ambiguë du retour à l'heure d'hiver (voir le
 * correctif de `patches/` et le point 3.1 de l'audit).
 */
export function roundMinute(date: Date, round: ZmanRounding): Date {
  const ms = date.getTime();
  const rounded = round === "up" ? Math.ceil(ms / 60_000) : Math.floor(ms / 60_000);
  return new Date(rounded * 60_000);
}

/** Le même arrondi, mais qui laisse passer une date incalculable. */
function roundUsable(date: Date | null, round: ZmanRounding): Date | null {
  return isUsable(date) ? roundMinute(date, round) : null;
}

/**
 * Les horaires retenus, dans l'ordre chronologique.
 *
 * Deux opinions sont données là où la pratique les distingue vraiment (fin du
 * Chéma et de la Amida) : le Maguen Avraham compte le jour de l'aube à la
 * sortie des étoiles, le Gaon de Vilna du lever au coucher du soleil, l'écart
 * atteint facilement une demi-heure.
 */
const ZMAN_DEFS = [
  // Milieu de la nuit en cours au petit matin : `chatzotNight` d'un jour donné
  // est celui de la nuit qui l'a précédé. Il ouvre la liste : après minuit, le
  // jour civil a changé, mais le milieu de sa nuit, souvent vers 1 h, n'est
  // pas forcément passé, et c'est lui qu'on vient vérifier à cette heure-là.
  { key: "chatzotNightDawn", period: "dawn", round: "up", at: (z: Zmanim) => z.chatzotNight() },
  { key: "alotHaShachar", period: "dawn", round: "down", at: (z, _n, o, c) => o.alotHaShachar(z, c) },
  { key: "misheyakir", period: "dawn", round: "up", at: (z, _n, o, c) => o.misheyakir(z, c) },
  { key: "sunrise", period: "dawn", round: "up", at: (z: Zmanim) => z.sunrise() },
  { key: "sofZmanShmaMGA", period: "morning", round: "down", at: (z, _n, o, c) => o.sofZmanShmaMGA(z, c) },
  { key: "sofZmanShma", period: "morning", round: "down", at: (z: Zmanim) => z.sofZmanShma() },
  {
    key: "sofZmanTfillaMGA",
    period: "morning",
    round: "down",
    at: (z, _n, o, c) => o.sofZmanTfillaMGA(z, c),
  },
  { key: "sofZmanTfilla", period: "morning", round: "down", at: (z: Zmanim) => z.sofZmanTfilla() },
  { key: "chatzot", period: "afternoon", round: "down", at: (z: Zmanim) => z.chatzot() },
  { key: "minchaGedola", period: "afternoon", round: "up", at: (z, _n, o, c) => o.minchaGedola(z, c) },
  { key: "minchaKetana", period: "afternoon", round: "up", at: (z: Zmanim) => z.minchaKetana() },
  { key: "plagHaMincha", period: "afternoon", round: "up", at: (z, _n, o, c) => o.plagHaMincha(z, c) },
  { key: "sunset", period: "evening", round: "down", at: (z: Zmanim) => z.sunset() },
  { key: "tzeit", period: "evening", round: "up", at: (z, _n, o, c) => o.tzeit(z, c) },
  // Milieu de la nuit qui suit le jour affiché : lu sur le lendemain, dont la
  // nuit précédente est justement celle-là.
  {
    key: "chatzotNight",
    period: "evening",
    round: "up",
    at: (_z: Zmanim, next: Zmanim) => next.chatzotNight(),
  },
] as const satisfies readonly {
  key: string;
  period: ZmanPeriod;
  round: ZmanRounding;
  at: (z: Zmanim, next: Zmanim, opinion: OpinionZmanim, ctx: OpinionContext) => Date;
}[];

export type ZmanKey = (typeof ZMAN_DEFS)[number]["key"];

/**
 * Les clés des horaires, dans l'ordre de la journée. Un horaire n'est pas
 * toujours calculable (nuit polaire) et la liste d'un jour peut donc être plus
 * courte : celle-ci dit ce qui existe, indépendamment d'un jour et d'un lieu.
 * Les rappels s'en servent pour donner à chaque horaire un identifiant système
 * stable (voir zmanReminderService).
 */
export const ZMAN_KEYS: ZmanKey[] = ZMAN_DEFS.map((def) => def.key);

/**
 * Le sens de l'arrondi de chaque horaire (voir ZmanRounding). Publié pour que
 * le test puisse le confronter à l'instant exact, horaire par horaire, plutôt
 * que de recopier la liste et de la laisser vieillir.
 */
export const ZMAN_ROUNDING: Record<ZmanKey, ZmanRounding> = Object.fromEntries(
  ZMAN_DEFS.map((def) => [def.key, def.round]),
) as Record<ZmanKey, ZmanRounding>;

export interface ZmanTime {
  key: ZmanKey;
  period: ZmanPeriod;
  /**
   * L'horaire, coupé à la minute dans le sens de sa nature (voir
   * ZmanRounding). C'est LUI que lisent la page, le décompte, les rappels, les
   * widgets et la montre : tous annoncent donc la même minute.
   */
  date: Date;
  /**
   * Le même horaire avant la coupe, à la seconde près.
   *
   * Il ne s'affiche jamais. Il sert à vérifier les définitions, que la minute
   * efface : hatsot est à mi-chemin EXACT du lever et du coucher, et non au
   * midi solaire, dont il ne s'écarte que d'une demi-seconde à une
   * demi-minute ; trois horaires coupés à la minute ne sauraient plus dire
   * lequel des deux le calcul a pris. Voir `zmanimInvariants.test.ts`.
   */
  exact: Date;
}

/**
 * L'opinion suivie par tous les calculs de ce module (voir zmanimOpinions).
 *
 * Un réglage, et non un paramètre passé de proche en proche : les horaires
 * sont demandés d'une dizaine d'endroits (l'accueil, le sidour, les widgets,
 * les rappels, la page des horaires), et tous doivent lire la même. C'est
 * useZmanimOpinion qui la pose, au chargement du réglage et à chaque
 * changement.
 */
let currentOpinion: ZmanimOpinion = zmanimOpinionStore.read() ?? DEFAULT_ZMANIM_OPINION;

/** L'opinion suivie en ce moment. */
export function zmanimOpinion(): ZmanimOpinion {
  return currentOpinion;
}

/** Change l'opinion suivie, et vide ce qui a été calculé avec la précédente. */
export function setZmanimOpinion(opinion: ZmanimOpinion): void {
  if (opinion === currentOpinion) return;
  currentOpinion = opinion;
  zmanimCache.clear();
}

/** Minutes avant le coucher du soleil pour l'allumage des bougies (usage diaspora). */
const CANDLE_LIGHTING_MINUTES = 18;

/**
 * L'usage d'Israël, hors les deux villes qui ont le leur.
 *
 * Vingt minutes, et non dix-huit : c'est ce qu'impriment les luhot israéliens,
 * et ce que le calendrier Rabbi Ovadiah Yosef demande pour retrouver l'Or
 * Ha'Haïm (« change `setCandleLightingOffset` to 20 if you want to replicate
 * the exact times of the Ohr Hachaim calendar »). Sur cet avis, l'application
 * annonçait deux minutes trop tard dans trente-trois villes d'Israël.
 */
const CANDLE_LIGHTING_ISRAEL_MINUTES = 20;

/**
 * Les villes dont l'usage local fixe l'allumage plus tôt encore.
 *
 * La table est volontairement courte : on n'y met qu'un usage unanime et
 * vérifiable, sous peine d'annoncer une heure fausse. Jérusalem allume
 * 40 minutes avant la chkia, Haïfa 30 ; ce sont les deux seules que hebcal et
 * Chabad.org retiennent aussi (hebcal y ajoute Zikhron Ya'akov, absente du
 * catalogue). Petah Tikva, Safed et Tibériade ont un usage PARTAGÉ, entre
 * celui de Jérusalem et celui du pays : elles suivent les vingt minutes, et
 * c'est le réglage ci-dessous qui tranche pour qui suit l'autre.
 *
 * La clé est le nom exact de la ville du catalogue (src/datas/cities.json).
 * Une position relevée par l'appareil n'a pas de nom, mais elle a un fuseau :
 * en Israël, elle suit donc bien les vingt minutes.
 */
const CANDLE_LIGHTING_BY_CITY: Record<string, number> = {
  Jérusalem: 40,
  Haïfa: 30,
};

/**
 * Les minutes d'avance de l'allumage QUE LE LIEU commande, sans regarder le
 * réglage : 18 en diaspora, 20 en Israël, 30 à Haïfa, 40 à Jérusalem.
 *
 * C'est cette heure-là que les pages du site annoncent, puisqu'elles sont les
 * mêmes pour tout le monde ; la page des horaires, elle, passe par
 * `candleLightingMinutes`, qui laisse le réglage l'emporter.
 */
export function localCandleLightingMinutes(place: ZmanimPlace): number {
  const local = place.city ? CANDLE_LIGHTING_BY_CITY[place.city] : undefined;
  if (local !== undefined) return local;
  return isIsraelPlace(place) ? CANDLE_LIGHTING_ISRAEL_MINUTES : CANDLE_LIGHTING_MINUTES;
}

/**
 * Les écarts d'allumage proposés au réglage.
 *
 * Dix-huit, vingt, trente ou quarante minutes : c'est l'usage d'une
 * COMMUNAUTÉ, pas d'une ville. Petah Tikva en a deux, Safed et Tibériade
 * aussi, et un Français installé à Jérusalem peut garder l'usage de sa
 * communauté. Plutôt que de trancher à la place de l'utilisateur, on lui
 * laisse le choix, avec le défaut du lieu.
 */
export const CANDLE_LIGHTING_CHOICES = [18, 20, 30, 40];

function parseCandleMinutes(value: unknown): number | null {
  const minutes = Number(value);
  return CANDLE_LIGHTING_CHOICES.includes(minutes) ? minutes : null;
}

/** Le réglage, gardé sur l'appareil ; null quand on suit l'usage du lieu. */
export const candleLightingStore = devicePreference<number>(
  "pj_candle_minutes",
  parseCandleMinutes,
  String,
);

// Lu une fois au chargement, comme l'opinion : l'allumage est affiché dès le
// premier rendu, et un réglage qui n'arriverait qu'après ferait sauter l'heure
// sous les yeux.
let currentCandleMinutes: number | null = candleLightingStore.read();

/** L'écart choisi, ou null quand c'est l'usage du lieu qui vaut. */
export function candleLightingChoice(): number | null {
  return currentCandleMinutes;
}

/** Change l'écart suivi. `null` rend la main à l'usage du lieu. */
export function setCandleLightingChoice(minutes: number | null): void {
  currentCandleMinutes = minutes === null ? null : parseCandleMinutes(minutes);
}

/** Les minutes d'avance de l'allumage à ce lieu : le réglage, sinon l'usage. */
export function candleLightingMinutes(place: ZmanimPlace): number {
  return currentCandleMinutes ?? localCandleLightingMinutes(place);
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
 * Le jour de référence de l'Amudei Horaah : le 17 mars, l'équinoxe.
 *
 * C'est la date que le calendrier source pose en dur pour y mesurer, au lieu
 * même, la part d'heure zmanit qu'occupe la descente du soleil à un angle
 * donné (voir OpinionContext.equinox).
 */
const EQUINOX_MONTH = 2;
const EQUINOX_DAY = 17;

/**
 * Ce que le lieu et le jour apportent au calcul d'un avis.
 *
 * Construit par jour et par lieu, à chaque endroit qui interroge un avis : un
 * avis n'est pas un jeu de paramètres fixes, c'est un luah, et le luah du
 * calendrier Rabbi Ovadiah Yosef change entre Israël et la diaspora (voir
 * zmanimOpinions).
 */
export function opinionContext(place: ZmanimPlace, localDay: Date): OpinionContext {
  const gloc = geoLocationOf(place);
  const year = localDay.getFullYear();
  return {
    il: isIsraelPlace(place),
    equinox: new Zmanim(gloc, new Date(year, EQUINOX_MONTH, EQUINOX_DAY, 12), false),
    equinoxKey: `${place.latitude}|${place.longitude}|${place.tzid}|${year}`,
    // Paresseux : la plupart des horaires n'en ont pas besoin, et le calculer
    // à chaque contexte doublerait le travail solaire de la page.
    solarMidnight: () => {
      const nextDay = new Date(localDay);
      nextDay.setDate(nextDay.getDate() + 1);
      // `chatzotNight` d'un jour est le milieu de la nuit qui l'a PRÉCÉDÉ :
      // lu sur le lendemain, c'est bien le milieu de la nuit qui suit.
      return new Zmanim(gloc, nextDay, false).chatzotNight();
    },
  };
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
  const [year, month, day] = dateTimeFormat("en-CA", {
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
function isUsable(date: Date | null): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

/**
 * Les horaires d'un jour civil, dans l'ordre chronologique.
 *
 * Mémoïsés par lieu et jour civil : les cartes de l'accueil (horaires, sidour
 * du moment, bénédiction de la lune) les redemandent à chaque tic de
 * l'horloge partagée, toutes les trente secondes, pour le même jour au même
 * endroit. Le calcul hebcal ne se refait que si l'un des deux change ; le
 * tableau rendu est partagé, les appelants ne le modifient pas.
 */
export function computeZmanim(place: ZmanimPlace, day: Date = new Date()): ZmanTime[] {
  const localDay = dayInPlace(place, day);
  const key = `${place.latitude}|${place.longitude}|${place.tzid}|${localDay.getTime()}|${currentOpinion}`;
  const cached = zmanimCache.get(key);
  if (cached) return cached;
  const times = computeZmanimFor(place, localDay);
  if (zmanimCache.size >= ZMANIM_CACHE_LIMIT) {
    zmanimCache.delete(zmanimCache.keys().next().value as string);
  }
  zmanimCache.set(key, times);
  return times;
}

/** Quelques jours autour d'aujourd'hui, à un ou deux lieux : au-delà, on recalcule. */
const ZMANIM_CACHE_LIMIT = 8;
const zmanimCache = new Map<string, ZmanTime[]>();

function computeZmanimFor(place: ZmanimPlace, localDay: Date): ZmanTime[] {
  const gloc = geoLocationOf(place);
  const zmanim = new Zmanim(gloc, localDay, false);
  const nextDay = new Date(localDay);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextZmanim = new Zmanim(gloc, nextDay, false);

  const opinion = opinionZmanim(currentOpinion);
  const ctx = opinionContext(place, localDay);
  const times: ZmanTime[] = [];
  for (const def of ZMAN_DEFS) {
    const computed = def.at(zmanim, nextZmanim, opinion, ctx);
    // Nuit ou jour polaire : l'horaire n'existe pas, on ne l'affiche pas.
    if (!isUsable(computed)) continue;
    // Coupé à la minute ici, dans le sens que sa nature commande (voir
    // ZmanRounding) : c'est cet instant-là que lisent la page, le décompte,
    // les rappels et les widgets, et ils annoncent donc tous la même minute.
    const date = roundMinute(computed, def.round);
    // Le milieu de la nuit en cours n'appartient au jour que s'il tombe après
    // minuit. À l'est du méridien de son fuseau (Israël l'hiver), il tombe
    // avant : c'est alors la soirée de la veille qui le porte, pas ce jour-ci.
    if (def.key === "chatzotNightDawn" && dayInPlace(place, date).getTime() !== localDay.getTime())
      continue;
    times.push({ key: def.key, period: def.period, date, exact: computed });
  }
  // ZMAN_DEFS les range dans l'ordre d'une journée ordinaire, mais cet ordre
  // n'est pas garanti partout : au nord de Manchester, en hiver, le jour du
  // Maguen Avraham (compté de 16,1° avant le lever à 16,1° après la chkia)
  // est si long devant celui du Gaon de Vilna que sa QUATRIÈME heure tombe
  // avant la TROISIÈME de l'autre, et la fin de la Amida s'affichait alors
  // au-dessus d'une fin du Chéma plus tardive. `nextZman` lit cette liste
  // dans l'ordre pour annoncer l'horaire qui vient : elle doit l'être.
  return times.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Pourquoi un horaire manque à la liste du jour.
 *
 *  - `degrees` : le soleil se lève et se couche, mais il ne descend jamais
 *    assez bas sous l'horizon pour l'angle que l'avis demande. C'est le cas
 *    de l'avis du Rav Posen, qui compte en degrés, au nord de Lille environ :
 *    l'aube (16,1°) n'existe pas une quinzaine de jours par an à Lille, une
 *    trentaine à Londres, une centaine à Helsinki, et les deux limites du
 *    Maguen Avraham, qui se comptent depuis elle, pas davantage.
 *  - `polar` : le soleil ne se lève pas ou ne se couche pas du tout. Là,
 *    aucun avis n'a d'heure à donner.
 *
 * La distinction porte la note affichée sous les horaires : le premier cas a
 * une issue (l'avis du Rav Ovadia Yossef compte en minutes zmaniyot,
 * proportionnelles au jour, et donne donc une heure sous toutes les
 * latitudes où le soleil se lève), le second n'en a pas. Elle se lit sans
 * connaître l'avis suivi : un calcul en minutes zmaniyot ne peut pas manquer
 * un horaire tant que le lever et la chkia existent, si bien que `degrees`
 * ne désigne jamais que l'avis par degrés.
 */
export interface ZmanimGap {
  /** Les horaires absents de la liste du jour. */
  keys: ZmanKey[];
  reason: "degrees" | "polar";
}

/** Ce que l'avis suivi ne sait pas calculer ce jour-là, en ce lieu, ou null. */
export function zmanimGap(place: ZmanimPlace, day: Date = new Date()): ZmanimGap | null {
  const present = new Set<string>(computeZmanim(place, day).map((zman) => zman.key));
  // `chatzotNightDawn` manque par construction certains jours (voir ZMAN_DEFS) :
  // son absence ne dit rien du soleil, et n'a donc rien à expliquer.
  const keys = ZMAN_KEYS.filter((key) => key !== "chatzotNightDawn" && !present.has(key));
  if (keys.length === 0) return null;
  const polar = !present.has("sunrise") || !present.has("sunset");
  return { keys, reason: polar ? "polar" : "degrees" };
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
  // Hatsot ouvre la plage (on ne commence pas avant), le netz la ferme : la
  // première monte à la minute supérieure, la seconde descend (voir
  // ZmanRounding).
  return { start: roundMinute(start, "up"), end: roundMinute(end, "down"), tonight };
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
export const isIsraelPlace = (place: ZmanimPlace): boolean => place.tzid === "Asia/Jerusalem";

/** hebcal ne porte que trois catalogues : en, he et fr (voir l'import en tête). */
const hebcalLocale = (locale: string): string =>
  locale === "he" || locale === "fr" ? locale : "en";

/**
 * Ce que hebcal range parmi les jeûnes sans que le calendrier de
 * l'application le suive :
 *
 *  - le **Yom Kippour Katan**, jeûne facultatif de la veille de chaque Roch
 *    Hodech, tenu par des particuliers et non par la communauté ;
 *  - le **Ta'anit BeHaB**, usage achkénaze des lundi, jeudi et lundi qui
 *    suivent Pessah et Soukkot.
 *
 * `HebrewCalendar.calendar`, dont vit la page du calendrier, les écarte de
 * lui-même : il faut les demander par ses options `yomKippurKatan` et
 * `behab`. `getHolidaysOnDate`, lui, rend la liste brute, et la page des
 * horaires annonçait donc une quinzaine de faux jeûnes par an, avec leur
 * heure de début et de fin, à côté des six vrais. Les deux pages lisent
 * maintenant le même calendrier.
 */
const NOT_OBSERVED_FLAGS = flags.YOM_KIPPUR_KATAN | flags.BEHAB;

/** Les fêtes et jeûnes d'un jour, tels que l'application les suit. */
function holidaysOn(hd: HDate, il: boolean) {
  return (getHolidaysOnDate(hd, il) ?? []).filter(
    (ev) => (ev.getFlags() & NOT_OBSERVED_FLAGS) === 0,
  );
}

/** Jour où le travail est interdit : Chabbat ou Yom Tov, pas 'Hol haMoed. */
function isRestDay(hd: HDate, il: boolean): boolean {
  if (hd.getDay() === 6) return true;
  return holidaysOn(hd, il).some((ev) => (ev.getFlags() & flags.CHAG) !== 0);
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
  return holidaysOn(hd, isIsraelPlace(place))
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
  for (const ev of holidaysOn(hd, isIsraelPlace(place))) {
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
  /**
   * Sortie du dernier jour, telle que l'opinion suivie la donne : la sortie
   * des étoiles pour le Rav Posen, 40 minutes après la chkia pour le luah
   * Or Ha'Haïm (voir zmanimOpinions).
   *
   * Null quand l'avis suivi ne sait pas la donner ici ce jour-là : à partir
   * de Stockholm, le soleil ne descend pas à 8,5° au cœur de l'été, et six à
   * huit Chabbats par an n'avaient alors ni entrée ni sortie, faute de quoi
   * le bloc disparaissait tout entier de la page. L'allumage, lui, se lit sur
   * la chkia et existe toujours : on annonce donc le Chabbat avec son entrée,
   * et la note dit pourquoi sa sortie n'a pas d'heure (voir ZmanimGap).
   */
  end: Date | null;
  /**
   * Sortie selon Rabbénou Tam, 72 minutes après la chkia du dernier jour
   * (fixes ou zmaniyot selon l'opinion), pour qui suit cet avis. Null quand
   * la chkia ne se calcule pas.
   */
  endRabbenouTam: Date | null;
  /**
   * Comment la sortie se compte, pour la note sous le cadre : sans elle, la
   * note annoncerait « à la sortie des étoiles » là où le cadre affiche trente
   * minutes après la chkia (voir zmanimOpinions, EndRule).
   */
  endRule: EndRule;
  /** Comment Rabbénou Tam se compte, même raison. */
  rabbenouTamRule: RabbenouTamRule;
  /**
   * Les allumages À L'INTÉRIEUR du bloc : un par soir, sauf le premier, qui
   * est déjà `start`.
   *
   * Un bloc de plusieurs jours n'a qu'une entrée et qu'une sortie, mais il a
   * plusieurs soirs, et chacun demande une heure que l'on cherchait en vain :
   * le deuxième soir d'un Yom Tov, le vendredi pris dans une fête, le Yom Tov
   * qui commence à la sortie du Chabbat. La note disait « on allume après la
   * sortie, à partir d'une flamme déjà allumée », sans jamais donner l'heure.
   */
  lightings: RestLighting[];
  /**
   * Le jour civil où faire l'érouv tavchilin, ou null.
   *
   * Quand un Yom Tov tombe le vendredi et que le Chabbat suit, on ne peut
   * cuisiner le vendredi pour le samedi qu'en ayant posé l'érouv la veille de
   * la fête. Ni la page ni le calendrier ne le disaient.
   */
  eruvTavshilin: Date | null;
  first: HDate;
  last: HDate;
  /** Le bloc couvre un Chabbat, son jour civil, pour retrouver la paracha. */
  shabbat: Date | null;
  /** Fêtes couvertes, nommées dans la langue demandée, sans numéro de jour. */
  festivals: string[];
  /**
   * Le bloc porte Kippour : son entrée est aussi le début du jeûne.
   *
   * Kippour n'a pas de cadre de jeûne, il a un cadre de repos, dont l'entrée
   * s'appelait « Allumage des bougies ». Qui cherchait « à quelle heure
   * commence le jeûne » ne trouvait pas le mot.
   */
  fastStarts: boolean;
}

/**
 * Un allumage à l'intérieur d'un bloc de repos, et la règle qui le place.
 *
 *  - `beforeSunset` : le soir qui ouvre un Chabbat, avant la chkia, comme
 *    l'entrée du bloc. Depuis une flamme déjà allumée si le jour qui s'achève
 *    est lui-même un Yom Tov ;
 *  - `afterShabbat` : un Yom Tov qui commence à la sortie du Chabbat ;
 *  - `afterNightfall` : le deuxième soir d'un Yom Tov de deux jours, à la
 *    nuit. C'est la fin de jeûne (tsét le'houmra) que le calendrier source
 *    retient là, et non la sortie des étoiles ordinaire.
 */
export interface RestLighting {
  /** Le jour hébraïque qui COMMENCE à cet allumage. */
  day: HDate;
  at: Date;
  rule: "beforeSunset" | "afterShabbat" | "afterNightfall";
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
  const lastCivil = civilNoon(last);
  const lastDay = new Zmanim(gloc, lastCivil, false);
  const opinion = opinionZmanim(currentOpinion);
  // Le contexte se pose sur le DERNIER jour du bloc : c'est son soir qui donne
  // la sortie, et c'est sa nuit que l'Amudei Horaah ne dépasse pas.
  const ctx = opinionContext(place, lastCivil);
  const end = opinion.restEnd(lastDay, ctx);
  // L'allumage, lui, est indispensable : sans lui il n'y a rien à annoncer.
  if (!isUsable(start)) return null;
  // La sortie est une FIN : elle monte à la minute supérieure, sans quoi le
  // Chabbat se relâcherait jusqu'à cinquante-neuf secondes trop tôt (voir
  // ZmanRounding). L'allumage, une limite, est déjà coupé vers le bas par
  // hebcal.
  const restEnd = roundUsable(end, "up");
  // Aux hautes latitudes en été, la sortie des étoiles peut dépasser les
  // 72 minutes : une sortie Rabbénou Tam plus tôt que la sortie ordinaire
  // n'apprend rien, on ne la donne pas. Sans sortie du tout, elle n'apprend
  // rien non plus : ce serait la seule heure du cadre, sous un nom que peu
  // suivent.
  const rabbenouTam = roundUsable(opinion.rabbenouTam(lastDay, ctx), "up");
  const endRabbenouTam =
    restEnd && rabbenouTam && rabbenouTam.getTime() > restEnd.getTime() ? rabbenouTam : null;

  const lightings = restLightings(place, first, last, il, opinion);
  const eruvTavshilin = eruvTavshilinDay(first, last, il);

  const festivals: string[] = [];
  let shabbat: Date | null = null;
  let fastStarts = false;
  for (let day = first; day.abs() <= last.abs(); day = day.next()) {
    if (day.getDay() === 6) shabbat = civilNoon(day);
    // Kippour est à la fois un grand jeûne et un jour de repos : c'est cette
    // réunion des deux drapeaux qui le distingue des autres Yom Tov.
    if (
      holidaysOn(day, il).some(
        (ev) => (ev.getFlags() & flags.MAJOR_FAST) !== 0 && (ev.getFlags() & flags.CHAG) !== 0,
      )
    ) {
      fastStarts = true;
    }
    for (const name of festivalsOn(place, day, locale)) {
      if (!festivals.includes(name)) festivals.push(name);
    }
  }
  return {
    start,
    end: restEnd,
    endRabbenouTam,
    endRule: opinion.restEndRule(ctx),
    rabbenouTamRule: opinion.rabbenouTamRule(ctx),
    lightings,
    eruvTavshilin,
    first,
    last,
    shabbat,
    festivals,
    fastStarts,
  };
}

/**
 * Les allumages des soirs qui suivent l'entrée du bloc.
 *
 * On parcourt les jours de `first` à l'avant-dernier : le soir de chaque jour
 * `d` ouvre `d.next()`, et c'est donc un allumage, sauf pour le premier soir,
 * qui est l'entrée du bloc. Trois règles, selon ce qui s'achève et ce qui
 * commence (voir RestLighting).
 */
function restLightings(
  place: ZmanimPlace,
  first: HDate,
  last: HDate,
  il: boolean,
  opinion: OpinionZmanim,
): RestLighting[] {
  const gloc = geoLocationOf(place);
  const lightings: RestLighting[] = [];
  for (let day = first; day.abs() < last.abs(); day = day.next()) {
    const next = day.next();
    const civil = civilNoon(day);
    const zmanim = new Zmanim(gloc, civil, false);
    const ctx = opinionContext(place, civil);
    let at: Date;
    let rule: RestLighting["rule"];
    if (next.getDay() === 6) {
      // Le Chabbat entre avant la chkia, même pris dans une fête : on allume
      // à la même avance que l'entrée du bloc.
      at = zmanim.sunsetOffset(-candleLightingMinutes(place), true);
      rule = "beforeSunset";
    } else if (day.getDay() === 6) {
      // Le Chabbat s'achève, un Yom Tov commence : on allume à sa sortie.
      at = opinion.restEnd(zmanim, ctx);
      rule = "afterShabbat";
    } else {
      // Deux Yom Tov qui se suivent : à la nuit, depuis une flamme existante.
      at = opinion.yomTovLighting(zmanim, ctx);
      rule = "afterNightfall";
    }
    // L'allumage ouvre le jour suivant : c'est un DÉBUT, il monte à la minute
    // supérieure, sauf celui d'avant la chkia, qui est une limite.
    const rounded = roundUsable(at, rule === "beforeSunset" ? "down" : "up");
    if (rounded) lightings.push({ day: next, at: rounded, rule });
  }
  return lightings;
}

/**
 * Le jour civil où poser l'érouv tavchilin, ou null.
 *
 * Il le faut dès qu'un Yom Tov tombe le vendredi et que le Chabbat le suit :
 * sans l'érouv, on ne peut pas cuisiner le vendredi pour le samedi. On le pose
 * la veille du PREMIER jour du bloc, donc le mercredi pour un Yom Tov de
 * jeudi et vendredi, le jeudi pour un vendredi seul.
 *
 * Kippour ne tombe jamais un vendredi ; Roch Hachana un jeudi et un vendredi
 * est le cas le plus fréquent.
 */
function eruvTavshilinDay(first: HDate, last: HDate, il: boolean): Date | null {
  let needed = false;
  for (let day = first; day.abs() <= last.abs(); day = day.next()) {
    if (day.getDay() !== 5) continue; // vendredi
    if (!isYomTov(day, il)) continue;
    // Le Chabbat doit suivre dans le bloc, sans quoi rien n'est à préparer.
    if (last.abs() > day.abs()) needed = true;
  }
  if (!needed) return null;
  const eve = civilNoon(first);
  eve.setDate(eve.getDate() - 1);
  return eve;
}

/** Un Yom Tov, par opposition à un Chabbat ordinaire. */
function isYomTov(hd: HDate, il: boolean): boolean {
  return holidaysOn(hd, il).some((ev) => (ev.getFlags() & flags.CHAG) !== 0);
}

/** La sortie des étoiles d'un jour hébraïque, en ce lieu, ou null aux latitudes extrêmes. */
export function nightfallOf(place: ZmanimPlace, hd: HDate): Date | null {
  const day = civilNoon(hd);
  const zmanim = new Zmanim(geoLocationOf(place), day, false);
  // Une FIN, comme la sortie des étoiles de la liste du jour : minute
  // supérieure, pour que les deux annoncent la même (voir ZmanRounding).
  return roundUsable(
    opinionZmanim(currentOpinion).tzeit(zmanim, opinionContext(place, day)),
    "up",
  );
}

/**
 * La fenêtre de la bénédiction de la lune pour le mois de `hd`.
 *
 * Elle se compte depuis le MOLAD, la conjonction moyenne, et non depuis le
 * premier du mois : Roch Hodech tombe de zéro à deux jours après lui, et les
 * deux ne coïncident donc pas. On attend sept jours complets depuis le molad
 * (usage séfarade, Ben Ich 'Haï), et on ne dit plus la bénédiction passé la
 * moitié de la lunaison, 14 jours 18 heures 22 minutes après lui (Choul'han
 * Aroukh, Ora'h 'Haïm 426, 3, l'avis que le Rav Ovadia Yossef retient).
 *
 * hebcal calcule les deux, à partir du même molad qu'annonce le Chabbat
 * Mevarekhim : celui de Tichri 5787 est bien « vendredi 20 h 59 et 1 'helek »
 * (`getDow` 5, `getHour` 20, `getMinutes` 59, `getChalakim` 1), soit
 * l'instant `2026-09-11T18:38:06Z`.
 */
export function birkatHalevanaWindow(hd: HDate): { start: Date; end: Date } {
  const molad = new Molad(hd.getFullYear(), hd.getMonth());
  const at = (zdt: { epochMilliseconds: number | bigint }) =>
    new Date(Number(zdt.epochMilliseconds));
  return {
    start: at(molad.getTchilasZmanKidushLevana7Days()),
    end: at(molad.getSofZmanKidushLevanaBetweenMoldos()),
  };
}

/**
 * Dit-on la bénédiction de la lune (Birkat Halevana) la nuit qui ouvre ce
 * jour hébraïque-là ?
 *
 * La nuit qui ouvre `hd` commence à la sortie des étoiles de la veille : on
 * regarde donc si CET INSTANT-LÀ tombe dans la fenêtre du molad. Compter en
 * jours du mois, comme on le faisait (du 8 au 14), déplaçait la fenêtre de
 * zéro à deux jours selon l'écart entre le molad et Roch Hodech : en Nissan
 * 5787, la nuit qui ouvre le 7 était refusée alors que les sept jours étaient
 * écoulés.
 *
 * Deux reports d'usage sont conservés, pour la dire dans la joie : en Av on
 * attend la sortie de Tich'a beAv, en Tichri celle de Kippour.
 */
export function saysBirkatHalevana(place: ZmanimPlace, hd: HDate): boolean {
  if (hd.getMonth() === months.AV && hd.getDate() < 10) return false;
  if (hd.getMonth() === months.TISHREI && hd.getDate() < 11) return false;
  const night = nightfallOf(place, hd.prev());
  if (!night) return false; // Pas de nuit ici ce jour-là : rien à annoncer.
  const { start, end } = birkatHalevanaWindow(hd);
  return night.getTime() >= start.getTime() && night.getTime() <= end.getTime();
}

/**
 * Le dernier jour hébraïque dont la nuit d'ouverture précède la fin de la
 * fenêtre : celui que le bandeau annonce comme date limite.
 *
 * On part du dernier jour possible et on redescend : la fenêtre ne dure jamais
 * plus d'une quinzaine de nuits, et le calcul reste à la fois exact et court.
 */
export function birkatHalevanaLastDay(place: ZmanimPlace, hd: HDate): HDate {
  const { end } = birkatHalevanaWindow(hd);
  let day = new HDate(BIRKAT_HALEVANA_SEARCH_LAST_DAY, hd.getMonth(), hd.getFullYear());
  for (let i = 0; i < BIRKAT_HALEVANA_SEARCH_DAYS; i++) {
    const night = nightfallOf(place, day.prev());
    if (night && night.getTime() <= end.getTime()) return day;
    day = day.prev();
  }
  return day;
}

/**
 * Jusqu'où chercher le dernier jour : la moitié d'une lunaison ne dépasse
 * jamais le 17 du mois, le molad pouvant précéder Roch Hodech de deux jours.
 */
const BIRKAT_HALEVANA_SEARCH_LAST_DAY = 17;
const BIRKAT_HALEVANA_SEARCH_DAYS = 6;

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
 * Ce que `MINOR_HOLIDAY` ramène et qui n'a rien à faire dans un calendrier
 * séfarade.
 *
 *  - **Lel Selihot** (23 Eloul) est un usage ACHKÉNAZE : les Séfarades disent
 *    les Sli'hot depuis Roch Hodech Eloul, et c'est ainsi que l'application
 *    les propose. L'annoncer le 23 contredirait sa propre page ;
 *  - **Roch Hachanah LaBehemot** (1er Eloul), le nouvel an du bétail, et
 *    **'Hag haBanot** (30 Kislev) ne sont pas des jours que le calendrier a à
 *    tenir : ils n'ont ni heures, ni office, ni interdit.
 *
 * Les noms viennent de `holidayDesc`, que hebcal exporte : une chaîne
 * recopiée à la main vieillirait sans bruit le jour où il la renommerait.
 */
const CALENDAR_EXCLUDED = new Set<string>([
  holidayDesc.LEIL_SELICHOT,
  holidayDesc.ROSH_HASHANA_LABEHEMOT,
  holidayDesc.CHAG_HABANOT,
]);

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
    if (CALENDAR_EXCLUDED.has(ev.basename())) continue;
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
    // Sans heure de sortie, le bloc reste annoncé : c'est son entrée qu'on
    // vient chercher, et la disparition du Chabbat serait pire que l'absence
    // d'une de ses deux heures.
    if (!period.end || period.end.getTime() > day.getTime()) periods.push(period);
    abs = period.last.abs() + 1;
  }
  // Une fois dedans, le bloc en cours suffit : annoncer le Chabbat suivant en
  // plein Roch Hachana n'aide personne. C'est avant qu'il faut les deux.
  const inProgress = periods[0] && periods[0].start.getTime() <= day.getTime();
  return inProgress ? periods.slice(0, 1) : periods;
}

/**
 * Un jeûne public et ses heures : celui de Guedalia, le 10 Tévet, Esther, les
 * premiers-nés, le 17 Tamouz, Tich'a beAv. Kippour n'en fait pas partie : il
 * est aussi un Yom Tov, et c'est son cadre de repos qui porte son entrée et
 * sa sortie (voir RestPeriod).
 */
export interface FastPeriod {
  /** Le nom du jeûne, dans la langue demandée. */
  name: string;
  /** Le jour hébraïque du jeûne, tel qu'il est observé (reporté s'il tombe un Chabbat). */
  day: HDate;
  /**
   * Début : l'aube du jour pour les petits jeûnes, le coucher du soleil de
   * la veille pour Tich'a beAv, qui dure de soir à soir comme Kippour.
   *
   * Null quand l'avis suivi ne sait pas donner l'aube ici ce jour-là : au
   * nord de l'Angleterre et en Scandinavie, le soleil ne descend pas à 16,1°
   * au cœur de l'été, et le 17 Tamouz tombe justement là. Le jeûne a lieu
   * quand même : on l'annonce avec sa fin, et la note dit pourquoi son début
   * n'a pas d'heure, plutôt que de le faire disparaître du calendrier (voir
   * ZmanimGap).
   */
  start: Date | null;
  /**
   * Fin : la nuit, telle que l'opinion suivie la compte POUR UN JEÛNE, ce qui
   * n'est ni la sortie des étoiles ordinaire ni celle du Chabbat (voir
   * OpinionZmanim.fastEnd). Sous nos latitudes, une dizaine de minutes plus
   * tôt que la sortie du Chabbat.
   */
  end: Date;
  /**
   * Comment cette fin se compte, pour la note sous le cadre : null quand ce
   * sont les trois étoiles moyennes, un nombre de minutes après la chkia
   * sinon (voir zmanimOpinions, EndRule).
   */
  endRule: EndRule;
  /** Le jeûne commence la veille au soir (Tich'a beAv), non à l'aube. */
  fromEve: boolean;
  /**
   * Ta'anit Bekhorot, la veille de Pessah, qui n'oblige QUE les premiers-nés,
   * et dont un siyoum dispense.
   *
   * Il montait en tête de page comme un jeûne public, avec une fin que
   * personne ne suit, le jour même où tout le monde cherche les limites du
   * 'hamets. Il garde son cadre, mais il ne passe plus devant, et sa note le
   * dit.
   */
  firstbornOnly: boolean;
}

/** Les jeûnes du calendrier, petits et grands, hors la veille (« Erev Tich'a beAv »). */
const FAST_FLAGS = flags.MAJOR_FAST | flags.MINOR_FAST;

/** Le jeûne des premiers-nés, la veille de Pessah (voir FastPeriod.firstbornOnly). */
const FIRSTBORN_FAST = holidayDesc.TAANIT_BECHOROT;

/**
 * Le jeûne observé ce jour hébraïque-là, avec ses heures, ou null s'il n'y en
 * a pas. Le calendrier de hebcal donne déjà le jour OBSERVÉ : un jeûne qui
 * tombe un Chabbat est lu au dimanche (ou au jeudi pour les premiers-nés).
 */
export function fastAt(place: ZmanimPlace, hd: HDate, locale: string): FastPeriod | null {
  const event = holidaysOn(hd, isIsraelPlace(place)).find((ev) => {
    const eventFlags = ev.getFlags();
    return (
      (eventFlags & FAST_FLAGS) !== 0 &&
      (eventFlags & flags.CHAG) === 0 &&
      (eventFlags & flags.EREV) === 0
    );
  });
  if (!event) return null;

  const gloc = geoLocationOf(place);
  const opinion = opinionZmanim(currentOpinion);
  const fastCivil = civilNoon(hd);
  const ctx = opinionContext(place, fastCivil);
  const fastDay = new Zmanim(gloc, fastCivil, false);
  const fromEve = (event.getFlags() & flags.MAJOR_FAST) !== 0;
  let start: Date;
  if (fromEve) {
    const eve = civilNoon(hd);
    eve.setDate(eve.getDate() - 1);
    start = new Zmanim(gloc, eve, false).sunset();
  } else {
    start = opinion.alotHaShachar(fastDay, ctx);
  }
  // Le début est une LIMITE (dernier moment pour manger), la fin une FIN :
  // l'un descend à la minute, l'autre monte (voir ZmanRounding). Sans arrondi,
  // le jeûne se rompait jusqu'à cinquante-neuf secondes trop tôt.
  const end = roundUsable(opinion.fastEnd(fastDay, ctx), "up");
  // La fin, elle, est indispensable : sans elle il n'y a rien à annoncer.
  if (!end) return null;
  return {
    name: event.render(hebcalLocale(locale)),
    day: hd,
    start: roundUsable(start, "down"),
    end,
    endRule: opinion.fastEndRule(ctx),
    fromEve,
    firstbornOnly: event.basename() === FIRSTBORN_FAST,
  };
}

/**
 * Le jeûne qui concerne le jour affiché : celui du jour, tant qu'il n'est pas
 * fini, sinon celui du lendemain. Annoncé dès la veille : c'est le soir
 * d'avant qu'on regarde à quelle heure il commence, pour savoir jusqu'à quand
 * on peut manger.
 *
 * `now` dit l'heure qu'il est, pour ne plus annoncer un jeûne sorti ; null
 * pour un jour parcouru avec les flèches, qui se lit comme une journée
 * entière et garde son jeûne jusqu'à minuit.
 */
export function fastNear(
  place: ZmanimPlace,
  day: Date,
  locale: string,
  now: Date | null = day,
): FastPeriod | null {
  const today = new HDate(dayInPlace(place, day));
  for (const hd of [today, today.next()]) {
    const fast = fastAt(place, hd, locale);
    if (fast && (!now || fast.end.getTime() > now.getTime())) return fast;
  }
  return null;
}

/**
 * Les limites du 'hamets, la veille de Pessah.
 *
 * Deux heures, et non une : on cesse de MANGER du 'hamets à la fin de la
 * quatrième heure du jour, on cesse d'en POSSÉDER à la fin de la cinquième.
 * Ce sont les mêmes heures zmaniyot que partout ailleurs sur la page, et les
 * deux avis les découpent donc différemment : le cadre donne les deux, comme
 * il le fait pour la fin du Chéma et de la Amida.
 *
 * Le 14 Nissan tombe parfois un Chabbat (en 5785, puis en 5805). On ne brûle
 * pas le 'hamets un Chabbat : la destruction se fait alors le VENDREDI, avant
 * la cinquième heure de ce vendredi-là, et ce qui reste le Chabbat matin
 * s'annule de la voix, avant la cinquième heure du Chabbat. Le cadre porte
 * donc les trois heures ces années-là, sans quoi il annoncerait un feu le
 * jour où l'on n'en allume pas.
 */
export interface ChametzDeadlines {
  /** Le 14 Nissan, veille de Pessah. */
  day: HDate;
  /** Fin de la consommation : la quatrième heure, Maguen Avraham puis Gaon. */
  eatingMGA: Date;
  eating: Date;
  /**
   * La cinquième heure du 14 Nissan : fin de la destruction une année
   * ordinaire, fin de l'annulation quand ce jour-là est un Chabbat.
   */
  disposalMGA: Date;
  disposal: Date;
  /** Le 14 Nissan est un Chabbat : on n'y brûle pas, on annule. */
  onShabbat: boolean;
  /**
   * La cinquième heure du VENDREDI, dernière limite pour brûler ces
   * années-là. Null les autres, où la destruction se fait le jour même.
   */
  burningEveMGA: Date | null;
  burningEve: Date | null;
}

/** Le jour des limites : le 14 Nissan, veille de Pessah. */
const CHAMETZ_DAY = 14;

/** Les limites du 'hamets de ce jour hébraïque, ou null si ce n'est pas le 14 Nissan. */
export function chametzAt(place: ZmanimPlace, hd: HDate): ChametzDeadlines | null {
  if (hd.getMonth() !== months.NISAN || hd.getDate() !== CHAMETZ_DAY) return null;

  const gloc = geoLocationOf(place);
  const opinion = opinionZmanim(currentOpinion);
  const erevCivil = civilNoon(hd);
  const ctx = opinionContext(place, erevCivil);
  const erev = new Zmanim(gloc, erevCivil, false);
  const eatingMGA = opinion.sofZmanTfillaMGA(erev, ctx);
  const eating = erev.sofZmanTfilla();
  const disposalMGA = opinion.sofZmanBiurChametzMGA(erev, ctx);
  const disposal = erev.sofZmanBiurChametzGRA();
  // Les quatre heures du jour vont ensemble : si l'une manque, le cadre
  // n'aurait que des trous à montrer.
  if (![eatingMGA, eating, disposalMGA, disposal].every(isUsable)) return null;

  const onShabbat = hd.getDay() === 6;
  const fridayCivil = onShabbat ? civilNoon(hd.prev()) : null;
  const friday = fridayCivil ? new Zmanim(gloc, fridayCivil, false) : null;
  const burningEveMGA =
    friday && fridayCivil
      ? opinion.sofZmanBiurChametzMGA(friday, opinionContext(place, fridayCivil))
      : null;
  const burningEve = friday ? friday.sofZmanBiurChametzGRA() : null;

  // Quatre LIMITES : toutes descendent à la minute (voir ZmanRounding). On ne
  // gagne pas une minute pour finir son pain.
  return {
    day: hd,
    eatingMGA: roundMinute(eatingMGA, "down"),
    eating: roundMinute(eating, "down"),
    disposalMGA: roundMinute(disposalMGA, "down"),
    disposal: roundMinute(disposal, "down"),
    onShabbat,
    burningEveMGA: roundUsable(burningEveMGA, "down"),
    burningEve: roundUsable(burningEve, "down"),
  };
}

/**
 * Les limites du 'hamets qui concernent le jour affiché : celles du jour, ou
 * celles du lendemain. Annoncées dès la veille comme le jeûne : le 13 Nissan
 * au soir on cherche l'heure du lendemain matin, et les années où le 14 tombe
 * un Chabbat, c'est justement ce vendredi-là qu'il faut brûler.
 *
 * `now` dit l'heure qu'il est, pour ne plus annoncer des limites passées ;
 * null pour un jour parcouru avec les flèches, qui se lit comme une journée
 * entière.
 */
export function chametzNear(
  place: ZmanimPlace,
  day: Date,
  now: Date | null = day,
): ChametzDeadlines | null {
  const today = new HDate(dayInPlace(place, day));
  for (const hd of [today, today.next()]) {
    const deadlines = chametzAt(place, hd);
    if (!deadlines) continue;
    // Passé la dernière des deux cinquièmes heures, il n'y a plus rien à
    // annoncer : le 'hamets est détruit, ou il aurait dû l'être.
    const last = Math.max(
      deadlines.disposal.getTime(),
      deadlines.burningEve?.getTime() ?? 0,
      deadlines.disposalMGA.getTime(),
    );
    if (!now || last > now.getTime()) return deadlines;
  }
  return null;
}

/**
 * Dit-on le tahanoun ce jour hébraïque-là ?
 *
 * - "full" : à Cha'harit et à Min'ha (jour ordinaire) ;
 * - "shacharitOnly" : le matin seulement, veille d'un jour sans tahanoun
 *   (dont chaque vendredi, veille de Chabbat), sauf les trois lendemains qui
 *   le laissent à Min'ha (voir saidTachanun) ;
 * - "none" : pas du tout (Roch Hodech, fêtes, tout Nissan…).
 *
 * Le Chabbat renvoie null : le tahanoun n'y existe pas, la question ne se
 * pose pas (le champ mincha de hebcal y décrit le Tsidkatekha, pas un
 * tahanoun, l'afficher sèmerait la confusion).
 */
export type TachanunStatus = "full" | "shacharitOnly" | "none";

export function tachanunStatus(place: ZmanimPlace, hd: HDate): TachanunStatus | null {
  if (hd.getDay() === 6) return null;
  const said = saidTachanun(hd, isIsraelPlace(place));
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

/**
 * Le nom d'un mois hébraïque, dans la langue de l'interface.
 *
 * L'année compte : le douzième mois s'appelle « Adar » dans une année
 * ordinaire et « Adar I » dans une année à treize mois. Le français passe par
 * la table ci-dessus plutôt que par hebcal, qui écrit « H̲echvan » avec une
 * marque diacritique que le reste du site n'emploie pas.
 */
export function hebrewMonthName(month: number, year: number, locale: string): string {
  const name = HDate.getMonthName(month, year);
  if (locale === "he") return Locale.gettext(name, "he");
  if (locale === "fr") return FRENCH_MONTHS[name] ?? name;
  return name;
}

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
  const short = dateTimeFormat("en-US", { timeZone: place.tzid, weekday: "short" }).format(date);
  return WEEKDAYS.indexOf(short);
}

/** Deux instants tombent-ils le même jour civil, au lieu affiché ? */
export function sameCivilDay(place: ZmanimPlace, a: Date, b: Date): boolean {
  return dayInPlace(place, a).getTime() === dayInPlace(place, b).getTime();
}

/** "06:27" dans le fuseau du lieu, jamais celui du navigateur. */
export function formatZmanTime(date: Date, tzid: string, locale: string): string {
  return dateTimeFormat(locale, {
    timeZone: tzid,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** "vendredi 7 août", le jour d'un horaire, dans le fuseau du lieu. */
export function formatZmanDay(date: Date, tzid: string, locale: string): string {
  return dateTimeFormat(locale, {
    timeZone: tzid,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/**
 * Le jour d'un MARQUEUR DE JOUR, et non d'un instant.
 *
 * Certains champs ne portent pas une heure mais une DATE : le jour du Chabbat
 * d'un bloc, celui de l'érouv tavchilin, celui d'un jeûne dont l'aube ne se
 * calcule pas. Ils sont posés au midi local de la machine (voir `civilNoon` et
 * `HDate.greg`), et c'est dans ce repère-là qu'il faut les relire.
 *
 * Les passer à `formatZmanDay`, qui les rendrait dans le fuseau DU LIEU, les
 * déplacerait d'un jour dès que la machine et le lieu sont assez éloignés : un
 * appareil réglé sur Auckland qui regarde New York lisait « vendredi » là où
 * le marqueur dit samedi. C'est le même piège que le point 3.1 de l'audit, à
 * l'échelle du jour plutôt que de l'heure.
 */
export function formatMarkerDay(date: Date, locale: string): string {
  return dateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}
