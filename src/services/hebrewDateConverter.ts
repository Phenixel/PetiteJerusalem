import { HDate, HebrewCalendar, months } from "@hebcal/core";
import type { HebrewDayOfYear } from "./hebrewOccasions";

/**
 * Le passage d'un calendrier à l'autre : ce que sert le convertisseur du
 * calendrier, le calcul de la bar-mitsvah, et la saisie d'une date
 * personnelle par sa date civile.
 *
 * Une date civile ne donne pas à elle seule sa date hébraïque : le jour
 * hébraïque commence au coucher du soleil, la veille au soir. Un enfant né le
 * 3 mars à 21 h est né le lendemain du 3 mars hébraïque. Chaque conversion
 * dans ce sens demande donc si c'était après le coucher du soleil, plutôt que
 * de laisser une date fausse d'un jour se graver dans un leilouy nichmat.
 *
 * Ce module ne connaît ni lieu ni heure : l'heure du coucher varie d'une
 * ville à l'autre, et la personne qui saisit sait mieux que nous si c'était
 * avant ou après.
 */

/**
 * Les années que le convertisseur accepte. Au-delà, hebcal calcule encore,
 * mais le calendrier civil proleptique n'a plus grand sens, et un chiffre
 * tapé de travers (« 578 ») ne doit pas produire une date de l'Antiquité.
 */
export const MIN_CONVERTER_YEAR = 4000;
export const MAX_CONVERTER_YEAR = 6500;

export const isConverterYear = (year: number): boolean =>
  Number.isInteger(year) && year >= MIN_CONVERTER_YEAR && year <= MAX_CONVERTER_YEAR;

/**
 * Les mois d'une année hébraïque, dans l'ordre où elle les compte, de Tichri
 * à Eloul. Une année à treize mois a Adar I puis Adar II ; une année
 * ordinaire, un seul Adar (que hebcal range sous ADAR_I).
 */
export function monthsOfYear(year: number): number[] {
  const adar = HDate.isLeapYear(year) ? [months.ADAR_I, months.ADAR_II] : [months.ADAR_I];
  return [
    months.TISHREI,
    months.CHESHVAN,
    months.KISLEV,
    months.TEVET,
    months.SHVAT,
    ...adar,
    months.NISAN,
    months.IYYAR,
    months.SIVAN,
    months.TAMUZ,
    months.AV,
    months.ELUL,
  ];
}

/**
 * Un mois choisi pour une autre année, ramené à celui qui existe dans
 * celle-ci : Adar II n'existe pas dans une année ordinaire, il y devient Adar.
 */
export function monthInYear(month: number, year: number): number {
  return month === months.ADAR_II && !HDate.isLeapYear(year) ? months.ADAR_I : month;
}

/**
 * Le mois choisi dans le formulaire, tel qu'on le garde d'une année à
 * l'autre. Adar d'une année ordinaire est retenu comme Adar II (que
 * `monthInYear` affiche « Adar » les années ordinaires) : c'est la règle des
 * dates personnelles et de hebcal pour les anniversaires, et celle de Pourim,
 * qui tombe en Adar II les années à treize mois. Adar I choisi dans une année
 * à treize mois reste Adar I.
 */
export function chosenMonthOf(month: number, year: number): number {
  return month === months.ADAR_I && !HDate.isLeapYear(year) ? months.ADAR_II : month;
}

/**
 * Ce que le formulaire montre pour un jour et un mois choisis, une année
 * donnée : le mois qui existe cette année-là (`monthInYear`), le jour ramené
 * au dernier du mois. Le choix, lui, ne change pas : le 14 Adar II revient en
 * Adar II après une année ordinaire, le 30 'Hechvan revient au 30 après une
 * année où 'Hechvan n'en a que 29.
 */
export function shownDayAndMonth(
  day: number,
  month: number,
  year: number,
): { day: number; month: number } {
  const inYear = monthInYear(month, year);
  return { day: Math.min(day, HDate.daysInMonth(inYear, year)), month: inYear };
}

