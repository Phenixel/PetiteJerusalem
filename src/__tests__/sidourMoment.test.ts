import { describe, expect, it } from "vitest";
import { HDate, months } from "@hebcal/core";
import {
  currentFeast,
  hanoukaNight,
  isSlihotMorning,
  sidourMoment,
  tefilaAdditions,
} from "../services/sidourMoment";
import { DEFAULT_PLACE } from "../services/zmanimService";
import { orderTools, SIDOUR_TOOLS } from "../content/sidourTools";
import fr from "../locales/fr";
import en from "../locales/en";
import he from "../locales/he";

/**
 * Ce que la page du Sidour met en tête : une carte, l'office dont c'est
 * l'heure (ou celui qui vient), avec ce que le jour y ajoute ; l'allumage de
 * 'Hanouka le soir ; les Sli'hot de 'hatsot au lever du soleil ; la lune les
 * nuits où on la bénit ; la fête entre deux offices ; et une ligne dessous au
 * plus, un soir d'occasion (l'office, la havdala) ; et l'ordre des outils, celui du
 * moment devant. Les heures sont celles de Paris
 * (le lieu par défaut), écrites avec leur décalage pour ne pas dépendre du
 * fuseau de la machine de test.
 */
const at = (iso: string) => new Date(iso);

describe("la carte du moment", () => {
  it("un matin de Roch 'Hodech : Cha'harit, avec Ya'alé véyavo, le Hallel et Moussaf", () => {
    // Lundi 12 octobre 2026, 1er 'Hechvan 5787.
    const { hero } = sidourMoment(DEFAULT_PLACE, at("2026-10-12T09:40:00+02:00"));
    expect(hero?.kind).toBe("tefila");
    expect(hero?.tefila).toBe("chaharit");
    expect(hero?.day).toBe("roshHodech");
    expect(hero?.additions.map((a) => a.key)).toEqual(["yaaleVeyavo", "hallel", "moussaf"]);
    expect(hero?.end && hero.end.getTime()).toBeGreaterThan(
      at("2026-10-12T13:00:00+02:00").getTime(),
    );
  });

  it("entre 'hatsot et min'ha guedola : Min'ha annoncée, pas une carte vide", () => {
    const { hero } = sidourMoment(DEFAULT_PLACE, at("2026-10-12T13:50:00+02:00"));
    expect(hero?.kind).toBe("next-tefila");
    expect(hero?.tefila).toBe("minha");
    expect(hero?.start && hero.start.getTime()).toBeGreaterThan(
      at("2026-10-12T13:50:00+02:00").getTime(),
    );
  });

  it("le soir : Arvit seul, le Chema du coucher reste dans la liste", () => {
    const { hero, extra } = sidourMoment(DEFAULT_PLACE, at("2026-10-12T22:30:00+02:00"));
    expect(hero?.tefila).toBe("arvit");
    expect(hero?.day).toBeNull();
    expect(extra).toBeNull();
  });

  it("à la sortie du Chabbat : Arvit avec Ata 'honantanou, et la havdala", () => {
    // Samedi 17 octobre 2026, au soir.
    const { hero, extra } = sidourMoment(DEFAULT_PLACE, at("2026-10-17T20:30:00+02:00"));
    expect(hero?.tefila).toBe("arvit");
    expect(hero?.day).toBe("motsaeChabbat");
    expect(hero?.additions.map((a) => a.key)).toContain("ataHonantanou");
    expect(extra?.key).toBe("havdala");
  });

  it("un soir de 'Hanouka : l'allumage passe devant Arvit, qui suit", () => {
    // Mardi 8 décembre 2026 : le cinquième soir.
    const moment = sidourMoment(DEFAULT_PLACE, at("2026-12-08T17:40:00+01:00"));
    expect(moment.hero?.kind).toBe("hanouka");
    expect(moment.hero?.night).toBe(5);
    expect(moment.extra).toMatchObject({ key: "tefila", tefila: "arvit" });
    expect(moment.feast).toBe("hanouka");
  });

  it("le vendredi de 'Hanouka : allumer avant le Chabbat", () => {
    // Vendredi 4 décembre 2026, en fin d'après-midi : le premier soir.
    const { hero } = sidourMoment(DEFAULT_PLACE, at("2026-12-04T16:20:00+01:00"));
    expect(hero?.kind).toBe("hanouka");
    expect(hero?.night).toBe(1);
    expect(hero?.beforeShabbat).toBeInstanceOf(Date);
  });

  it("le soir de Chabbat 'Hanouka n'annonce pas d'allumage", () => {
    const { hero } = sidourMoment(DEFAULT_PLACE, at("2026-12-04T19:00:00+01:00"));
    expect(hero?.kind).not.toBe("hanouka");
  });

  it("une nuit d'Eloul, après 'hatsot : les Sli'hot, puis Cha'harit", () => {
    // Lundi 7 septembre 2026, 25 Eloul 5786, avant l'aube.
    const moment = sidourMoment(DEFAULT_PLACE, at("2026-09-07T05:30:00+02:00"));
    expect(moment.hero?.kind).toBe("slihot");
    expect(moment.hero?.day).toBe("eloul");
    expect(moment.extra).toMatchObject({ key: "tefila", tefila: "chaharit" });
    expect(moment.feast).toBe("tichri");
  });

  it("le soir, en Eloul : Arvit seul, les Sli'hot sont en tête de la liste", () => {
    const { hero, extra } = sidourMoment(DEFAULT_PLACE, at("2026-09-06T21:30:00+02:00"));
    expect(hero?.tefila).toBe("arvit");
    expect(extra).toBeNull();
  });

  it("les nuits de la bénédiction de la lune, la lune prend la carte, Arvit dessous", () => {
    // Mardi 20 octobre 2026, 10 'Hechvan : la lune a un peu plus de neuf jours.
    const moment = sidourMoment(DEFAULT_PLACE, at("2026-10-20T21:00:00+02:00"));
    expect(moment.hero?.kind).toBe("halevana");
    expect(moment.hero?.until?.getDate()).toBe(15);
    expect(moment.hero?.moonAge).toBeGreaterThan(9);
    expect(moment.hero?.moonAge).toBeLessThan(10);
    expect(moment.extra).toMatchObject({ key: "tefila", tefila: "arvit" });
  });

  it("un motsaé Chabbat de la lune : la lune, et la havdala plutôt qu'Arvit", () => {
    // Samedi 24 octobre 2026, 14 'Hechvan.
    const moment = sidourMoment(DEFAULT_PLACE, at("2026-10-24T21:00:00+02:00"));
    expect(moment.hero?.kind).toBe("halevana");
    expect(moment.extra?.key).toBe("havdala");
  });

  it("pas de lune avant la nuit : Min'ha, puis Arvit qui vient", () => {
    expect(sidourMoment(DEFAULT_PLACE, at("2026-10-20T15:00:00+02:00")).hero?.kind).toBe("tefila");
  });

  it("à Souccot, l'office seul en tête : le loulav et les Hochanot sont juste dessous", () => {
    // Lundi 28 septembre 2026, 'Hol hamoed.
    const moment = sidourMoment(DEFAULT_PLACE, at("2026-09-28T10:00:00+02:00"));
    expect(moment.hero?.tefila).toBe("chaharit");
    expect(moment.extra).toBeNull();
    expect(moment.feast).toBe("souccot");
  });

  it("entre deux offices, la fête prend la carte", () => {
    // Souccot, entre 'hatsot et min'ha guedola : le loulav, jusqu'à la chkia.
    const souccot = sidourMoment(DEFAULT_PLACE, at("2026-09-28T13:50:00+02:00")).hero;
    expect(souccot).toMatchObject({
      kind: "feast",
      feast: "souccot",
      text: "moadim/netilat-loulav",
    });
    expect(souccot?.end).toBeInstanceOf(Date);
    // 'Hanouka, au même moment de la journée : l'allumage du soir, cinquième bougie.
    const hanouka = sidourMoment(DEFAULT_PLACE, at("2026-12-08T12:50:00+01:00")).hero;
    expect(hanouka).toMatchObject({ kind: "feast", feast: "hanouka", night: 5 });
  });

  it("jamais plus d'une ligne sous la carte, et seulement sous une occasion", () => {
    for (const iso of [
      "2026-10-12T09:40:00+02:00",
      "2026-10-12T13:50:00+02:00",
      "2026-09-28T13:50:00+02:00",
      "2026-12-08T12:50:00+01:00",
    ]) {
      expect({ iso, extra: sidourMoment(DEFAULT_PLACE, at(iso)).extra }).toEqual({
        iso,
        extra: null,
      });
    }
  });
});

