import { describe, expect, it } from "vitest";
import { DAF_YOMI_CYCLE_DAYS, DAF_YOMI_TRACTATES, getDafYomi } from "../services/dafYomi";

/**
 * Le Daf hayomi : le calcul de hebcal, refait ici avec les noms du catalogue.
 * Les dates de référence sont celles des débuts de cycle, connues de tous
 * (le quatorzième cycle a commencé le 5 janvier 2020 par Berakhot 2).
 */
describe("getDafYomi", () => {
  it("commence le quatorzième cycle par Berakhot 2, le 5 janvier 2020", () => {
    const daf = getDafYomi(new Date(2020, 0, 5, 12));
    expect(daf).toMatchObject({ tractate: "Berakhot", blatt: 2, cycle: 14 });
    expect(daf?.dafs).toEqual(["2a", "2b"]);
    expect(daf?.entry?.name).toContain("Berakhot");
  });

  it("passe à Chabbat 2 le 8 mars 2020, quand Berakhot est fini", () => {
    // Berakhot compte 63 dafs (2 à 64) : le 64e jour du cycle ouvre Chabbat.
    expect(getDafYomi(new Date(2020, 2, 7, 12))).toMatchObject({
      tractate: "Berakhot",
      blatt: 64,
    });
    expect(getDafYomi(new Date(2020, 2, 8, 12))).toMatchObject({ tractate: "Shabbat", blatt: 2 });
  });

  it("retrouve le début du treizième cycle, le 3 août 2012", () => {
    // Les cycles d'avant 2020 se comptent à rebours, 2711 jours chacun.
    expect(getDafYomi(new Date(2012, 7, 3, 12))).toMatchObject({
      tractate: "Berakhot",
      blatt: 2,
      cycle: 13,
    });
    expect(getDafYomi(new Date(2012, 7, 2, 12))).toMatchObject({
      tractate: "Niddah",
      blatt: 73,
      cycle: 12,
    });
  });

  it("ferme le cycle sur Nidda 73, puis recommence", () => {
    const last = new Date(2020, 0, 5, 12);
    last.setDate(last.getDate() + DAF_YOMI_CYCLE_DAYS - 1);
    expect(getDafYomi(last)).toMatchObject({ tractate: "Niddah", blatt: 73, cycle: 14 });
    const next = new Date(last);
    next.setDate(next.getDate() + 1);
    expect(getDafYomi(next)).toMatchObject({ tractate: "Berakhot", blatt: 2, cycle: 15 });
  });

  it("annonce Kinnim, Tamid et Middot dans la pagination de Vilna", () => {
    // Meïla finit au daf 22 ; Kinnim commence au 23 du même volume, et le
    // fichier de la bibliothèque, lui, compte depuis 2.
    let day = new Date(2020, 0, 5, 12);
    let daf = getDafYomi(day);
    while (daf && daf.tractate !== "Kinnim") {
      day.setDate(day.getDate() + 1);
      daf = getDafYomi(day);
    }
    expect(daf).toMatchObject({ tractate: "Kinnim", blatt: 23 });
    expect(daf?.dafs).toEqual(["2a", "2b"]);
    day = new Date(day);
    day.setDate(day.getDate() - 1);
    expect(getDafYomi(day)).toMatchObject({ tractate: "Meilah", blatt: 22 });
  });

  it("ne répond rien avant le huitième cycle", () => {
    expect(getDafYomi(new Date(1975, 5, 23, 12))).toBeNull();
    expect(getDafYomi(new Date(1975, 5, 24, 12))).toMatchObject({
      tractate: "Berakhot",
      blatt: 2,
      cycle: 8,
    });
  });

  it("trouve chaque traité du cycle dans le catalogue", () => {
    // Un traité absent laisserait un daf sans texte pendant des semaines.
    const day = new Date(2020, 0, 5, 12);
    const seen = new Map<string, boolean>();
    for (let i = 0; i < DAF_YOMI_CYCLE_DAYS; i++) {
      const daf = getDafYomi(day);
      expect(daf).not.toBeNull();
      seen.set(daf!.tractate, daf!.entry !== null);
      day.setDate(day.getDate() + 1);
    }
    expect([...seen.keys()]).toEqual([...DAF_YOMI_TRACTATES]);
    expect([...seen.entries()].filter(([, found]) => !found).map(([name]) => name)).toEqual([]);
  });
});
