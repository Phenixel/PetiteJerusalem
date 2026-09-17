import type { Zmanim } from "@hebcal/core";
import { devicePreference } from "./devicePreference";

/**
 * L'opinion suivie pour le calcul des horaires.
 *
 * Un zman n'a pas une heure, il a une DÉFINITION, et les luhot ne retiennent
 * pas la même. Deux familles se partagent le public de l'application, et ce
 * module les tient toutes deux, avec leurs paramètres, à un seul endroit :
 *
 *  - **Rav Meïr Posen** (`Ohr Meïr`), le calcul par DEGRÉS du soleil sous
 *    l'horizon. C'est celui des calendriers d'Europe, imprimé en France dans
 *    le Patah Eliyahou, et c'est celui que l'application suit depuis toujours
 *    (ce sont les valeurs par défaut de hebcal) : l'aube quand le soleil est
 *    à 16,1° sous l'horizon, le talith à 11,5°, la sortie des étoiles à 8,5°,
 *    le Maguen Avraham sur ce même 16,1°, de l'aube à la nuit, et l'avis de
 *    Rabbénou Tam 72 minutes fixes après la chkia.
 *  - **Rav Ovadia Yossef**, qui n'est pas un jeu de paramètres mais une
 *    SOURCE : le calendrier `Rabbi Ovadiah Yosef` d'Elyahu Jacobi, écrit avec
 *    le Rav Benizri. Et cette source change de luah selon le pays, parce que
 *    le Rav Ovadia Yossef ne s'est jamais prononcé sur la diaspora :
 *      - **en Israël**, le luah `Or Ha'Haïm`, dont le Rav Ovadia Yossef a
 *        suivi la rédaction et qu'il a lui-même utilisé : tout se compte en
 *        MINUTES ZMANIYOT, proportionnelles à la longueur du jour ;
 *      - **ailleurs**, le luah `Amudei Horaah` du Rav Léor Dahan, confirmé
 *        depuis par le Rav Yits'hak Yossef : les minutes zmaniyot de l'aube et
 *        de la nuit y sont d'abord MESURÉES EN DEGRÉS à l'équinoxe, au lieu
 *        même, puis appliquées au jour demandé. Sans cela, 72 minutes
 *        zmaniyot d'aube donnent 96 minutes avant le lever à Paris en juin,
 *        quand le luah en imprime près de 123 : la courbure de la Terre ne se
 *        laisse pas oublier en montant vers le nord.
 *
 * Le LIEU décide donc, et non un réglage : c'est ce que fait la source
 * elle-même, qui pose son luah au premier lancement d'après la position
 * (`LuachAmudeiHoraah = !inIsrael`). Voir `docs/plan-horaires-2026-09.md`,
 * principe directeur.
 *
 * Une minute zmanit vaut un soixantième d'heure zmanit, et l'heure zmanit du
 * Gaon de Vilna vaut un douzième du temps qui sépare le lever du coucher :
 * elle dure donc plus longtemps en été qu'en hiver, et l'écart entre les deux
 * opinions change avec la saison et la latitude.
 *
 * Les horaires que les deux opinions calculent pareil (lever, coucher, hatsot,
 * fin du Chéma et de la Amida selon le Gaon de Vilna, min'ha ketana) ne sont
 * pas repris ici : `zmanimService` les lit directement de hebcal.
 *
 * Trois sorties, et non une seule : la sortie des étoiles ordinaire, celle du
 * Chabbat et celle des jeûnes ne tombent pas ensemble. Le Chabbat se relâche
 * tard, on ne joue pas avec un interdit de la Torah ; un jeûne, lui, finit à
 * la nuit sans cette marge. Chaque opinion donne donc ses trois heures, et
 * confondre les deux dernières fait attendre dix minutes de trop à jeun.
 *
 * Les fonctions Java correspondantes du calendrier source, pour qui veut
 * recouper : `getAlotHashachar`, `getMisheyakir60ZmaniyotMinutes`,
 * `getTzeit`, `getTzeitLChumra`, `getTzeitShabbatAmudeiHoraah`,
 * `getTzaisAteretTorah`, `getTzais72ZmanisAmudeiHoraahLkulah`,
 * `getPlagHaminchaYalkutYosef`, `getMinchaGedolaGreaterThan30` et
 * `getPercentOfShaahZmanisFromDegrees` (`ROZmanimCalendar.java`), assemblées
 * par `ZmanimFactory.java`.
 */