describe("ce que le jour ajoute à un office", () => {
  const hd = new HDate(1, months.CHESHVAN, 5787);
  const keys = (tefila: "chaharit" | "minha" | "arvit", occasions: string[]) =>
    tefilaAdditions(tefila, new Set(occasions), hd).map((a) => a.key);

  it("Ya'alé véyavo aux jours de moed, jamais un Yom Tov", () => {
    expect(keys("minha", ["moed", "rosh-chodesh"])).toEqual(["yaaleVeyavo"]);
    expect(keys("minha", ["moed", "yom-tov"])).toEqual([]);
  });

  it("le Hallel et Moussaf ne vont qu'à Cha'harit", () => {
    expect(keys("chaharit", ["hallel", "moussaf"])).toEqual(["hallel", "moussaf"]);
    expect(keys("minha", ["hallel", "moussaf"])).toEqual([]);
  });

  it("'Anénou un jour de jeûne, à Cha'harit et à Min'ha", () => {
    expect(keys("chaharit", ["taanit"])).toEqual(["anenou"]);
    expect(keys("minha", ["taanit"])).toEqual(["anenou"]);
    expect(keys("arvit", ["taanit"])).toEqual([]);
  });

  it("le compte du 'Omer à Arvit", () => {
    const omer = new HDate(20, months.NISAN, 5787);
    expect(tefilaAdditions("arvit", new Set(), omer)).toEqual([{ key: "omer", n: 5 }]);
  });
});

