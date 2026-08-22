import { describe, expect, it } from "vitest";
import { HDate, months } from "@hebcal/core";
import { activeOccasions, isRainRequest, isWinterMention } from "../services/dailyCycles";

/**
 * Les occasions du sidour de semaine : l'été et l'hiver de la 'Amida, la
 * demande de pluie (dont la règle civile de décembre), le tahanoun, la
 * lecture de la Torah du lundi et du jeudi, le psaume du jour.
 */

/** Le premier jour de la semaine `day` (0..6) dans une plage de jours hébraïques. */
function hebrewDayOfWeek(day: number, from: HDate, span = 7): HDate {
  for (let i = 0; i < span; i++) {
    const hd = new HDate(from.abs() + i);
    if (hd.getDay() === day) return hd;
  }
  throw new Error("jour introuvable");
}

describe("été et hiver de la 'Amida (machiv haroua'h)", () => {
  it("l'hiver court du 22 Tichri au 14 Nissan inclus", () => {
    expect(isWinterMention(new HDate(21, months.TISHREI, 5786))).toBe(false);
    expect(isWinterMention(new HDate(22, months.TISHREI, 5786))).toBe(true);
    expect(isWinterMention(new HDate(1, months.TEVET, 5786))).toBe(true);
    expect(isWinterMention(new HDate(14, months.NISAN, 5786))).toBe(true);
    expect(isWinterMention(new HDate(15, months.NISAN, 5786))).toBe(false);
    expect(isWinterMention(new HDate(1, months.AV, 5786))).toBe(false);
  });

  it("pose les clés ete / hiver, exclusives", () => {
    const hiver = activeOccasions(new HDate(1, months.TEVET, 5786), false);
    expect(hiver.has("hiver")).toBe(true);
    expect(hiver.has("ete")).toBe(false);
    const ete = activeOccasions(new HDate(1, months.AV, 5786), false);
    expect(ete.has("ete")).toBe(true);
    expect(ete.has("hiver")).toBe(false);
  });
});

describe("demande de la pluie (barekh 'alénou)", () => {
  it("en Israël, dès le 7 'Hechvan", () => {
    expect(isRainRequest(new HDate(6, months.CHESHVAN, 5786), true)).toBe(false);
    expect(isRainRequest(new HDate(7, months.CHESHVAN, 5786), true)).toBe(true);
    expect(isRainRequest(new HDate(14, months.NISAN, 5786), true)).toBe(true);
    expect(isRainRequest(new HDate(15, months.NISAN, 5786), true)).toBe(false);
  });

  it("en diaspora, depuis Arvit du 4 décembre (jour civil du 5)", () => {
    // Hiver 5786 : l'année civile suivante (2026) n'est pas bissextile.
    expect(isRainRequest(new HDate(new Date(2025, 11, 4)), false)).toBe(false);
    expect(isRainRequest(new HDate(new Date(2025, 11, 5)), false)).toBe(true);
    // Le 7 'Hechvan de diaspora n'ouvre rien : c'est la règle d'Israël.
    expect(isRainRequest(new HDate(7, months.CHESHVAN, 5786), false)).toBe(false);
  });

  it("un jour plus tard l'année civile qui précède une bissextile", () => {
    // Hiver 5788 : février 2028 compte 29 jours, on commence le 5 au soir.
    expect(isRainRequest(new HDate(new Date(2027, 11, 5)), false)).toBe(false);
    expect(isRainRequest(new HDate(new Date(2027, 11, 6)), false)).toBe(true);
  });

  it("pose les clés barekh-alenou / barkhenou, exclusives", () => {
    const hiver = activeOccasions(new HDate(new Date(2026, 0, 15)), false);
    expect(hiver.has("barekh-alenou")).toBe(true);
    expect(hiver.has("barkhenou")).toBe(false);
    const ete = activeOccasions(new HDate(1, months.AV, 5786), false);
    expect(ete.has("barkhenou")).toBe(true);
    expect(ete.has("barekh-alenou")).toBe(false);
  });
});

describe("tahanoun et lecture de la Torah de la semaine", () => {
  // 'Hechvan : aucun jour de fête hors Roch Hodech, le tahanoun s'y dit.
  const start = new HDate(10, months.CHESHVAN, 5786);
  const lundi = hebrewDayOfWeek(1, start);
  const jeudi = hebrewDayOfWeek(4, start);
  const mardi = hebrewDayOfWeek(2, start);
  const vendredi = hebrewDayOfWeek(5, start);

  it("un lundi ordinaire : tahanoun, supplications et Torah de la semaine", () => {
    const occ = activeOccasions(lundi, false);
    expect(occ.has("tahanoun")).toBe(true);
    expect(occ.has("tahanoun-minha")).toBe(true);
    expect(occ.has("tahanoun-lundi-jeudi")).toBe(true);
    expect(occ.has("torah-semaine")).toBe(true);
    expect(occ.has("jour-1")).toBe(true);
  });

  it("un jeudi ordinaire : Torah de la semaine", () => {
    const occ = activeOccasions(jeudi, false);
    expect(occ.has("torah-semaine")).toBe(true);
    expect(occ.has("tahanoun-lundi-jeudi")).toBe(true);
  });

  it("un mardi ordinaire : pas de lecture de la Torah", () => {
    const occ = activeOccasions(mardi, false);
    expect(occ.has("torah-semaine")).toBe(false);
    expect(occ.has("tahanoun-lundi-jeudi")).toBe(false);
    expect(occ.has("tahanoun")).toBe(true);
  });

  it("le vendredi : tahanoun le matin seulement", () => {
    const occ = activeOccasions(vendredi, false);
    expect(occ.has("tahanoun")).toBe(true);
    expect(occ.has("tahanoun-minha")).toBe(false);
  });

  it("Roch Hodech : ni tahanoun, ni lecture de la paracha", () => {
    const occ = activeOccasions(new HDate(1, months.KISLEV, 5786), false);
    expect(occ.has("rosh-chodesh")).toBe(true);
    expect(occ.has("tahanoun")).toBe(false);
    expect(occ.has("tahanoun-minha")).toBe(false);
    expect(occ.has("torah-semaine")).toBe(false);
  });
});

describe("Lédavid (psaume 27)", () => {
  it("se dit du 1er Eloul à Hochana Rabba", () => {
    expect(activeOccasions(new HDate(1, months.ELUL, 5786), false).has("ledavid")).toBe(true);
    expect(activeOccasions(new HDate(21, months.TISHREI, 5786), false).has("ledavid")).toBe(true);
    expect(activeOccasions(new HDate(22, months.TISHREI, 5786), false).has("ledavid")).toBe(false);
    expect(activeOccasions(new HDate(1, months.AV, 5786), false).has("ledavid")).toBe(false);
  });
});
