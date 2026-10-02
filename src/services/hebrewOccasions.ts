import { HDate, months } from "@hebcal/core";

/**
 * Les dates personnelles du calendrier hébraïque : un anniversaire, un
 * leilouy nichmat, ou toute autre date qu'on veut voir revenir.
 *
 * Elles ne se comptent pas comme les dates civiles. Une date hébraïque revient
 * chaque année à son jour et à son mois, et deux particularités du calendrier
 * demandent une décision, prise ici une fois pour toutes plutôt que dans
 * chaque écran qui les affiche :
 *
 *  - **Adar.** Une année sur trois environ en compte deux. Une date d'Adar
 *    posée dans une année ordinaire revient alors en Adar II, l'usage séfarade
 *    que suit le reste du site (voir saysBirkatHalevana, slihotWindow). Une
 *    date tombée en Adar I d'une année à treize mois (`firstAdar`) revient,
 *    elle, en Adar I ces années-là, et en Adar les autres.
 *  - **Le 30 du mois.** 'Hechvan et Kislev ont 29 jours certaines années. La
 *    date revient alors le 29, dernier jour du mois, plutôt que de sauter une
 *    année ou de déborder sur le mois suivant. Pour la pratique, l'avis d'un
 *    rav prime, comme le dit la note de la page.
 *
 * Ce module ne connaît ni lieu ni notification : il ne fait que placer une
 * date dans une année. Les rappels sont posés par zmanReminderService, qui
 * sait la chkia du lieu.
 */

/** Ce que la date commémore : le dessin et le mot en dépendent. */
export type OccasionKind = "yahrzeit" | "birthday" | "other";

export const OCCASION_KINDS: OccasionKind[] = ["yahrzeit", "birthday", "other"];

/**
 * Quand prévenir. Le jour hébraïque commençant au coucher du soleil, « à
 * l'entrée du jour » tombe la veille au soir : c'est le moment d'allumer une
 * bougie. « Le matin » tombe le jour civil qui porte la date.
 */
export type OccasionReminder = "none" | "nightfall" | "morning" | "weekBefore";

export const OCCASION_REMINDERS: OccasionReminder[] = [
  "none",
  "nightfall",
  "morning",
  "weekBefore",
];

/** Une date personnelle, telle qu'elle est saisie et gardée. */
export interface HebrewOccasion {
  /** Identifiant stable : sert à modifier la date et à numéroter son rappel. */
  id: string;
  name: string;
  kind: OccasionKind;
  /** Jour du mois hébraïque (1 à 30). */
  day: number;
  /** Mois hebcal. Adar est gardé en ADAR_I, le nom qu'il porte hors année à treize mois. */
  month: number;
  /**
   * Vrai pour une date tombée en Adar I d'une année à treize mois : elle y
   * revient, au lieu de passer en Adar II. Seule la saisie par la date civile
   * le sait, elle connaît l'année ; absent partout ailleurs.
   */
  firstAdar?: boolean;
  reminder: OccasionReminder;
}

/** Le plus grand jour qu'un mois hébraïque puisse porter. */
export const MAX_OCCASION_DAY = 30;

/**
 * Les mois dans l'ordre de l'année hébraïque, qui ouvre à Tichri. Adar n'y
 * figure qu'une fois : c'est la date qu'on pose, pas l'année en cours.
 */
export const OCCASION_MONTHS: number[] = [
  months.TISHREI,
  months.CHESHVAN,
  months.KISLEV,
  months.TEVET,
  months.SHVAT,
  months.ADAR_I,
  months.NISAN,
  months.IYYAR,
  months.SIVAN,
  months.TAMUZ,
  months.AV,
  months.ELUL,
];

/**
 * Ce qui suffit à placer une date dans une année : son jour, son mois, et
 * pour Adar lequel des deux. Le nom d'un défunt dans la chaîne perpétuelle
 * revient par la même règle.
 */
export type HebrewDayOfYear = Pick<HebrewOccasion, "day" | "month" | "firstAdar">;

/** La date est-elle d'Adar I, celui d'une année à treize mois ? */
export function isFirstAdar(date: Pick<HebrewDayOfYear, "month" | "firstAdar">): boolean {
  return date.firstAdar === true && date.month === months.ADAR_I;
}

/** Le mois tel qu'il existe dans cette année-là (voir la règle d'Adar en tête). */
function monthIn(date: HebrewDayOfYear, year: number): number {
  const { month } = date;
  if (month !== months.ADAR_I && month !== months.ADAR_II) return month;
  if (!HDate.isLeapYear(year)) return months.ADAR_I;
  return isFirstAdar(date) ? months.ADAR_I : months.ADAR_II;
}