describe("le calendrier du Sidour", () => {
  it("les textes d'une fête remontent le temps de la fête", () => {
    expect(currentFeast(new HDate(1, months.ELUL, 5786))).toBe("tichri");
    expect(currentFeast(new HDate(10, months.TISHREI, 5787))).toBe("tichri");
    expect(currentFeast(new HDate(15, months.TISHREI, 5787))).toBe("souccot");
    expect(currentFeast(new HDate(23, months.TISHREI, 5787))).toBe("souccot");
    expect(currentFeast(new HDate(25, months.KISLEV, 5787))).toBe("hanouka");
    expect(currentFeast(new HDate(2, months.TEVET, 5787))).toBe("hanouka");
    expect(currentFeast(new HDate(1, months.CHESHVAN, 5787))).toBeNull();
  });

  it("compte les soirs de 'Hanouka", () => {
    expect(hanoukaNight(new HDate(25, months.KISLEV, 5787))).toBe(1);
    expect(hanoukaNight(new HDate(24, months.KISLEV, 5787))).toBeNull();
  });

  it("les matins des Sli'hot : Eloul et les jours de techouva, ni Roch Hachana ni Chabbat", () => {
    expect(isSlihotMorning(new HDate(3, months.ELUL, 5786))).toBe(true); // un dimanche
    expect(isSlihotMorning(new HDate(1, months.TISHREI, 5787))).toBe(false);
    expect(isSlihotMorning(new HDate(9, months.TISHREI, 5787))).toBe(true);
    expect(isSlihotMorning(new HDate(10, months.TISHREI, 5787))).toBe(false);
    const shabbat = new HDate(new Date(2026, 8, 5, 12)); // samedi 5 septembre 2026
    expect(shabbat.getDay()).toBe(6);
    expect(isSlihotMorning(shabbat)).toBe(false);
  });
});

