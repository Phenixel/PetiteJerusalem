import type { Zmanim } from "@hebcal/core";

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
 *    l'avis de Rabbénou Tam 72 minutes fixes après la chkia.
 *  - **Rav Ovadia Yossef** (luah `Or Ha'Haïm`, dont il a suivi la rédaction),
 *    le calcul en MINUTES ZMANIYOT, proportionnelles à la longueur du jour :
 *    l'aube 72 minutes zmaniyot avant le lever, le talith 66, la sortie des
 *    étoiles 13,5 minutes zmaniyot après la chkia, Rabbénou Tam 72.
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
 * Sources des paramètres de l'opinion du Rav Ovadia Yossef : le calendrier
 * `Rabbi Ovadiah Yosef Calendar` d'Elyahu Jacobi (MIT), écrit avec le Rav
 * Benizri, auteur du luah Or Ha'Haïm, qui documente chaque zman ; pour la
 * sortie du Chabbat, les 40 minutes fixes que ce même calendrier retient.
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

/** Où l'appareil garde le choix (voir composables/useZmanimOpinion). */
export const ZMANIM_OPINION_KEY = "pj_zmanim_opinion";

/**
 * Le choix gardé sur l'appareil, lu en SYNCHRONE.
 *
 * Les horaires se calculent au premier rendu, d'une dizaine d'endroits : sans
 * cette lecture immédiate, la page s'ouvrirait sur les heures d'une opinion
 * puis sauterait sur celles de l'autre. C'est pour cela qu'elle vit ici, dans
 * un module sans dépendance, et non dans le composable qui gère le réglage.
 */
export function storedZmanimOpinion(): ZmanimOpinion | null {
  try {
    return parseZmanimOpinion(localStorage.getItem(ZMANIM_OPINION_KEY));
  } catch {
    return null; // Stockage indisponible (navigation privée).
  }
}

/** Les horaires qui dépendent de l'opinion suivie. */
export interface OpinionZmanim {
  /** Aube. */
  alotHaShachar(z: Zmanim): Date;
  /** Talith et tefilines. */
  misheyakir(z: Zmanim): Date;
  /** Fin du Chéma selon le Maguen Avraham. */
  sofZmanShmaMGA(z: Zmanim): Date;
  /** Fin de la Amida selon le Maguen Avraham. */
  sofZmanTfillaMGA(z: Zmanim): Date;
  /** Min'ha guedola. */
  minchaGedola(z: Zmanim): Date;
  /** Plag hamin'ha. */
  plagHaMincha(z: Zmanim): Date;
  /** Sortie des étoiles. */
  tzeit(z: Zmanim): Date;
  /** Sortie selon Rabbénou Tam. */
  rabbenouTam(z: Zmanim): Date;
  /**
   * Sortie du Chabbat et des fêtes, qui ne se lit pas toujours sur la sortie
   * des étoiles ordinaire : voir la note de `OVADIA`.
   */
  restEnd(z: Zmanim): Date;
}

// ---- Rav Meïr Posen : les degrés ----------------------------------------

const POSEN: OpinionZmanim = {
  alotHaShachar: (z) => z.alotHaShachar(), // 16,1°
  misheyakir: (z) => z.misheyakir(), // 11,5°
  // Le Maguen Avraham sur une aube et une nuit à 72 minutes fixes.
  sofZmanShmaMGA: (z) => z.sofZmanShmaMGA(),
  sofZmanTfillaMGA: (z) => z.sofZmanTfillaMGA(),
  minchaGedola: (z) => z.minchaGedola(),
  plagHaMincha: (z) => z.plagHaMincha(),
  tzeit: (z) => z.tzeit(), // 8,5°, trois petites étoiles selon le Ohr Meïr
  rabbenouTam: (z) => z.sunsetOffset(RABBENOU_TAM_MINUTES, true),
  restEnd: (z) => z.tzeit(),
};

/** Minutes après la chkia de la sortie selon Rabbénou Tam, en minutes fixes. */
const RABBENOU_TAM_MINUTES = 72;

// ---- Rav Ovadia Yossef : les minutes zmaniyot ----------------------------

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

/** Minutes zmaniyot de l'aube avant le lever, et de Rabbénou Tam après la chkia. */
const OVADIA_ALOT_MINUTES = 72;
/** Minutes zmaniyot du talith avant le lever (l'aube, plus six minutes). */
const OVADIA_MISHEYAKIR_MINUTES = 66;
/** Minutes zmaniyot de la sortie des étoiles après la chkia (trois quarts de mil). */
const OVADIA_TZEIT_MINUTES = 13.5;
/** Minutes zmaniyot de plag hamin'ha avant la sortie (une heure et quart, Yalkout Yossef). */
const OVADIA_PLAG_MINUTES = 75;
/** Min'ha guedola : une demi-heure après hatsot, fixe ou zmanit, la plus tardive. */
const OVADIA_MINCHA_GEDOLA_MINUTES = 30;
/**
 * Minutes FIXES après la chkia de la sortie du Chabbat et des fêtes.
 *
 * La sortie des étoiles de cette opinion, 13,5 minutes zmaniyot, est bien trop
 * tôt pour finir le Chabbat : le luah Or Ha'Haïm lui-même en donne une autre,
 * et c'est elle que le cadre du repos affiche.
 */
const OVADIA_REST_END_MINUTES = 40;

const OVADIA: OpinionZmanim = {
  alotHaShachar: (z) => fromSunrise(z, -OVADIA_ALOT_MINUTES),
  misheyakir: (z) => fromSunrise(z, -OVADIA_MISHEYAKIR_MINUTES),
  sofZmanShmaMGA: (z) => mgaHours(z, 3),
  sofZmanTfillaMGA: (z) => mgaHours(z, 4),
  minchaGedola: (z) => {
    // La demi-heure zmanit est plus longue que l'autre en été, plus courte en
    // hiver : on retient la plus tardive des deux, par rigueur.
    const chatzot = z.chatzot().getTime();
    const fixed = chatzot + OVADIA_MINCHA_GEDOLA_MINUTES * 60_000;
    const zmanit = chatzot + (OVADIA_MINCHA_GEDOLA_MINUTES / 60) * dayHour(z);
    return new Date(Math.max(fixed, zmanit));
  },
  plagHaMincha: (z) =>
    new Date(
      fromSunset(z, OVADIA_TZEIT_MINUTES).getTime() - (OVADIA_PLAG_MINUTES / 60) * dayHour(z),
    ),
  tzeit: (z) => fromSunset(z, OVADIA_TZEIT_MINUTES),
  rabbenouTam: (z) => fromSunset(z, OVADIA_ALOT_MINUTES),
  restEnd: (z) => new Date(z.sunset().getTime() + OVADIA_REST_END_MINUTES * 60_000),
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