/** La date, placée dans l'année hébraïque demandée. */
export function occasionDateIn(occasion: HebrewDayOfYear, year: number): HDate {
  const month = monthIn(occasion, year);
  const day = Math.min(occasion.day, HDate.daysInMonth(month, year));
  return new HDate(day, month, year);
}

/**
 * La prochaine fois que la date revient, à partir du jour donné (inclus) :
 * celle de cette année-ci si elle n'est pas passée, celle de l'an prochain
 * sinon.
 */
export function nextOccurrence(occasion: HebrewDayOfYear, from: HDate): HDate {
  const thisYear = occasionDateIn(occasion, from.getFullYear());
  if (thisYear.abs() >= from.abs()) return thisYear;
  return occasionDateIn(occasion, from.getFullYear() + 1);
}

/** Une date à venir, telle que l'accueil l'annonce. */
export interface UpcomingOccasion {
  occasion: HebrewOccasion;
  date: HDate;
  /** Jours civils d'ici là : 0 le jour même, 1 demain. */
  inDays: number;
}

/** Fenêtre de l'accueil : au-delà, une date n'est plus « ce qui vient ». */
export const UPCOMING_HORIZON_DAYS = 7;

/**
 * Les dates qui reviennent dans les jours qui suivent, de la plus proche à la
 * plus lointaine. C'est ce que l'accueil annonce, et rien d'autre : passé la
 * fenêtre, la carte s'efface plutôt que de rester là toute l'année.
 */
export function upcomingOccasions(
  occasions: HebrewOccasion[],
  today: HDate,
  horizonDays = UPCOMING_HORIZON_DAYS,
  limit = 3,
): UpcomingOccasion[] {
  return occasions
    .map((occasion) => {
      const date = nextOccurrence(occasion, today);
      return { occasion, date, inDays: date.abs() - today.abs() };
    })
    .filter((upcoming) => upcoming.inDays <= horizonDays)
    .sort((a, b) => a.inDays - b.inDays || a.occasion.name.localeCompare(b.occasion.name))
    .slice(0, limit);
}

/**
 * Les dates du COMPTE, complétées de celles que l'appareil est seul à porter.
 *
 * C'est la règle de la première connexion : ce qui a été inscrit sans compte
 * le rejoint, et le compte fait foi pour tout le reste. Les fois suivantes,
 * le compte remplace la liste de l'appareil sans fusion, sinon une date
 * supprimée ailleurs reviendrait à chaque connexion (voir useHebrewOccasions).
 */
export function mergeOccasions(
  remote: HebrewOccasion[],
  local: HebrewOccasion[],
  limit: number,
): HebrewOccasion[] {
  const known = new Set(remote.map((entry) => entry.id));
  return [...remote, ...local.filter((entry) => !known.has(entry.id))].slice(0, limit);
}

/** Un identifiant qui ne dépend d'aucune API (crypto absent des vieilles webviews). */
export function newOccasionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Le nom, sans espaces inutiles ni longueur déraisonnable pour une notification. */
export const MAX_OCCASION_NAME = 60;

export function cleanOccasionName(name: string): string {
  return name.trim().slice(0, MAX_OCCASION_NAME);
}

/**
 * Une date lue du stockage, ramenée à des valeurs sûres, ou null si elle n'a
 * plus rien d'une date (fichier trafiqué, version antérieure).
 */
export function parseOccasion(value: unknown): HebrewOccasion | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Partial<HebrewOccasion>;
  const name = typeof raw.name === "string" ? cleanOccasionName(raw.name) : "";
  if (!name) return null;
  const day = Number(raw.day);
  const month = Number(raw.month);
  if (!Number.isInteger(day) || day < 1 || day > MAX_OCCASION_DAY) return null;
  if (!OCCASION_MONTHS.includes(month) && month !== months.ADAR_II) return null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newOccasionId(),
    name,
    kind: OCCASION_KINDS.includes(raw.kind as OccasionKind) ? (raw.kind as OccasionKind) : "other",
    day,
    month,
    ...(isFirstAdar({ month, firstAdar: raw.firstAdar }) ? { firstAdar: true } : {}),
    reminder: OCCASION_REMINDERS.includes(raw.reminder as OccasionReminder)
      ? (raw.reminder as OccasionReminder)
      : "none",
  };
}

/**
 * Jours civils jusqu'au prochain retour de la date, 0 le jour même. Le jour
 * hébraïque est celui de la date civile donnée (le calendrier de l'année fait
 * de même : la chkia n'y entre pas).
 */
export function daysUntilNext(date: HebrewDayOfYear, today: Date): number {
  const from = new HDate(today);
  return nextOccurrence(date, from).abs() - from.abs();
}