export type ZmanimOpinion = "posen" | "ovadia";

/** Les opinions proposées, dans l'ordre où l'écran de réglage les présente. */
export const ZMANIM_OPINIONS: ZmanimOpinion[] = ["posen", "ovadia"];

/**
 * L'opinion d'origine : celle que l'application a toujours calculée. La
 * changer déplacerait sous les yeux des horaires que des gens lisent depuis
 * des mois.
 */
export const DEFAULT_ZMANIM_OPINION: ZmanimOpinion = "posen";

/** Une opinion lue d'un stockage ou d'un compte, ou null si ce n'en est pas une. */
export function parseZmanimOpinion(value: unknown): ZmanimOpinion | null {
  return ZMANIM_OPINIONS.includes(value as ZmanimOpinion) ? (value as ZmanimOpinion) : null;
}

/**
 * Le choix, gardé sur l'appareil (voir devicePreference).
 *
 * Il vit ici, et non dans le composable qui règle l'écran : les horaires se
 * calculent au premier rendu, d'une dizaine d'endroits, et `zmanimService` a
 * besoin de le LIRE tout de suite, sans quoi la page s'ouvrirait sur les
 * heures d'une opinion puis sauterait sur celles de l'autre.
 */
export const zmanimOpinionStore = devicePreference<ZmanimOpinion>(
  "pj_zmanim_opinion",
  parseZmanimOpinion,
  (opinion) => opinion,
);

/**
 * Ce que le LIEU apporte au calcul d'une opinion.
 *
 * Un avis n'est pas un jeu de paramètres fixes : c'est un luah, et un luah
 * change de règle selon le pays. Chaque fonction d'opinion reçoit donc ce
 * contexte, que `zmanimService` construit pour le jour et le lieu affichés
 * (voir `opinionContext`). Les fonctions du Rav Posen l'ignorent.
 */
export interface OpinionContext {
  /** Israël ou non : l'Or Ha'Haïm ici, l'Amudei Horaah ailleurs. */
  il: boolean;
  /**
   * Le même lieu au 17 mars de l'année du jour calculé.
   *
   * C'est l'étalon de l'Amudei Horaah : on y mesure, une fois pour l'année,
   * quelle PART d'heure zmanit occupe la descente du soleil à un angle donné,
   * et c'est cette part qu'on applique ensuite à l'heure zmanit du jour
   * demandé. Null quand l'avis suivi n'en a pas besoin.
   */
  equinox: Zmanim | null;
  /** Ce qui identifie cet équinoxe (lieu et année) : sert à mémoïser les parts. */
  equinoxKey: string;
  /**
   * Le milieu de la nuit qui SUIT le jour calculé, quand il se calcule.
   *
   * L'Amudei Horaah ne fait jamais sortir le Chabbat plus tard que lui : au
   * nord, l'été, le soleil peut n'atteindre 7,165° qu'au petit matin, et il
   * n'aurait aucun sens de dépasser hatsot de la nuit.
   */
  solarMidnight: (() => Date) | null;
}

/**
 * Comment une sortie se compte, pour que la note sous le cadre dise
 * exactement ce que le calcul fait.
 *
 * Sans cette règle typée, la note annonçait « à la sortie des étoiles » là où
 * le cadre affichait quarante minutes après la chkia : deux phrases pour une
 * seule heure, et celle qui était lue n'était pas celle qui était calculée.
 */
export type EndRule =
  /** Le soleil à `degrees` sous l'horizon, mesuré le jour même. */
  | { kind: "degrees"; degrees: number }
  /** Un nombre de minutes FIXES après la chkia. */
  | { kind: "fixed"; minutes: number }
  /** Un nombre de minutes ZMANIYOT après la chkia. */
  | { kind: "zmaniyot"; minutes: number }
  /**
   * Les minutes zmaniyot que l'Amudei Horaah MESURE sur `degrees` à
   * l'équinoxe, au lieu même, avant de les appliquer au jour demandé. Ce n'est
   * pas l'angle du jour : la note ne doit pas le faire croire.
   */
  | { kind: "equinoxDegrees"; degrees: number }
  /** L'Amudei Horaah : 7,165° sous l'horizon, jamais moins de 20 minutes. */
  | { kind: "amudeiHoraah"; degrees: number; floorMinutes: number };

