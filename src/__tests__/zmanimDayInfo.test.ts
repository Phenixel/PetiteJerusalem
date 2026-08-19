import { describe, it, expect } from "vitest";
import { HDate } from "@hebcal/core";
import {
  DEFAULT_PLACE,
  dayHighlights,
  festivalsOn,
  restPeriodAt,
  restPeriodsNear,
  saysBirkatHalevana,
  tachanunStatus,
  yearCalendar,
  type ZmanimPlace,
} from "../services/zmanimService";

// Le calendrier du jour sur la page des horaires : Roch Hodech et fêtes,
// et la ligne du tahanoun.

const israel: ZmanimPlace = {
  source: "city",
  latitude: 31.76904,
  longitude: 35.21633,
  tzid: "Asia/Jerusalem",
  city: "Jérusalem",
};

// Tromsø : au-delà du cercle polaire, ni chkia ni sortie des étoiles une
// partie de l'année. Les fêtes y tombent tout de même.
const tromso: ZmanimPlace = {
  source: "city",
  latitude: 69.6496,
  longitude: 18.9553,
  tzid: "Europe/Oslo",
  city: "Tromsø",
};

const hd = (y: number, m: number, d: number) => new HDate(new Date(y, m - 1, d, 12));

describe("dayHighlights", () => {
  it("nomme le Roch Hodech en français", () => {
    // 13 août 2026 = 30 Av 5786, Roch Hodech Eloul.
    const names = dayHighlights(DEFAULT_PLACE, hd(2026, 8, 13), "fr");
    expect(names).toHaveLength(1);
    expect(names[0]).toContain("Roch");
    expect(names[0]).toContain("Eloul");
  });

  it("rend un jour ordinaire sans rien", () => {
    // 18 août 2026 = 5 Eloul 5786, jour de semaine ordinaire.
    expect(dayHighlights(DEFAULT_PLACE, hd(2026, 8, 18), "fr")).toEqual([]);
  });

  it("écarte les Yom Tov : ils ont leur cadre, avec leurs heures", () => {
    // 12 septembre 2026 = 1 Tichri 5787, Roch Hachana (et Chabbat).
    const day = hd(2026, 9, 12);
    expect(restPeriodAt(DEFAULT_PLACE, day, "fr")!.festivals).toEqual(["Roch Hachanah"]);
    expect(dayHighlights(DEFAULT_PLACE, day, "fr")).toEqual([]);
  });

  it("suit le calendrier d'Israël en Asia/Jerusalem", () => {
    // 3 avril 2026 = 16 Nissan 5786 : Yom Tov II de Pessah en diaspora (donc
    // dans le cadre du repos, pas ici), déjà 'Hol haMoed en Israël.
    const day = hd(2026, 4, 3);
    expect(dayHighlights(DEFAULT_PLACE, day, "en")).toEqual([]);
    expect(dayHighlights(israel, day, "en").join(" ")).toContain("CH’’M");
  });
});

describe("festivalsOn", () => {
  it("nomme le Yom Tov sans son numéro de jour", () => {
    // 3 avril 2026 = 16 Nissan : Pessah II en diaspora. Un seul nom, celui de
    // la fête, sans le « II ».
    const names = festivalsOn(DEFAULT_PLACE, hd(2026, 4, 3), "fr");
    expect(names).toHaveLength(1);
    expect(names[0]).toContain("Pessa");
    expect(names[0]).not.toContain("II");
  });

  it("ne retient que les Yom Tov", () => {
    // 30 Av, Roch Hodech Eloul : pas un jour de fête chômé.
    expect(festivalsOn(DEFAULT_PLACE, hd(2026, 8, 13), "fr")).toEqual([]);
    // 'Hol haMoed non plus.
    expect(festivalsOn(israel, hd(2026, 4, 3), "fr")).toEqual([]);
  });
});

describe("tachanunStatus", () => {
  it("jour ordinaire : Ta'hanoun à Cha'harit et Min'ha", () => {
    // Mardi 18 août 2026, 5 Eloul.
    expect(tachanunStatus(DEFAULT_PLACE, hd(2026, 8, 18))).toBe("full");
  });

  it("vendredi : Cha'harit seulement (veille de Chabbat)", () => {
    expect(tachanunStatus(DEFAULT_PLACE, hd(2026, 8, 21))).toBe("shacharitOnly");
  });

  it("Roch Hodech : pas de Ta'hanoun", () => {
    expect(tachanunStatus(DEFAULT_PLACE, hd(2026, 8, 13))).toBe("none");
  });

  it("Chabbat : pas de ligne du tout", () => {
    expect(tachanunStatus(DEFAULT_PLACE, hd(2026, 8, 22))).toBeNull();
  });
});

