import { describe, expect, it } from "vitest";
import { HDate, months } from "@hebcal/core";
import { saidTachanun } from "../services/tachanun";

/**
 * Les jours où hebcal se trompe sur le tahanoun, et que `saidTachanun` reprend
 * (voir `docs/audit-horaires-2026-09.md`, point 3.4).
 *
 * Le tahanoun n'est pas une heure : c'est un jour, et un office. Une erreur y
 * est visible à l'œil nu, puisque la page du jour et le sidour annoncent en
 * toutes lettres « Pas de Ta'hanoun » ou « On dit Ta'hanoun ».
 */

/** Le jour hébraïque d'une date civile, à midi pour ne frôler aucune bascule. */
const hd = (y: number, m: number, d: number) => new HDate(new Date(y, m - 1, d, 12));

/** Ce que l'on attend, en une phrase : les deux offices, ou aucun. */
const full = { shacharit: true, mincha: true };
const none = { shacharit: false, mincha: false };
const morningOnly = { shacharit: true, mincha: false };

describe("le lendemain de 'Hanouka", () => {
  /**
   * hebcal retire le tahanoun du 25 au « 33 » Kislev, sans regarder si Kislev
   * compte 29 ou 30 jours. 'Hanouka dure huit jours, pas neuf : le 33e déborde
   * donc d'un jour, et c'est un jour ordinaire qu'il efface.
   */
  it("dit le tahanoun le 3 Tévet quand Kislev est plein", () => {
    // 5787 : Kislev a 30 jours, 'Hanouka court du 25 Kislev au 2 Tévet. Le
    // 3 Tévet, dimanche 13 décembre 2026, est un jour ordinaire ; hebcal
    // l'effaçait.
    expect(new HDate(1, months.KISLEV, 5787).daysInMonth()).toBe(30);
    expect(saidTachanun(hd(2026, 12, 12), false)).toEqual(none); // 2 Tévet, 8e jour
    expect(saidTachanun(hd(2026, 12, 13), false)).toEqual(full); // 3 Tévet
    expect(saidTachanun(hd(2026, 12, 14), false)).toEqual(full); // 4 Tévet
  });

  it("garde le 3 Tévet sans tahanoun quand Kislev est creux", () => {
    // 5790 : Kislev n'a que 29 jours, et 'Hanouka court jusqu'au 3 Tévet
    // inclus. C'est le 4 Tévet, lundi 10 décembre 2029, que hebcal effaçait.
    expect(new HDate(1, months.KISLEV, 5790).daysInMonth()).toBe(29);
    expect(saidTachanun(hd(2029, 12, 9), false)).toEqual(none); // 3 Tévet, 8e jour
    expect(saidTachanun(hd(2029, 12, 10), false)).toEqual(full); // 4 Tévet
  });

  it("laisse le vendredi sans tahanoun à Min'ha", () => {
    // 5789 : le 4 Tévet tombe le vendredi 22 décembre 2028. Le tahanoun s'y
    // dit le matin, mais pas à Min'ha : c'est le Chabbat qui vient qui le
    // retient, et la correction ne doit pas le lui rendre.
    const friday = hd(2028, 12, 22);
    expect(friday.getDay()).toBe(5);
    expect(saidTachanun(friday, false)).toEqual(morningOnly);
  });

  it("ne touche à rien hors de ces deux jours de Tévet", () => {
    // Le 10 Tévet est un jeûne : le tahanoun s'y dit, et c'est hebcal qui le
    // dit, la correction ne s'en mêle pas.
    expect(saidTachanun(new HDate(10, months.TEVET, 5787), false)).toEqual(full);
    expect(saidTachanun(new HDate(5, months.TEVET, 5787), false)).toEqual(full);
  });
});

describe("Chouchan Pourim Katan", () => {
  /**
   * Le Choul'han Aroukh (Ora'h 'Haïm 697, 1) omet le tahanoun les 14 ET 15
   * Adar I des années à treize mois. hebcal ne connaît que le 14.
   */
  it("ne dit pas le tahanoun le 15 Adar I", () => {
    // 5787 : lundi 22 février 2027.
    const day = hd(2027, 2, 22);
    expect(day.getMonth()).toBe(months.ADAR_I);
    expect(day.getDate()).toBe(15);
    expect(saidTachanun(day, false)).toEqual(none);
    // La veille, Pourim Katan, était déjà juste.
    expect(saidTachanun(hd(2027, 2, 21), false)).toEqual(none);
  });

  it("laisse les années ordinaires intactes", () => {
    // 5786 n'a qu'un Adar : le 15 Adar est Chouchan Pourim, que hebcal
    // connaît déjà, et le mois n'est pas ADAR_I.
    const purim = new HDate(15, months.ADAR_II, 5786);
    expect(purim.isLeapYear()).toBe(false);
    expect(saidTachanun(purim, false)).toEqual(none);
    // Un jour ordinaire du même mois garde son tahanoun.
    expect(saidTachanun(new HDate(20, months.ADAR_II, 5786), false)).toEqual(full);
  });
});

describe("ce que hebcal disait déjà juste", () => {
  it("garde les corrections posées avant", () => {
    // Les jours de tachloumin (9 au 12 Sivan) et la Min'ha du 28 Eloul, que
    // `saidTachanun` corrigeait déjà : la nouvelle logique ne les défait pas.
    expect(saidTachanun(new HDate(10, months.SIVAN, 5787), false)).toEqual(none);
    // Le 13 Sivan 5787 tombe un vendredi (18 juin 2027) : le tahanoun y
    // reprend le matin, mais le Chabbat qui vient retient sa Min'ha.
    expect(saidTachanun(new HDate(13, months.SIVAN, 5787), false)).toEqual(morningOnly);
    expect(saidTachanun(new HDate(28, months.ELUL, 5787), false).mincha).toBe(true);
  });
});