/** Comment Rabbénou Tam se compte, pour la note qui l'accompagne. */
export type RabbenouTamRule =
  /** 72 minutes fixes après la chkia. */
  | "fixed"
  /** 72 minutes zmaniyot après la chkia. */
  | "zmaniyot"
  /** La plus tôt des deux, ce qu'imprime l'Amudei Horaah. */
  | "earliest";

/** Les horaires qui dépendent de l'opinion suivie, et du lieu. */
export interface OpinionZmanim {
  /** Aube. */
  alotHaShachar(z: Zmanim, ctx: OpinionContext): Date;
  /** Talith et tefilines. */
  misheyakir(z: Zmanim, ctx: OpinionContext): Date;
  /** Fin du Chéma selon le Maguen Avraham. */
  sofZmanShmaMGA(z: Zmanim, ctx: OpinionContext): Date;
  /** Fin de la Amida selon le Maguen Avraham. */
  sofZmanTfillaMGA(z: Zmanim, ctx: OpinionContext): Date;
  /**
   * Fin de la cinquième heure selon le Maguen Avraham : la veille de Pessah,
   * dernière limite pour détruire le 'hamets (voir zmanimService, chametzAt).
   * La quatrième heure, qui clôt la consommation, est déjà celle de la Amida.
   */
  sofZmanBiurChametzMGA(z: Zmanim, ctx: OpinionContext): Date;
  /** Min'ha guedola. */
  minchaGedola(z: Zmanim, ctx: OpinionContext): Date;
  /** Plag hamin'ha. */
  plagHaMincha(z: Zmanim, ctx: OpinionContext): Date;
  /** Sortie des étoiles. */
  tzeit(z: Zmanim, ctx: OpinionContext): Date;
  /** Sortie selon Rabbénou Tam. */
  rabbenouTam(z: Zmanim, ctx: OpinionContext): Date;
  /**
   * Sortie du Chabbat et des fêtes, qui ne se lit pas toujours sur la sortie
   * des étoiles ordinaire : voir la note de `OVADIA`.
   */
  restEnd(z: Zmanim, ctx: OpinionContext): Date;
  /**
   * Fin des jeûnes publics, qui ne se lit sur aucune des deux autres : la
   * sortie du Chabbat attend une marge qu'un jeûne n'a pas à attendre, et la
   * sortie des étoiles ordinaire ne clôt pas un jeûne. Voir les notes de
   * `POSEN` et de `OVADIA`.
   */
  fastEnd(z: Zmanim, ctx: OpinionContext): Date;
  /**
   * L'allumage du deuxième soir d'un Yom Tov, depuis une flamme déjà allumée.
   * Ce n'est ni la sortie des étoiles ordinaire ni celle du Chabbat : le
   * calendrier source y met la fin de jeûne (tsét le'houmra).
   */
  yomTovLighting(z: Zmanim, ctx: OpinionContext): Date;
  /** Comment la sortie du repos se compte, pour la note qui l'explique. */
  restEndRule(ctx: OpinionContext): EndRule;
  /** Comment la fin des jeûnes se compte, même raison. */
  fastEndRule(ctx: OpinionContext): EndRule;
  /** Comment Rabbénou Tam se compte, même raison. */
  rabbenouTamRule(ctx: OpinionContext): RabbenouTamRule;
}

/** Un horaire que ce lieu et ce jour ne permettent pas de calculer. */
const unknownTime = (): Date => new Date(NaN);

// ---- Rav Meïr Posen : les degrés ----------------------------------------

