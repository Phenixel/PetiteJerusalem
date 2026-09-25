import { describe, expect, it } from "vitest";
import { HDate, months } from "@hebcal/core";
import {
  activeOccasions,
  getWeekdayTorahParasha,
  omerDay,
  isRainRequest,
  isWinterMention,
  recentSeasonalChanges,
} from "../services/dailyCycles";
import { saidOn } from "../services/textService";

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

  it("le 28 Eloul : tahanoun aussi à Min'ha, la veille de la veille de Roch Hachana", () => {
    // La veille d'un jour sans tahanoun, on ne le dit pas à Min'ha ; la veille
    // de Roch Hachana fait exception, et celle de Kippour aussi.
    const eloul28 = activeOccasions(new HDate(28, months.ELUL, 5786), false);
    expect(eloul28.has("tahanoun")).toBe(true);
    expect(eloul28.has("tahanoun-minha")).toBe(true);
    expect(eloul28.has("sans-tahanoun-minha")).toBe(false);

    // Le lendemain, veille de Roch Hachana : plus de tahanoun du tout.
    const eloul29 = activeOccasions(new HDate(29, months.ELUL, 5786), false);
    expect(eloul29.has("tahanoun")).toBe(false);
    expect(eloul29.has("tahanoun-minha")).toBe(false);
  });

  it("la veille de Roch Hodech : tahanoun le matin seulement", () => {
    // 29 'Hechvan 5787, un lundi : la règle ordinaire vaut, le tahanoun tombe
    // dès Min'ha.
    const occ = activeOccasions(new HDate(29, months.CHESHVAN, 5787), false);
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

  it("un Yom Tov tombé un lundi ou un jeudi lit son propre passage", () => {
    // Kippour (lundi 21 septembre 2026), Pessah I (jeudi 2 avril 2026) et le
    // second jour de Chavou'ot en diaspora (jeudi 1er juin 2028) : le séfer
    // est sorti, mais pour la lecture de la fête, pas pour la paracha.
    for (const date of [new Date(2026, 8, 21), new Date(2026, 3, 2), new Date(2028, 5, 1)]) {
      const occ = activeOccasions(new HDate(date), false);
      expect(occ.has("torah-semaine")).toBe(false);
      expect(occ.has("sefer-torah")).toBe(true);
    }
  });

  it("suit le calendrier du lieu : Israël a parfois une paracha d'avance", () => {
    // Lundi 25 mai 2026 : Chavou'ot s'est achevé le samedi 23 en diaspora,
    // Israël, qui ne l'a fêté qu'un jour, a lu Nasso ce Chabbat-là. Le lundi
    // qui suit, Israël lit Beha'alotcha, la diaspora Nasso.
    const lundi = new Date(2026, 4, 25, 12);
    expect(activeOccasions(new HDate(lundi), true).has("torah-semaine")).toBe(true);
    expect(activeOccasions(new HDate(lundi), false).has("torah-semaine")).toBe(true);
    expect(getWeekdayTorahParasha(lundi, true)?.names).toEqual(["Beha'alotcha"]);
    expect(getWeekdayTorahParasha(lundi, false)?.names).toEqual(["Nasso"]);
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

describe("la veille de Kippour", () => {
  const veille = (year: number) => activeOccasions(new HDate(9, months.TISHREI, year), false);

  it("pose sa clé le 9 Tichri, et ce jour-là seulement", () => {
    // 5787 : la veille de Kippour tombe le dimanche 20 septembre 2026.
    expect(veille(5787).has("erev-kippour")).toBe(true);
    expect(activeOccasions(new HDate(8, months.TISHREI, 5787), false).has("erev-kippour")).toBe(
      false,
    );
    expect(activeOccasions(new HDate(10, months.TISHREI, 5787), false).has("erev-kippour")).toBe(
      false,
    );
  });

  it("reste dans les dix jours de techouva, et sans tahanoun", () => {
    // Le vidouy de sa Min'ha s'ajoute à ce que le jour porte déjà : Avinou
    // Malkénou et les ajouts des dix jours dans la 'Amida, « Yehi chem » à la
    // place du tahanoun.
    const occ = veille(5787);
    expect(occ.has("teshuva")).toBe(true);
    expect(occ.has("tahanoun")).toBe(false);
    expect(occ.has("sans-tahanoun")).toBe(true);
    expect(occ.has("sans-tahanoun-minha")).toBe(true);
    // Le Lamnatséa'h garde sa clé : c'est le fichier qui le retire ce jour-là
    // (`unless`), pour que les versions publiées gardent un psaume.
    expect(occ.has("lamnatseah-minha")).toBe(true);
  });

  it("tombe un vendredi quand Kippour tombe un Chabbat", () => {
    // 5785 : Kippour le samedi 12 octobre 2024, sa veille le vendredi 11. Le
    // psaume 93 de la veille de Chabbat tient alors la place du Lamnatséa'h.
    const vendredi = veille(5785);
    expect(vendredi.has("erev-kippour")).toBe(true);
    expect(vendredi.has("jour-5")).toBe(true);
    expect(vendredi.has("lamnatseah-minha")).toBe(false);
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

describe("les sli'hot des jeûnes", () => {
  it("nomment le jeûne du jour, et remplacent le tahanoun ordinaire", () => {
    // 3 Tichri 5786, un jeudi : le tahanoun se dit, mais ce sont les sli'hot
    // du jeûne qui le portent, pas le tahanoun ordinaire ni les supplications
    // du jeudi.
    const guedalia = activeOccasions(new HDate(3, months.TISHREI, 5786), false);
    expect(guedalia.has("selihot-tsom")).toBe(true);
    expect(guedalia.has("tsom-guedalia")).toBe(true);
    expect(guedalia.has("tahanoun")).toBe(true);
    expect(guedalia.has("tahanoun-ordinaire")).toBe(false);
    expect(guedalia.has("tahanoun-lundi-jeudi")).toBe(false);
    expect(activeOccasions(new HDate(10, months.TEVET, 5786), false).has("tsom-tevet")).toBe(true);
    expect(activeOccasions(new HDate(13, months.ADAR_II, 5786), false).has("tsom-esther")).toBe(
      true,
    );
    expect(activeOccasions(new HDate(17, months.TAMUZ, 5786), false).has("tsom-tamouz")).toBe(true);
    // Un jeûne ne porte que son nom.
    const noms = ["tsom-guedalia", "tsom-tevet", "tsom-esther", "tsom-tamouz"];
    expect(noms.filter((cle) => guedalia.has(cle))).toEqual(["tsom-guedalia"]);
  });

  it("laissent le tahanoun ordinaire aux autres jours", () => {
    // 10 'Hechvan 5786 est un samedi ; le lundi qui suit est ordinaire.
    const lundi = activeOccasions(new HDate(12, months.CHESHVAN, 5786), false);
    expect(lundi.has("tahanoun-ordinaire")).toBe(true);
    expect(lundi.has("tahanoun-lundi-jeudi")).toBe(true);
    expect(lundi.has("selihot-tsom")).toBe(false);
  });

  it("n'ont rien à faire à Tich'a beAv, qui n'a pas de tahanoun", () => {
    const neufAv = activeOccasions(new HDate(9, months.AV, 5786), false);
    expect(neufAv.has("taanit")).toBe(true);
    expect(neufAv.has("selihot-tsom")).toBe(false);
    expect(neufAv.has("tahanoun-ordinaire")).toBe(false);
    // Sa Min'ha n'est pas celle des quatre jeûnes non plus : ni « Chema'
    // koli » ni le psaume 20.
    expect(neufAv.has("tsom-minha")).toBe(false);
  });

  it("distinguent la Min'ha entière de celles de la veille de Pourim et du vendredi", () => {
    // 13 Adar II 5786, un lundi, veille de Pourim : le jeûne d'Esther n'est
    // pas avancé, sa Min'ha n'a pas de tahanoun.
    const veille = activeOccasions(new HDate(13, months.ADAR_II, 5786), false);
    expect(veille.has("tsom-esther-veille")).toBe(true);
    expect(veille.has("tsom-minha")).toBe(false);
    expect(veille.has("tahanoun-minha")).toBe(false);
    // 11 Adar II 5784, le jeudi où le jeûne est avancé (le 13 est un Chabbat).
    const avance = activeOccasions(new HDate(11, months.ADAR_II, 5784), false);
    expect(avance.has("tsom-esther")).toBe(true);
    expect(avance.has("tsom-esther-veille")).toBe(false);
    expect(avance.has("tsom-minha")).toBe(true);
    // 10 Tévet 5784, un vendredi.
    const vendredi = activeOccasions(new HDate(10, months.TEVET, 5784), false);
    expect(vendredi.has("tsom-vendredi")).toBe(true);
    expect(vendredi.has("tsom-minha")).toBe(false);
    expect(vendredi.has("jour-5")).toBe(true);
    // 10 Tévet 5786, un mardi : la Min'ha entière.
    const mardi = activeOccasions(new HDate(10, months.TEVET, 5786), false);
    expect(mardi.has("tsom-minha")).toBe(true);
    expect(mardi.has("tsom-vendredi")).toBe(false);
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

describe("'Hol haMoed, et le loulav de Souccot", () => {
  const occ = (jour: number, mois: number, annee: number) =>
    activeOccasions(new HDate(jour, mois, annee), false);

  it("nomme les jours intermédiaires, et eux seuls", () => {
    // Souccot 5787 : Yom Tov les 15 et 16 Tichri, 'Hol haMoed du 17 au 21,
    // Chemini 'Atséret le 22.
    expect(occ(15, months.TISHREI, 5787).has("hol-hamoed")).toBe(false);
    expect(occ(17, months.TISHREI, 5787).has("hol-hamoed")).toBe(true);
    expect(occ(21, months.TISHREI, 5787).has("hol-hamoed")).toBe(true);
    expect(occ(22, months.TISHREI, 5787).has("hol-hamoed")).toBe(false);
    // Pessah aussi : 'Hol haMoed y va du 17 au 20 Nissan.
    expect(occ(17, months.NISAN, 5787).has("hol-hamoed")).toBe(true);
    expect(occ(5, months.CHESHVAN, 5787).has("hol-hamoed")).toBe(false);
  });

  it("porte le loulav dans la Cha'harit de 'Hol haMoed, jamais le Chabbat", () => {
    // 5787 en diaspora : Yom Tov les 15 et 16 Tichri, que le sidour de
    // semaine ne sert pas (sans Hallel, les brahot y resteraient orphelines),
    // puis 'Hol haMoed du 17 au 21.
    expect(new HDate(15, months.TISHREI, 5787).getDay()).toBe(6);
    expect(occ(15, months.TISHREI, 5787).has("loulav")).toBe(false);
    expect(occ(16, months.TISHREI, 5787).has("loulav")).toBe(false);
    expect(occ(17, months.TISHREI, 5787).has("loulav")).toBe(true);
    expect(occ(21, months.TISHREI, 5787).has("loulav")).toBe(true);
    // En Israël, le 16 est déjà 'Hol haMoed.
    expect(activeOccasions(new HDate(16, months.TISHREI, 5787), true).has("loulav")).toBe(true);
  });

  it("ne pose le loulav que là où le Hallel le suit", () => {
    // Les brahot précèdent le Hallel dans Cha'harit : un jour qui porterait
    // l'un sans l'autre les montrerait sans suite.
    for (let jour = 15; jour <= 23; jour++) {
      for (const il of [false, true]) {
        const o = activeOccasions(new HDate(jour, months.TISHREI, 5787), il);
        if (o.has("loulav")) expect(o.has("hallel")).toBe(true);
      }
    }
  });

  it("ne le prend plus à Chemini 'Atséret ni hors de Souccot", () => {
    expect(occ(22, months.TISHREI, 5787).has("loulav")).toBe(false);
    expect(occ(23, months.TISHREI, 5787).has("loulav")).toBe(false);
    expect(occ(17, months.NISAN, 5787).has("loulav")).toBe(false);
  });

  it("compte les sept jours de la fête sur la date, une clé par jour", () => {
    const jours: string[] = [];
    for (let date = 14; date <= 23; date++) {
      const cles = [...occ(date, months.TISHREI, 5787)].filter((cle) =>
        cle.startsWith("souccot-"),
      );
      jours.push(cles.join(",") || "-");
    }
    expect(jours).toEqual([
      "-",
      "souccot-1",
      "souccot-2",
      "souccot-3",
      "souccot-4",
      "souccot-5",
      "souccot-6",
      "souccot-7",
      "-",
      "-",
    ]);
    // Le même jour en Terre d'Israël : la date ne change pas, la répartition
    // des montées si.
    const israel = activeOccasions(new HDate(18, months.TISHREI, 5787), true);
    expect(israel.has("souccot-4")).toBe(true);
    expect(israel.has("eretz-israel")).toBe(true);
    expect(israel.has("houts-laarets")).toBe(false);
    expect(occ(18, months.TISHREI, 5787).has("houts-laarets")).toBe(true);
    expect(occ(18, months.TISHREI, 5787).has("eretz-israel")).toBe(false);
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

describe("la sortie de Chabbat et de Yom Tov (Ata 'honantanou)", () => {
  it("le jour hébraïque qui suit un Chabbat", () => {
    // Un dimanche de 'Hechvan : la veille était Chabbat. Arvit du samedi soir
    // vit déjà ce jour-là (voir tefilaHebrewDay). Le lundi n'a rien à séparer.
    const dimanche = hebrewDayOfWeek(0, new HDate(1, months.CHESHVAN, 5786));
    expect(activeOccasions(dimanche, false).has("motsae")).toBe(true);
    expect(activeOccasions(dimanche.next(), false).has("motsae")).toBe(false);
  });

  it("le jour qui suit un Yom Tov, s'il n'en est pas un lui-même", () => {
    // 11 Tichri, lendemain de Kippour ; 23 Tichri en Israël (lendemain de
    // Chemini 'Atséret), mais pas en diaspora, où c'est Sim'hat Torah.
    expect(activeOccasions(new HDate(11, months.TISHREI, 5787), false).has("motsae")).toBe(true);
    expect(activeOccasions(new HDate(23, months.TISHREI, 5787), true).has("motsae")).toBe(true);
    expect(activeOccasions(new HDate(23, months.TISHREI, 5787), false).has("motsae")).toBe(false);
    // 'Hol haMoed qui suit le premier jour de Pessah en Israël : Ata
    // 'honantanou avec Ya'alé véyavo.
    const holHamoed = activeOccasions(new HDate(16, months.NISAN, 5787), true);
    expect(holHamoed.has("motsae")).toBe(true);
    expect(holHamoed.has("moed")).toBe(true);
    // Le second jour de fête de diaspora n'a rien à séparer.
    expect(activeOccasions(new HDate(16, months.NISAN, 5787), false).has("motsae")).toBe(false);
  });
});

describe("Hochana Rabba", () => {
  it("le 21 Tichri, et lui seul", () => {
    expect(activeOccasions(new HDate(21, months.TISHREI, 5787), false).has("hoshana-rabba")).toBe(
      true,
    );
    expect(activeOccasions(new HDate(20, months.TISHREI, 5787), false).has("hoshana-rabba")).toBe(
      false,
    );
  });
});

describe("la condition d'un passage (saidOn)", () => {
  const jour = new Set(["teshuva", "ete"]);

  it("une clé, sa négation, ou l'une de plusieurs", () => {
    expect(saidOn(undefined, jour)).toBe(true);
    expect(saidOn("teshuva", jour)).toBe(true);
    expect(saidOn("hiver", jour)).toBe(false);
    expect(saidOn("!teshuva", jour)).toBe(false);
    expect(saidOn("!hiver", jour)).toBe(true);
    expect(saidOn("hoshana-rabba|teshuva", jour)).toBe(true);
    expect(saidOn("hoshana-rabba|hiver", jour)).toBe(false);
  });

  it("l'exception (unless) retire le passage, et l'emporte sur la condition", () => {
    // La forme qu'écrivent les fichiers : le texte ordinaire n'a pas de
    // condition, l'occasion du jour le retire (voir
    // docs/compatibilite-textes.md).
    expect(saidOn(undefined, jour, "teshuva")).toBe(false);
    expect(saidOn(undefined, jour, "hiver")).toBe(true);
    expect(saidOn("ete", jour, "teshuva")).toBe(false);
    expect(saidOn("ete", jour, "hiver")).toBe(true);
    expect(saidOn("hiver", jour, "rosh-chodesh")).toBe(false);
    // Une exception vide ne retire rien.
    expect(saidOn("teshuva", jour, undefined)).toBe(true);
  });
});
