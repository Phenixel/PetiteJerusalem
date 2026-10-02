import { describe, expect, it } from "vitest";
import { HDate, HebrewCalendar, months } from "@hebcal/core";
import {
  civilToHebrew,
  civilYearsOf,
  hebrewDate,
  isConverterYear,
  mitzvahDate,
  monthInYear,
  monthsOfYear,
  occasionDayOf,
} from "../services/hebrewDateConverter";
import { occasionDateIn } from "../services/hebrewOccasions";

/**
 * Le convertisseur du calendrier et la saisie d'une date personnelle par sa
 * date civile (voir hebrewDateConverter). Ce que ces tests tiennent : le
 * coucher du soleil qui fait passer au lendemain, les mois qui changent d'une
 * année à l'autre (Adar, 'Hechvan, Kislev), et le jour de la bar-mitsvah.
 *
 * Repères : 5786 est une année ordinaire, 5787 compte treize mois.
 */

describe("civilToHebrew", () => {
  it("donne la date hébraïque du jour civil", () => {
    const hd = civilToHebrew(new Date(2026, 9, 2), false);

    expect([hd.getDate(), hd.getMonth(), hd.getFullYear()]).toEqual([21, months.TISHREI, 5787]);
  });

  it("passe au lendemain hébraïque après le coucher du soleil", () => {
    const hd = civilToHebrew(new Date(2026, 9, 2), true);

    expect([hd.getDate(), hd.getMonth()]).toEqual([22, months.TISHREI]);
  });
});

describe("hebrewDate", () => {
  it("donne le jour civil d'une date hébraïque, l'année dite", () => {
    const greg = hebrewDate(15, months.NISAN, 5787).greg();

    expect([greg.getFullYear(), greg.getMonth(), greg.getDate()]).toEqual([2027, 3, 22]);
  });

  it("ramène le 30 d'un mois de 29 jours au 29, sans déborder sur le suivant", () => {
    expect(HDate.daysInMonth(months.CHESHVAN, 5784)).toBe(29);
    const hd = hebrewDate(30, months.CHESHVAN, 5784);

    expect([hd.getDate(), hd.getMonth()]).toEqual([29, months.CHESHVAN]);
  });

  it("lit Adar II dans une année ordinaire comme Adar", () => {
    expect(monthInYear(months.ADAR_II, 5786)).toBe(months.ADAR_I);
    expect(monthInYear(months.ADAR_II, 5787)).toBe(months.ADAR_II);
    expect(hebrewDate(14, months.ADAR_II, 5786).getMonth()).toBe(months.ADAR_I);
  });
});

describe("monthsOfYear", () => {
  it("compte douze mois dans une année ordinaire, treize sinon, de Tichri à Eloul", () => {
    expect(monthsOfYear(5786)).toHaveLength(12);
    expect(monthsOfYear(5787)).toHaveLength(13);
    expect(monthsOfYear(5787)[0]).toBe(months.TISHREI);
    expect(monthsOfYear(5787).at(-1)).toBe(months.ELUL);
    expect(monthsOfYear(5787).slice(5, 7)).toEqual([months.ADAR_I, months.ADAR_II]);
  });
});

describe("isConverterYear", () => {
  it("écarte une année tapée de travers", () => {
    expect(isConverterYear(5787)).toBe(true);
    expect(isConverterYear(578)).toBe(false);
    expect(isConverterYear(5787.5)).toBe(false);
    expect(isConverterYear(Number.NaN)).toBe(false);
  });
});

describe("civilYearsOf", () => {
  it("dit sur quelles années civiles s'étend l'année hébraïque", () => {
    expect(civilYearsOf(5787)).toEqual({ from: 2026, to: 2027 });
  });
});