const POSEN: OpinionZmanim = {
  alotHaShachar: (z) => z.alotHaShachar(), // 16,1°
  misheyakir: (z) => z.misheyakir(), // 11,5°
  // Le Maguen Avraham sur l'aube et la nuit de cette opinion : le jour court
  // de 16,1° avant le lever à 16,1° après la chkia, et se divise en douze.
  // Les mêmes degrés que l'aube affichée juste au-dessus, donc, et non les 72
  // minutes fixes que hebcal calcule par défaut : celles-ci placeraient l'aube
  // du calcul une demi-heure après celle du cadre, et la fin du Chéma une
  // douzaine de minutes après l'heure des calendriers d'Europe.
  sofZmanShmaMGA: (z) => z.sofZmanShmaMGA16Point1(),
  sofZmanTfillaMGA: (z) => z.sofZmanTfillaMGA16Point1(),
  sofZmanBiurChametzMGA: (z) => posenMgaHours(z, 5),
  minchaGedola: (z) => z.minchaGedola(),
  plagHaMincha: (z) => z.plagHaMincha(),
  tzeit: (z) => z.tzeit(), // 8,5°, trois petites étoiles selon le Ohr Meïr
  rabbenouTam: (z) => z.sunsetOffset(RABBENOU_TAM_MINUTES, true),
  restEnd: (z) => z.tzeit(),
  fastEnd: (z) => z.tzeit(POSEN_FAST_END_DEGREES),
  // Le deuxième soir d'un Yom Tov s'allume à la nuit : cette opinion n'a
  // qu'une nuit, celle des trois petites étoiles.
  yomTovLighting: (z) => z.tzeit(),
  restEndRule: () => ({ kind: "degrees", degrees: POSEN_TZEIT_DEGREES }),
  fastEndRule: () => ({ kind: "degrees", degrees: POSEN_FAST_END_DEGREES }),
  rabbenouTamRule: () => "fixed",
};

/** Minutes après la chkia de la sortie selon Rabbénou Tam, en minutes fixes. */
const RABBENOU_TAM_MINUTES = 72;

/** Les degrés du jour du Maguen Avraham de cette opinion, matin et soir. */
const POSEN_MGA_DEGREES = 16.1;

/** Degrés de la sortie des étoiles : trois PETITES étoiles, le défaut de hebcal. */
const POSEN_TZEIT_DEGREES = 8.5;

/**
 * Une heure du jour du Maguen Avraham compté en degrés.
 *
 * hebcal nomme les trois et les quatre heures (`sofZmanShmaMGA16Point1`,
 * `sofZmanTfillaMGA16Point1`), et c'est elles qu'on appelle plus haut ; il n'a
 * pas de nom pour les cinq, dont la veille de Pessah a besoin. Le calcul est
 * le même, à l'identique de ce que font ces deux-là : le jour va de 16,1°
 * avant le lever à 16,1° après la chkia, on le divise en douze, et on tronque
 * à la milliseconde comme hebcal tronque.
 */
function posenMgaHours(z: Zmanim, hours: number): Date {
  const [alot, hour] = z.getTemporalHourByDeg(POSEN_MGA_DEGREES);
  return new Date(alot.getTime() + Math.floor(hour * hours));
}

/**
 * Degrés du soleil sous l'horizon à la fin des jeûnes : trois étoiles
 * MOYENNES, là où la sortie du Chabbat en attend trois petites (8,5°).
 *
 * Le Choulhan Aroukh fait attendre les trois petites étoiles pour relâcher le
 * Chabbat, faute de savoir reconnaître les moyennes à coup sûr ; pour un jeûne,
 * qui n'est pas un interdit de la Torah, les trois moyennes suffisent. C'est
 * l'heure que donnent les calendriers, une dizaine de minutes plus tôt sous
 * nos latitudes : dix minutes à jeun pour rien, sinon.
 */
const POSEN_FAST_END_DEGREES = 7.083;

// ---- Rav Ovadia Yossef : l'Or Ha'Haïm en Israël, l'Amudei Horaah ailleurs -

/** L'heure zmanit du Gaon de Vilna, en millisecondes : un douzième du jour. */
function dayHour(z: Zmanim): number {
  return (z.sunset().getTime() - z.sunrise().getTime()) / 12;
}

/** Le lever, décalé d'un nombre de minutes zmaniyot (négatif : avant). */
function fromSunrise(z: Zmanim, minutes: number): Date {
  return new Date(z.sunrise().getTime() + (minutes / 60) * dayHour(z));
}