/**
 * La date hébraïque donnée, en HDate. Le mois est ramené à l'année (voir
 * `monthInYear`), le jour au dernier du mois : le 30 'Hechvan d'une année où
 * 'Hechvan n'en compte que 29 se lit le 29, sans déborder sur Kislev.
 */
export function hebrewDate(day: number, month: number, year: number): HDate {
  const inYear = monthInYear(month, year);
  const last = HDate.daysInMonth(inYear, year);
  return new HDate(Math.min(Math.max(1, day), last), inYear, year);
}

/**
 * La date hébraïque d'un jour civil. `afterSunset` : l'événement a eu lieu
 * après le coucher du soleil, le jour hébraïque suivant avait commencé.
 */
export function civilToHebrew(date: Date, afterSunset: boolean): HDate {
  const hd = new HDate(date);
  return afterSunset ? hd.next() : hd;
}

/**
 * Le jour et le mois à garder pour une date personnelle, à partir de sa date
 * hébraïque complète.
 *
 * Adar II devient Adar : la règle des dates personnelles (voir
 * hebrewOccasions) fait revenir une date d'Adar en Adar II les années à
 * treize mois, et en Adar les autres. Garder ADAR_II n'y changerait rien, et
 * le formulaire, qui ne propose qu'un Adar, ne saurait pas l'afficher.
 *
 * Adar I d'une année à treize mois, lui, se retient (`firstAdar`) : sans
 * cela la date reviendrait en Adar II, un mois après son jour. Le champ est
 * toujours rendu, vrai ou faux, pour qu'une date choisie ensuite hors
 * d'Adar I l'efface du brouillon qui la reçoit.
 */
export function occasionDayOf(hd: HDate): Required<HebrewDayOfYear> {
  const firstAdar = hd.getMonth() === months.ADAR_I && HDate.isLeapYear(hd.getFullYear());
  const month = hd.getMonth() === months.ADAR_II ? months.ADAR_I : hd.getMonth();
  return { day: hd.getDate(), month, firstAdar };
}

/** L'âge de la bar-mitsvah (garçon) et de la bat-mitsvah (fille). */
export const MITZVAH_AGES = { bar: 13, bat: 12 } as const;

export type MitzvahKind = keyof typeof MITZVAH_AGES;

/**
 * Le jour de la bar-mitsvah (ou de la bat-mitsvah) : l'anniversaire hébraïque
 * des treize ans (douze pour une fille).
 *
 * Ce n'est pas « le même jour et le même mois, treize ans plus tard », à cause
 * des mêmes particularités que les dates personnelles, mais tranchées ici
 * comme le veut la halakha de l'anniversaire, que hebcal suit (Calendrical
 * Calculations, p. 111) :
 *
 *  - né en Adar d'une année ordinaire, ou en Adar II, on fête en Adar II
 *    quand l'année des treize ans en a deux ; né en Adar I, en Adar I ;
 *  - né un 30 'Hechvan, Kislev ou Adar I, et le mois n'a que 29 jours l'année
 *    des treize ans : le 1er du mois suivant, jour où l'on a atteint l'âge.
 *
 * L'enfant devient bar-mitsvah à la tombée de la nuit qui ouvre ce jour : la
 * veille au soir, en date civile.
 */
export function mitzvahDate(birth: HDate, kind: MitzvahKind): HDate {
  const date = HebrewCalendar.getBirthdayOrAnniversary(
    birth.getFullYear() + MITZVAH_AGES[kind],
    birth,
  );
  // hebcal ne rend rien pour une année antérieure à la naissance, ce que
  // treize ans plus tard n'est jamais.
  if (!date) throw new Error("mitzvahDate: année hors calendrier");
  return date;
}

/**
 * Les années civiles que couvre une année hébraïque : 5787 va de septembre
 * 2026 à septembre 2027. C'est le repère dont on a besoin pour taper la bonne
 * année hébraïque quand on pense en années civiles.
 */
export function civilYearsOf(year: number): { from: number; to: number } {
  const first = new HDate(1, months.TISHREI, year).greg();
  const last = new HDate(HDate.daysInMonth(months.ELUL, year), months.ELUL, year).greg();
  return { from: first.getFullYear(), to: last.getFullYear() };
}
