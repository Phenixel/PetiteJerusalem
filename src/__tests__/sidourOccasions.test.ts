import { describe, expect, it } from "vitest";
import { HDate, months } from "@hebcal/core";
import {
  activeOccasions,
  isRainRequest,
  isWinterMention,
  recentSeasonalChanges,
} from "../services/dailyCycles";

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

  it("le Lamnatséa'h de Min'ha : chaque jour de semaine, sauf le vendredi", () => {
    expect(activeOccasions(mardi, false).has("lamnatseah-minha")).toBe(true);
    const vendrediOcc = activeOccasions(vendredi, false);
    expect(vendrediOcc.has("lamnatseah-minha")).toBe(false);
    expect(vendrediOcc.has("jour-5")).toBe(true);
    const chabbat = activeOccasions(hebrewDayOfWeek(6, start), false);
    expect(chabbat.has("lamnatseah-minha")).toBe(false);
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

describe("bascules saisonnières récentes (à la couleur du thème)", () => {
  it("l'hiver de la mention : signalé trois semaines depuis le 22 Tichri", () => {
    const start = new HDate(22, months.TISHREI, 5786);
    expect(recentSeasonalChanges(start, false).has("hiver")).toBe(true);
    expect(recentSeasonalChanges(new HDate(start.abs() + 20), false).has("hiver")).toBe(true);
    expect(recentSeasonalChanges(new HDate(start.abs() + 21), false).has("hiver")).toBe(false);
  });

  it("l'été : mention et demande basculent ensemble le 15 Nissan", () => {
    const pessah = new HDate(15, months.NISAN, 5786);
    const recent = recentSeasonalChanges(pessah, false);
    expect(recent.has("ete")).toBe(true);
    expect(recent.has("barkhenou")).toBe(true);
    const later = recentSeasonalChanges(new HDate(pessah.abs() + 25), false);
    expect(later.has("ete")).toBe(false);
    expect(later.has("barkhenou")).toBe(false);
  });

  it("la demande de pluie : signalée dès son premier jour, chaque calendrier", () => {
    expect(
      recentSeasonalChanges(new HDate(7, months.CHESHVAN, 5786), true).has("barekh-alenou"),
    ).toBe(true);
    expect(
      recentSeasonalChanges(new HDate(new Date(2025, 11, 5)), false).has("barekh-alenou"),
    ).toBe(true);
    // Trois semaines plus tard, la demande n'est plus une nouveauté.
    expect(
      recentSeasonalChanges(new HDate(new Date(2026, 0, 15)), false).has("barekh-alenou"),
    ).toBe(false);
  });

  it("au cœur d'une saison : rien de récent, rien de signalé", () => {
    expect(recentSeasonalChanges(new HDate(1, months.SHVAT, 5786), false).size).toBe(0);
    expect(recentSeasonalChanges(new HDate(1, months.AV, 5786), false).size).toBe(0);
  });
});

describe("sortie du séfer Torah (Yehalelou)", () => {
  const start = new HDate(10, months.CHESHVAN, 5786);
  it("lundi et jeudi ordinaires, et les jours à lecture propre", () => {
    expect(activeOccasions(hebrewDayOfWeek(1, start), false).has("sefer-torah")).toBe(true);
    expect(activeOccasions(hebrewDayOfWeek(4, start), false).has("sefer-torah")).toBe(true);
    expect(activeOccasions(hebrewDayOfWeek(2, start), false).has("sefer-torah")).toBe(false);
    // Roch Hodech Eloul 5786 (13 août 2026, un jeudi) : lecture propre, le
    // séfer sort même si la Torah de la semaine ne se lit pas.
    const rh = activeOccasions(new HDate(30, months.AV, 5786), false);
    expect(rh.has("torah-semaine")).toBe(false);
    expect(rh.has("sefer-torah")).toBe(true);
  });
});

describe("magdil / migdol du birkat hamazon", () => {
  it("migdol les jours de Moussaf, magdil les autres, jamais les deux", () => {
    const start = new HDate(10, months.CHESHVAN, 5786);
    const mardi = activeOccasions(hebrewDayOfWeek(2, start), false);
    expect(mardi.has("magdil")).toBe(true);
    expect(mardi.has("migdol")).toBe(false);
    const chabbat = activeOccasions(hebrewDayOfWeek(6, start), false);
    expect(chabbat.has("migdol")).toBe(true);
    expect(chabbat.has("magdil")).toBe(false);
    const roshHodesh = activeOccasions(new HDate(30, months.AV, 5786), false);
    expect(roshHodesh.has("migdol")).toBe(true);
    // Pourim (14 Adar 5786 = 3 mars 2026) : migdol pour sa séouda, alors
    // qu'aucun Moussaf ne s'y dit.
    const pourim = activeOccasions(new HDate(new Date(2026, 2, 3, 12)), false);
    expect(pourim.has("nissim")).toBe(true);
    expect(pourim.has("migdol")).toBe(true);
  });
});

describe("les fêtes nommées du Mé'ein chaloch", () => {
  it("Pessah, Chavouot et Chemini Atséret portent leur clé", () => {
    // 15 Nissan 5786 = 2 avril 2026.
    expect(activeOccasions(new HDate(15, months.NISAN, 5786), false).has("pesach")).toBe(true);
    expect(activeOccasions(new HDate(17, months.NISAN, 5786), false).has("pesach")).toBe(true);
    expect(activeOccasions(new HDate(6, months.SIVAN, 5786), false).has("shavuot")).toBe(true);
    expect(
      activeOccasions(new HDate(22, months.TISHREI, 5786), false).has("shemini-atzeret"),
    ).toBe(true);
    // Un jour ordinaire ne porte aucune fête.
    const ordinaire = activeOccasions(new HDate(10, months.CHESHVAN, 5786), false);
    for (const key of ["pesach", "shavuot", "sukkot", "shemini-atzeret"])
      expect(ordinaire.has(key)).toBe(false);
  });
});