/** La chkia, décalée d'un nombre de minutes zmaniyot. */
function fromSunset(z: Zmanim, minutes: number): Date {
  return new Date(z.sunset().getTime() + (minutes / 60) * dayHour(z));
}

// -- Or Ha'Haïm (Israël) --

/** Minutes zmaniyot de l'aube avant le lever, et de Rabbénou Tam après la chkia. */
const OVADIA_ALOT_MINUTES = 72;
/**
 * Minutes zmaniyot du talith avant le lever.
 *
 * Soixante, et non soixante-six : le calendrier source nomme les 66
 * `getMisheyakir66ZmaniyotMinutes` et les réserve à qui est « in great need »,
 * derrière une ligne à part. L'heure ordinaire du talith, celle que sa liste
 * du jour affiche sans qualificatif, est `getMisheyakir60ZmaniyotMinutes`.
 */
const OVADIA_MISHEYAKIR_MINUTES = 60;
/** Minutes zmaniyot de la sortie des étoiles après la chkia (trois quarts de mil). */
const OVADIA_TZEIT_MINUTES = 13.5;
/** Minutes zmaniyot de plag hamin'ha avant la sortie (une heure et quart, Yalkout Yossef). */
const OVADIA_PLAG_MINUTES = 75;
/** Min'ha guedola : une demi-heure après hatsot, fixe ou zmanit, la plus tardive. */
const OVADIA_MINCHA_GEDOLA_MINUTES = 30;
/**
 * Minutes FIXES après la chkia de la sortie du Chabbat et des fêtes en Israël.
 *
 * Trente, ce que le Rav Ovadia Yossef tenait pour Israël, et ce que le
 * calendrier source pose là-bas (`setAteretTorahSunsetOffset(30)` quand
 * `inIsrael`). La sortie des étoiles de cet avis, 13,5 minutes zmaniyot, est
 * bien trop tôt pour finir le Chabbat.
 */
const OVADIA_REST_END_MINUTES = 30;
/**
 * Minutes ZMANIYOT après la chkia de la fin des jeûnes en Israël.
 *
 * Zmaniyot, et non fixes : `getTzeitLChumra()` compte
 * `20 * (shaahZmanisGra / 60)`. Vingt minutes fixes rompaient le jeûne jusqu'à
 * sept minutes trop tôt l'été à Paris, et le faisaient attendre six minutes
 * de trop l'hiver ; à l'équinoxe l'écart est nul, ce qui l'avait caché.
 */
const OVADIA_FAST_END_MINUTES = 20;

// -- Amudei Horaah (hors d'Israël) --

/**
 * Les angles que l'Amudei Horaah mesure à l'équinoxe.
 *
 * Le principe (`getPercentOfShaahZmanisFromDegrees`) : au lieu même, le
 * 17 mars, on regarde quelle part d'heure zmanit sépare le lever du moment où
 * le soleil est à tel angle sous l'horizon ; cette part, mesurée une fois pour
 * l'année, s'applique ensuite à l'heure zmanit du jour demandé. À Jérusalem le
 * 17 mars, elle vaut 72 minutes zmaniyot pour 16,04° : la méthode est calibrée
 * pour retomber sur l'Or Ha'Haïm là où il s'applique.
 */
const AMUDEI_ALOT_DEGREES = 16.04;
/** Sortie des étoiles ordinaire. */
const AMUDEI_TZEIT_DEGREES = 3.7;
/** Fin des jeûnes (tsét le'houmra). */
const AMUDEI_FAST_END_DEGREES = 5.075;
/**
 * Sortie du Chabbat et des fêtes.
 *
 * L'angle auquel le soleil se trouve toujours à trente minutes ou plus après
 * la chkia, toute l'année, au point le plus au nord d'Israël : le Rav Dahan
 * l'a cherché pour retrouver partout les trente minutes que le Rav Ovadia
 * Yossef tenait là-bas.
 */
const AMUDEI_REST_END_DEGREES = 7.165;
/** Jamais moins de vingt minutes après la chkia, quel que soit l'angle atteint. */
const AMUDEI_REST_END_FLOOR_MINUTES = 20;
/** Le talith occupe les dix douzièmes de l'aube : 60 minutes zmaniyot sur 72. */
const AMUDEI_MISHEYAKIR_SHARE = 60 / 72;

