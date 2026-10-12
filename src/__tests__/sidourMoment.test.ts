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

/**
 * Ce que la page du Sidour met en tête : l'office dont c'est l'heure (ou
 * celui qui vient), avec ce que le jour y ajoute ; l'allumage de 'Hanouka le
 * soir ; les Sli'hot de 'hatsot au lever du soleil ; et ce qui se dit aussi
 * maintenant (havdala, Chema du coucher). Les heures sont celles de Paris
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

  it("le soir : Arvit, puis le Chema du coucher", () => {
    const { hero, extras } = sidourMoment(DEFAULT_PLACE, at("2026-10-12T22:30:00+02:00"));
    expect(hero?.tefila).toBe("arvit");
    expect(hero?.day).toBeNull();
    expect(extras.map((x) => x.key)).toContain("chema");
  });

  it("à la sortie du Chabbat : Arvit avec Ata 'honantanou, et la havdala", () => {
    // Samedi 17 octobre 2026, au soir.
    const { hero, extras } = sidourMoment(DEFAULT_PLACE, at("2026-10-17T20:30:00+02:00"));
    expect(hero?.tefila).toBe("arvit");
    expect(hero?.day).toBe("motsaeChabbat");
    expect(hero?.additions.map((a) => a.key)).toContain("ataHonantanou");
    expect(extras.map((x) => x.key)).toContain("havdala");
  });

  it("un soir de 'Hanouka : l'allumage passe devant Arvit, qui suit", () => {
    // Mardi 8 décembre 2026 : le cinquième soir.
    const moment = sidourMoment(DEFAULT_PLACE, at("2026-12-08T17:40:00+01:00"));
    expect(moment.hero?.kind).toBe("hanouka");
    expect(moment.hero?.night).toBe(5);
    expect(moment.extras[0]).toMatchObject({ key: "tefila", tefila: "arvit" });
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
    expect(moment.extras[0]).toMatchObject({ key: "tefila", tefila: "chaharit" });
    expect(moment.feast).toBe("tichri");
  });

  it("le soir, en Eloul, annonce les Sli'hot de la nuit", () => {
    const { extras } = sidourMoment(DEFAULT_PLACE, at("2026-09-06T21:30:00+02:00"));
    expect(extras.map((x) => x.key)).toContain("slihot");
  });

  it("n'annonce jamais plus de trois textes sous la carte", () => {
    for (const iso of [
      "2026-10-17T20:30:00+02:00",
      "2026-09-06T21:30:00+02:00",
      "2026-12-08T17:40:00+01:00",
    ]) {
      expect(sidourMoment(DEFAULT_PLACE, at(iso)).extras.length).toBeLessThanOrEqual(3);
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