describe("les outils du moment", () => {
  const tools = (iso: string) => sidourMoment(DEFAULT_PLACE, at(iso)).tools;

  it("un matin de semaine, le miroir des téfilines passe devant la boussole", () => {
    // Mardi 13 octobre 2026 : Cha'harit s'ouvre à 7 h 03 (misheyakir).
    expect(tools("2026-10-13T08:00:00+02:00")).toEqual(["tefilin", "kotel"]);
    // Dans l'heure qui précède : on pose les téfilines avant l'office.
    expect(tools("2026-10-13T06:30:00+02:00")).toEqual(["tefilin", "kotel"]);
  });

  it("le reste du temps, la boussole du Kotel tient la tête", () => {
    expect(tools("2026-10-13T03:00:00+02:00")).toEqual(["kotel", "tefilin"]);
    expect(tools("2026-10-13T13:50:00+02:00")).toEqual(["kotel", "tefilin"]);
  });

  it("pas de miroir devant les matins sans téfilines : Chabbat, 'Hol hamoed, 9 Av", () => {
    expect(tools("2026-10-17T09:00:00+02:00")).toEqual(["kotel", "tefilin"]); // Chabbat
    expect(tools("2026-09-28T10:00:00+02:00")).toEqual(["naanouim", "kotel", "tefilin"]); // 'Hol hamoed
    expect(tools("2027-08-12T08:00:00+02:00")).toEqual(["kotel", "tefilin"]); // 9 Av 5787
  });

  it("les six côtés du na'anou'a, le temps de Souccot, devant le jour où l'on prend le loulav", () => {
    // Lundi 28 septembre 2026, 'Hol hamoed ; vendredi 2 octobre, Hochana Rabba.
    expect(tools("2026-09-28T10:00:00+02:00")).toEqual(["naanouim", "kotel", "tefilin"]);
    expect(tools("2026-10-02T11:00:00+02:00")).toEqual(["naanouim", "kotel", "tefilin"]);
    // Le soir où la fête entre, et le Chabbat où on ne prend pas le loulav :
    // de saison, mais pas devant.
    expect(tools("2026-09-25T20:30:00+02:00")).toEqual(["kotel", "tefilin", "naanouim"]);
    expect(tools("2026-09-26T11:00:00+02:00")).toEqual(["kotel", "tefilin", "naanouim"]);
    // Chemini Atseret, et le reste de l'année : plus de na'anou'a.
    expect(tools("2026-10-03T11:00:00+02:00")).not.toContain("naanouim");
    expect(tools("2026-10-13T08:00:00+02:00")).not.toContain("naanouim");
  });
});

describe("la rangée d'outils", () => {
  it("met les outils du moment devant, sans doublon, et laisse un outil hors saison dehors", () => {
    expect(orderTools([], new Set())).toEqual(["kotel", "tefilin"]);
    expect(orderTools(["tefilin", "tefilin"], new Set())).toEqual(["tefilin", "kotel"]);
    expect(orderTools(["naanouim"], new Set())).toEqual(["kotel", "tefilin"]);
    expect(orderTools(["naanouim"], new Set(["naanouim"]))).toEqual([
      "naanouim",
      "kotel",
      "tefilin",
    ]);
  });

  it("chaque outil a son nom dans les trois langues", () => {
    for (const tool of SIDOUR_TOOLS) {
      for (const messages of [fr, en, he]) {
        const value = tool.labelKey
          .split(".")
          .reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], messages);
        expect(typeof value, `${tool.labelKey}`).toBe("string");
      }
    }
  });
});