/**
 * La part d'heure zmanit qu'occupe, à l'équinoxe et au lieu même, la descente
 * du soleil à `degrees` sous l'horizon. Null quand l'angle n'y est pas atteint.
 *
 * Mémoïsée : chaque horaire de la journée la redemande, et elle ne dépend que
 * du lieu, de l'année et de l'angle. Sans cela, une page d'horaires relancerait
 * une dizaine de calculs solaires pour la même valeur.
 */
function equinoxShare(ctx: OpinionContext, degrees: number, evening: boolean): number | null {
  if (!ctx.equinox) return null;
  const key = `${ctx.equinoxKey}|${degrees}|${evening}`;
  const cached = shareCache.get(key);
  if (cached !== undefined) return cached;

  const sunrise = ctx.equinox.sunrise();
  const sunset = ctx.equinox.sunset();
  const twilight = evening
    ? ctx.equinox.tzeit(degrees)
    : ctx.equinox.timeAtAngle(degrees, true);
  const usable = [sunrise, sunset, twilight].every((date) => !Number.isNaN(date.getTime()));
  const share = usable
    ? (evening ? twilight.getTime() - sunset.getTime() : sunrise.getTime() - twilight.getTime()) /
      ((sunset.getTime() - sunrise.getTime()) / 12)
    : null;

  if (shareCache.size >= SHARE_CACHE_LIMIT) {
    shareCache.delete(shareCache.keys().next().value as string);
  }
  shareCache.set(key, share);
  return share;
}

/** Quelques lieux, quelques années, quelques angles : au-delà, on recalcule. */
const SHARE_CACHE_LIMIT = 64;
const shareCache = new Map<string, number | null>();

/**
 * Le lever ou la chkia du jour, décalé de la part d'équinoxe mesurée pour cet
 * angle : c'est la façon dont l'Amudei Horaah rend ses minutes zmaniyot.
 */
function fromEquinox(
  z: Zmanim,
  ctx: OpinionContext,
  degrees: number,
  evening: boolean,
  share = 1,
): Date {
  const measured = equinoxShare(ctx, degrees, evening);
  if (measured === null) return unknownTime();
  const offset = measured * share * dayHour(z);
  return evening
    ? new Date(z.sunset().getTime() + offset)
    : new Date(z.sunrise().getTime() - offset);
}

/** La sortie du Chabbat de l'Amudei Horaah : 7,165°, au moins 20 minutes, au plus hatsot. */
function amudeiRestEnd(z: Zmanim, ctx: OpinionContext): Date {
  const tzeit = z.tzeit(AMUDEI_REST_END_DEGREES);
  if (Number.isNaN(tzeit.getTime())) return tzeit;
  const floor = new Date(z.sunset().getTime() + AMUDEI_REST_END_FLOOR_MINUTES * 60_000);
  if (floor.getTime() > tzeit.getTime()) return floor;
  const midnight = ctx.solarMidnight?.();
  if (midnight && !Number.isNaN(midnight.getTime()) && midnight.getTime() < tzeit.getTime()) {
    return midnight;
  }
  return tzeit;
}

