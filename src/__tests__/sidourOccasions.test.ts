import { describe, expect, it } from "vitest";
import { HDate, months } from "@hebcal/core";
import {
  activeOccasions,
  omerDay,
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

describe("tahanoun, et son absence", () => {
  it("pose toujours l'une des deux clés, jamais les deux", () => {
    // Le passage n'est jamais sauté : ou bien le tahanoun s'y dit, ou bien
    // « Yehi chem » tient sa place. Le texte porte les deux, le jour tranche.
    for (const jour of [
      new HDate(3, months.KISLEV, 5786),
      new HDate(1, months.KISLEV, 5786), // Roch Hodech : pas de tahanoun
      new HDate(25, months.KISLEV, 5786), // 'Hanouka
    ]) {
      const occ = activeOccasions(jour, false);
      expect(occ.has("tahanoun")).toBe(!occ.has("sans-tahanoun"));
      expect(occ.has("tahanoun-minha")).toBe(!occ.has("sans-tahanoun-minha"));
    }
    expect(activeOccasions(new HDate(1, months.KISLEV, 5786), false).has("sans-tahanoun")).toBe(
      true,
    );
  });
});

describe("jeûnes publics", () => {
  it("les jeûnes du calendrier, pas ceux de coutume", () => {
    // Le 10 Tevet et Tsom Guedalia en sont. Le lendemain d'un jeûne n'en est
    // pas, ni les jeûnes de coutume, que le calendrier de hebcal marque
    // pourtant comme jeûnes : BeHaB (le lundi, le jeudi et le lundi qui
    // suivent Pessah et Souccot) et Yom Kippour Katan (la veille de Roch
    // Hodech). Ces jours-là, pas de birkat kohanim à Min'ha.
    expect(activeOccasions(new HDate(10, months.TEVET, 5786), false).has("taanit")).toBe(true);
    expect(activeOccasions(new HDate(11, months.TEVET, 5786), false).has("taanit")).toBe(false);
    expect(activeOccasions(new HDate(3, months.TISHREI, 5787), false).has("taanit")).toBe(true);
    expect(activeOccasions(new HDate(5, months.CHESHVAN, 5786), false).has("taanit")).toBe(false);
    expect(activeOccasions(new HDate(29, months.CHESHVAN, 5786), false).has("taanit")).toBe(false);
  });
});

describe("les psaumes du jour de certaines dates", () => {
  const chir = (hd: HDate) =>
    [...activeOccasions(hd, false)].filter((cle) => cle.startsWith("chir-"));

  it("s'ajoutent au psaume du jour, un seul à la fois", () => {
    // 'Hanouka, Pourim, le jeûne d'Esther, les jeûnes de Tichri et de Tévet,
    // le 17 Tamouz, le lendemain de Kippour : chacun a le sien.
    expect(chir(new HDate(25, months.KISLEV, 5786))).toEqual(["chir-hanouka"]);
    expect(chir(new HDate(14, months.ADAR_II, 5786))).toEqual(["chir-pourim"]);
    expect(chir(new HDate(3, months.TISHREI, 5787))).toEqual(["chir-tsom-tichri"]);
    expect(chir(new HDate(10, months.TEVET, 5786))).toEqual(["chir-tsom-tichri"]);
    expect(chir(new HDate(11, months.TISHREI, 5786))).toEqual(["chir-lendemain-kippour"]);
  });

  it("laissent les jours ordinaires au seul psaume du jour", () => {
    const ordinaire = activeOccasions(new HDate(5, months.CHESHVAN, 5786), false);
    expect([...ordinaire].filter((cle) => cle.startsWith("chir-"))).toEqual([]);
    // Le psaume du jour, lui, est toujours là : les ajouts ne le remplacent
    // pas, ils le suivent.
    expect(ordinaire.has("jour-1")).toBe(true);
  });

  it("laissent Kippour hors du psaume des jeûnes de Tichri", () => {
    // Kippour est un jeûne de Tichri, mais il a son propre office : le psaume
    // de Tsom Guedalia n'a rien à y faire.
    expect(chir(new HDate(10, months.TISHREI, 5786))).toEqual([]);
  });
});

describe("les jours que hebcal appelle jeûnes sans qu'ils en soient", () => {
  it("écarte la veille de Pessah, la veille de Tich'a beAv et Kippour", () => {
    // Ta'anit Bekhorot n'oblige que les premiers-nés ; la veille de Tich'a
    // beAv, le jeûne ne commence qu'à la nuit ; Kippour a son propre office.
    // Les trois portent pourtant un drapeau de jeûne chez hebcal.
    expect(activeOccasions(new HDate(14, months.NISAN, 5787), false).has("taanit")).toBe(false);
    expect(activeOccasions(new HDate(8, months.AV, 5787), false).has("taanit")).toBe(false);
    expect(activeOccasions(new HDate(10, months.TISHREI, 5787), false).has("taanit")).toBe(false);
    // Le jour même de Tich'a beAv reste un jeûne, et lui seul porte Na'hem.
    const neufAv = activeOccasions(new HDate(9, months.AV, 5787), false);
    expect(neufAv.has("taanit")).toBe(true);
    expect(neufAv.has("tisha-beav")).toBe(true);
    expect(activeOccasions(new HDate(8, months.AV, 5787), false).has("tisha-beav")).toBe(false);
  });
});

describe("le Hallel, et sa longueur", () => {
  const hallel = (hd: HDate) =>
    [...activeOccasions(hd, false)].filter((cle) => cle.startsWith("hallel")).sort();

  it("se dit à Roch Hodech, à 'Hanouka et à 'Hol haMoed, et pas ailleurs", () => {
    expect(hallel(new HDate(1, months.KISLEV, 5787))).toContain("hallel");
    expect(hallel(new HDate(25, months.KISLEV, 5787))).toContain("hallel");
    expect(hallel(new HDate(17, months.NISAN, 5787))).toContain("hallel");
    expect(hallel(new HDate(5, months.CHESHVAN, 5787))).toEqual([]);
  });

  it("est entier à 'Hanouka et à Souccot, abrégé à Roch Hodech et à Pessah", () => {
    expect(hallel(new HDate(25, months.KISLEV, 5787))).toContain("hallel-complet");
    expect(hallel(new HDate(17, months.TISHREI, 5788))).toContain("hallel-complet");
    expect(hallel(new HDate(1, months.KISLEV, 5787))).toContain("hallel-abrege");
    expect(hallel(new HDate(17, months.NISAN, 5787))).toContain("hallel-abrege");
    // Roch Hodech Tévet tombe dans 'Hanouka : c'est 'Hanouka qui l'emporte.
    const rhTevet = activeOccasions(new HDate(1, months.TEVET, 5787), false);
    expect(rhTevet.has("rosh-chodesh")).toBe(true);
    expect(rhTevet.has("hallel-complet")).toBe(true);
    expect(rhTevet.has("hallel-abrege")).toBe(false);
  });
});

describe("les huit jours de 'Hanouka", () => {
  it("se numérotent de 1 à 8, une clé par jour", () => {
    // hebcal pose « 1 Candle » sur la veille : le premier jour porte
    // « 2 Candles », et le dernier a son nom à lui.
    const jours: string[] = [];
    for (let i = 0; i < 8; i++) {
      const hd = new HDate(new HDate(25, months.KISLEV, 5787).abs() + i);
      const cle = [...activeOccasions(hd, false)].find((k) => /^hanouka-\d/.test(k));
      jours.push(cle ?? "(rien)");
    }
    expect(jours).toEqual([
      "hanouka-1",
      "hanouka-2",
      "hanouka-3",
      "hanouka-4",
      "hanouka-5",
      "hanouka-6",
      "hanouka-7",
      "hanouka-8",
    ]);
    // La veille n'en est pas.
    expect(activeOccasions(new HDate(24, months.KISLEV, 5787), false).has("hanouka")).toBe(false);
  });
});

describe("le compte du 'Omer", () => {
  it("court du 16 Nissan au 5 Sivan, quarante-neuf jours pleins", () => {
    expect(omerDay(new HDate(15, months.NISAN, 5787))).toBeNull();
    expect(omerDay(new HDate(16, months.NISAN, 5787))).toBe(1);
    expect(omerDay(new HDate(5, months.SIVAN, 5787))).toBe(49);
    expect(omerDay(new HDate(6, months.SIVAN, 5787))).toBeNull();
    // Le compte ne saute pas d'un mois à l'autre.
    expect(omerDay(new HDate(1, months.IYYAR, 5787))).toBe(16);
    const occ = activeOccasions(new HDate(16, months.NISAN, 5787), false);
    expect(occ.has("omer")).toBe(true);
    expect(occ.has("omer-1")).toBe(true);
  });
});

describe("Na'hem de Tich'a beAv", () => {
  it("entre dans la 'Amida de Min'ha, et sa conclusion prend la place", () => {
    const tishaBeav = activeOccasions(new HDate(9, months.AV, 5786), false);
    expect(tishaBeav.has("tisha-beav")).toBe(true);
    expect(tishaBeav.has("sans-tisha-beav")).toBe(false);
    const ordinaire = activeOccasions(new HDate(10, months.AV, 5786), false);
    expect(ordinaire.has("tisha-beav")).toBe(false);
    expect(ordinaire.has("sans-tisha-beav")).toBe(true);
  });
});

describe("Lédavid (psaume 27)", () => {
  it("se dit du 1er Eloul à Chemini 'Atséret", () => {
    expect(activeOccasions(new HDate(1, months.ELUL, 5786), false).has("ledavid")).toBe(true);
    expect(activeOccasions(new HDate(22, months.TISHREI, 5786), false).has("ledavid")).toBe(true);
    expect(activeOccasions(new HDate(23, months.TISHREI, 5786), false).has("ledavid")).toBe(false);
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
    expect(activeOccasions(new HDate(22, months.TISHREI, 5786), false).has("shemini-atzeret")).toBe(
      true,
    );
    // Un jour ordinaire ne porte aucune fête.
    const ordinaire = activeOccasions(new HDate(10, months.CHESHVAN, 5786), false);
    for (const key of ["pesach", "shavuot", "sukkot", "shemini-atzeret"])
      expect(ordinaire.has(key)).toBe(false);
  });
});