describe("restPeriodsNear", () => {
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

  it("semaine ordinaire : le seul Chabbat, sans fête", () => {
    // Mercredi 19 août 2026.
    const periods = restPeriodsNear(DEFAULT_PLACE, at(2026, 8, 19), "fr");
    expect(periods).toHaveLength(1);
    expect(periods[0].festivals).toEqual([]);
    expect(periods[0].shabbat).not.toBeNull();
    // Entrée le vendredi soir, sortie le samedi soir.
    expect(periods[0].start.getDay()).toBe(5);
    expect(periods[0].end.getDay()).toBe(6);
  });

  it("Roch Hachana un Chabbat : un seul bloc, du vendredi au dimanche soir", () => {
    // 12 septembre 2026 = 1 Tichri 5787, un samedi ; le 2e jour suit le dimanche.
    const periods = restPeriodsNear(DEFAULT_PLACE, at(2026, 9, 10), "fr");
    expect(periods).toHaveLength(1);
    expect(periods[0].festivals).toEqual(["Roch Hachanah"]);
    expect(periods[0].shabbat).not.toBeNull();
    expect(periods[0].start.getDate()).toBe(11); // vendredi 11, allumage
    expect(periods[0].end.getDate()).toBe(13); // dimanche 13, sortie
  });

  it("Chemini Atséret et Sim'hat Torah tiennent dans le même bloc", () => {
    const periods = restPeriodsNear(DEFAULT_PLACE, at(2026, 10, 1), "fr");
    expect(periods[0].festivals).toHaveLength(2);
    expect(periods[0].festivals[0]).toContain("Chemini");
  });

  it("Pessah : les premiers jours, puis les derniers, séparés par le 'Hol haMoed", () => {
    // 5787 : veille de Pessah, le mercredi 21 avril 2027 à midi, avant
    // l'allumage du soir, les deux blocs de la fête sont encore devant.
    const periods = restPeriodsNear(DEFAULT_PLACE, at(2027, 4, 21), "fr");
    expect(periods).toHaveLength(2);
    // 15 à 17 Nissan : les deux jours de fête, prolongés par le Chabbat.
    expect(periods[0].first.getDate()).toBe(15);
    expect(periods[0].last.getDate()).toBe(17);
    expect(periods[1].first.getDate()).toBe(21); // 21 Nissan, Pessah VII
  });

  it("une fois dedans, le bloc en cours suffit", () => {
    // Samedi 12 septembre 2026 à midi : on est dans Roch Hachana.
    const periods = restPeriodsNear(DEFAULT_PLACE, at(2026, 9, 12), "fr");
    expect(periods).toHaveLength(1);
    expect(periods[0].festivals).toEqual(["Roch Hachanah"]);
  });
});

describe("yearCalendar", () => {
  const entries = yearCalendar(DEFAULT_PLACE, 5787, "fr");
  const named = (needle: string) => entries.filter((e) => e.name.includes(needle));

  it("va de Roch Hachana à la fin de l'année, dans l'ordre", () => {
    expect(entries.length).toBeGreaterThan(10);
    expect(entries[0].name).toContain("Roch Hachanah");
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].first.abs()).toBeGreaterThanOrEqual(entries[i - 1].first.abs());
    }
  });

  it("donne à chaque Yom Tov son entrée et sa sortie", () => {
    const kippour = named("Yom Kippour")[0];
    expect(kippour.period).not.toBeNull();
    expect(kippour.period!.start.getTime()).toBeLessThan(kippour.period!.end.getTime());
  });

  it("sépare les deux blocs de Pessah, et laisse le 'Hol haMoed dehors", () => {
    // Nom exact : « Pessah Cheni », un mois plus tard, est une autre fête.
    const pessah = entries.filter((e) => e.name === named("Pessa")[0].name);
    expect(pessah).toHaveLength(2);
    expect(pessah[0].first.getDate()).toBe(15);
    expect(pessah[1].first.getDate()).toBe(21);
  });

  it("'Hanouka tient en une entrée de huit jours, sans horaires", () => {
    const hanouka = named("anoukah");
    expect(hanouka).toHaveLength(1);
    expect(hanouka[0].period).toBeNull();
    expect(hanouka[0].last.abs() - hanouka[0].first.abs()).toBe(7);
  });

  it("ne porte ni Roch Hodech ni Chabbat ordinaire", () => {
    expect(named("Roch H\u2019odech")).toEqual([]);
    for (const entry of entries) expect(entry.name).not.toBe("");
  });

  it("garde les fêtes des lieux où les heures ne se calculent pas", () => {
    // Sous le soleil de minuit, Chavouot n'a ni allumage ni sortie : la fête
    // doit rester au calendrier, sans horaires, plutôt que d'en disparaître.
    const polar = yearCalendar(tromso, 5787, "fr");
    const chavouot = polar.filter((e) => e.name.includes("Chavou"));
    expect(chavouot).toHaveLength(1);
    expect(chavouot[0].period).toBeNull();
    expect(polar.filter((e) => e.name.includes("Roch Hachanah"))).not.toEqual([]);
  });
});

describe("saysBirkatHalevana", () => {
  it("de sept jours révolus à la moitié de la lunaison", () => {
    expect(saysBirkatHalevana(hd(2026, 8, 19))).toBe(false); // 6 Eloul, trop tôt
    expect(saysBirkatHalevana(hd(2026, 8, 20))).toBe(true); // 7 Eloul
    expect(saysBirkatHalevana(hd(2026, 8, 27))).toBe(true); // 14 Eloul
    expect(saysBirkatHalevana(hd(2026, 8, 28))).toBe(false); // 15 Eloul, trop tard
  });

  it("attend la sortie de Tich'a beAv, et celle de Kippour", () => {
    expect(saysBirkatHalevana(hd(2026, 7, 20))).toBe(false); // 6 Av, avant le jeûne
    expect(saysBirkatHalevana(hd(2026, 9, 20))).toBe(false); // 9 Tichri, avant Kippour
    expect(saysBirkatHalevana(hd(2026, 9, 22))).toBe(true); // 11 Tichri
  });
});