const OVADIA: OpinionZmanim = {
  alotHaShachar: (z, ctx) =>
    ctx.il
      ? fromSunrise(z, -OVADIA_ALOT_MINUTES)
      : fromEquinox(z, ctx, AMUDEI_ALOT_DEGREES, false),
  misheyakir: (z, ctx) =>
    ctx.il
      ? fromSunrise(z, -OVADIA_MISHEYAKIR_MINUTES)
      : fromEquinox(z, ctx, AMUDEI_ALOT_DEGREES, false, AMUDEI_MISHEYAKIR_SHARE),
  // Le Maguen Avraham ne change pas d'un mode à l'autre : le calendrier source
  // garde `getSofZmanShmaMGA72MinutesZmanis` même en Amudei Horaah, où seules
  // l'aube et la nuit AFFICHÉES passent par les degrés.
  sofZmanShmaMGA: (z) => mgaHours(z, 3),
  sofZmanTfillaMGA: (z) => mgaHours(z, 4),
  sofZmanBiurChametzMGA: (z) => mgaHours(z, 5),
  minchaGedola: (z) => {
    // La demi-heure zmanit est plus longue que l'autre en été, plus courte en
    // hiver : on retient la plus tardive des deux, par rigueur.
    const chatzot = z.chatzot().getTime();
    const fixed = chatzot + OVADIA_MINCHA_GEDOLA_MINUTES * 60_000;
    const zmanit = chatzot + (OVADIA_MINCHA_GEDOLA_MINUTES / 60) * dayHour(z);
    return new Date(Math.max(fixed, zmanit));
  },
  // Une heure et quart zmanit avant la sortie des étoiles : la formule ne
  // change pas, mais la sortie dont elle part est celle du mode suivi.
  plagHaMincha: (z, ctx) =>
    new Date(OVADIA.tzeit(z, ctx).getTime() - (OVADIA_PLAG_MINUTES / 60) * dayHour(z)),
  tzeit: (z, ctx) =>
    ctx.il
      ? fromSunset(z, OVADIA_TZEIT_MINUTES)
      : fromEquinox(z, ctx, AMUDEI_TZEIT_DEGREES, true),
  rabbenouTam: (z, ctx) => {
    const zmaniyot = fromSunset(z, OVADIA_ALOT_MINUTES);
    if (ctx.il) return zmaniyot;
    // Hors d'Israël, l'Amudei Horaah imprime la plus TÔT des deux : au nord,
    // l'été, 72 minutes zmaniyot repoussent Rabbénou Tam bien au-delà de ce
    // que les poskim demandent d'attendre.
    const fixed = z.sunsetOffset(RABBENOU_TAM_MINUTES, true);
    if (Number.isNaN(zmaniyot.getTime())) return fixed;
    if (Number.isNaN(fixed.getTime())) return zmaniyot;
    return fixed.getTime() < zmaniyot.getTime() ? fixed : zmaniyot;
  },
  restEnd: (z, ctx) =>
    ctx.il
      ? new Date(z.sunset().getTime() + OVADIA_REST_END_MINUTES * 60_000)
      : amudeiRestEnd(z, ctx),
  fastEnd: (z, ctx) =>
    ctx.il
      ? fromSunset(z, OVADIA_FAST_END_MINUTES)
      : fromEquinox(z, ctx, AMUDEI_FAST_END_DEGREES, true),
  // Yom Tov qui entre sur un Yom Tov : le calendrier source y met le tsét
  // le'houmra, celui-là même qui clôt les jeûnes.
  yomTovLighting: (z, ctx) => OVADIA.fastEnd(z, ctx),
  restEndRule: (ctx) =>
    ctx.il
      ? { kind: "fixed", minutes: OVADIA_REST_END_MINUTES }
      : {
          kind: "amudeiHoraah",
          degrees: AMUDEI_REST_END_DEGREES,
          floorMinutes: AMUDEI_REST_END_FLOOR_MINUTES,
        },
  fastEndRule: (ctx) =>
    ctx.il
      ? { kind: "zmaniyot", minutes: OVADIA_FAST_END_MINUTES }
      : { kind: "equinoxDegrees", degrees: AMUDEI_FAST_END_DEGREES },
  rabbenouTamRule: (ctx) => (ctx.il ? "zmaniyot" : "earliest"),
};

/**
 * Le Maguen Avraham de cette opinion : le jour va de l'aube (72 minutes
 * zmaniyot avant le lever) à la sortie de Rabbénou Tam (72 après la chkia), et
 * se divise en douze.
 */
function mgaHours(z: Zmanim, hours: number): Date {
  const alot = fromSunrise(z, -OVADIA_ALOT_MINUTES).getTime();
  const tzeit = fromSunset(z, OVADIA_ALOT_MINUTES).getTime();
  return new Date(alot + ((tzeit - alot) / 12) * hours);
}

const BY_OPINION: Record<ZmanimOpinion, OpinionZmanim> = {
  posen: POSEN,
  ovadia: OVADIA,
};

/** Les calculs de l'opinion demandée. */
export function opinionZmanim(opinion: ZmanimOpinion): OpinionZmanim {
  return BY_OPINION[opinion];
}