describe("occasionDayOf", () => {
  it("garde le jour et le mois, que la date personnelle fait revenir chaque année", () => {
    const day = occasionDayOf(civilToHebrew(new Date(1999, 11, 20), false));

    expect(day).toEqual({ day: 11, month: months.TEVET, firstAdar: false });
    expect(occasionDateIn(day, 5787).getDate()).toBe(11);
  });

  it("range Adar II sous Adar, le seul que le formulaire propose", () => {
    const day = occasionDayOf(new HDate(10, months.ADAR_II, 5784));

    expect(day).toEqual({ day: 10, month: months.ADAR_I, firstAdar: false });
    // La règle des dates personnelles la ramène en Adar II les années à treize mois.
    expect(occasionDateIn(day, 5787).getMonth()).toBe(months.ADAR_II);
  });

  it("retient Adar I d'une année à treize mois : la date y revient", () => {
    // Le 24 février 2024 est le 15 Adar I 5784.
    const day = occasionDayOf(civilToHebrew(new Date(2024, 1, 24), false));

    expect(day).toEqual({ day: 15, month: months.ADAR_I, firstAdar: true });
    // 5787 a deux Adar : le 15 Adar I y tombe le 22 février 2027, et non un
    // mois plus tard, le 24 mars (15 Adar II).
    expect(occasionDateIn(day, 5787).greg()).toEqual(new Date(2027, 1, 22));
    // Comme le yahrzeit de hebcal, qui fait foi.
    const yahrzeit = HebrewCalendar.getYahrzeit(5787, new HDate(15, months.ADAR_I, 5784));
    expect(occasionDateIn(day, 5787).abs()).toBe(yahrzeit?.abs());
    // Une année ordinaire n'a qu'un Adar.
    expect(occasionDateIn(day, 5788).greg()).toEqual(new Date(2028, 2, 13));
  });

  it("ne voit pas d'Adar I dans l'Adar d'une année ordinaire", () => {
    const day = occasionDayOf(new HDate(15, months.ADAR_I, 5786));

    expect(day.firstAdar).toBe(false);
    expect(occasionDateIn(day, 5787).getMonth()).toBe(months.ADAR_II);
  });
});

describe("mitzvahDate", () => {
  it("tombe à l'anniversaire hébraïque des treize ans, des douze pour une fille", () => {
    const birth = new HDate(12, months.KISLEV, 5774);

    const bar = mitzvahDate(birth, "bar");
    const bat = mitzvahDate(birth, "bat");

    expect([bar.getDate(), bar.getMonth(), bar.getFullYear()]).toEqual([12, months.KISLEV, 5787]);
    expect(bat.getFullYear()).toBe(5786);
  });

  it("place en Adar II une naissance d'Adar quand l'année des treize ans en a deux", () => {
    // 5769 est une année ordinaire, 5782 en compte treize.
    expect(HDate.isLeapYear(5769)).toBe(false);
    expect(HDate.isLeapYear(5782)).toBe(true);
    const bar = mitzvahDate(new HDate(10, months.ADAR_I, 5769), "bar");

    expect([bar.getDate(), bar.getMonth(), bar.getFullYear()]).toEqual([10, months.ADAR_II, 5782]);
  });

  it("place en Adar une naissance d'Adar I quand l'année des treize ans n'en a qu'un", () => {
    expect(HDate.isLeapYear(5765)).toBe(true);
    const bar = mitzvahDate(new HDate(10, months.ADAR_I, 5765), "bar");

    expect([bar.getDate(), bar.getMonth(), bar.getFullYear()]).toEqual([10, months.ADAR_I, 5778]);
  });

  it("reporte au 1er Kislev une naissance du 30 'Hechvan quand l'année n'en a que 29", () => {
    expect(HDate.daysInMonth(months.CHESHVAN, 5784)).toBe(29);
    const bar = mitzvahDate(new HDate(30, months.CHESHVAN, 5771), "bar");

    expect([bar.getDate(), bar.getMonth(), bar.getFullYear()]).toEqual([1, months.KISLEV, 5784]);
  });
});
