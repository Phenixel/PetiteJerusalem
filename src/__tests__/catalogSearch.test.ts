import { describe, expect, it } from "vitest";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson } from "../models/models";
import { BOOK_ALIASES, TEXT_ALIASES } from "../datas/catalogAliases";
import {
  aliasesOf,
  bookName,
  filterBySearch,
  groupByBook,
  latinPart,
} from "../services/catalogSearch";

/**
 * La recherche du catalogue, partagée par la bibliothèque, la lecture du jour
 * et le partage de lecture : un texte se trouve par son nom hébreu, par son
 * nom latin, par son livre et par ses autres noms, quelle que soit la
 * graphie tapée.
 */

const TEXTS = [
  { id: 1, name: "ברכות (Berakhot)", livre: "זרעים (Zeraim)", type: "Talmud Bavli" },
  { id: 2, name: "שבת (Shabbat)", livre: "מועד (Moed)", type: "Talmud Bavli" },
  { id: 103, name: "Tehilim 1", livre: "ספר 1 (Sefer 1)", type: "Tehilim" },
  { id: 264, name: "Berechit", livre: "Berechit", type: "Tanakh" },
  { id: 346, name: "מנחה (Min'ha)", livre: "סידור (Sidour)", type: "Sidour" },
];

describe("recherche du catalogue", () => {
  it("trouve un traité par son nom latin comme par son nom hébreu", () => {
    expect(filterBySearch(TEXTS, "Berakhot").map((t) => t.id)).toEqual([1]);
    expect(filterBySearch(TEXTS, "ברכות").map((t) => t.id)).toEqual([1]);
  });

  it("ignore la casse, les accents et la graphie de l'apostrophe", () => {
    expect(filterBySearch(TEXTS, "min’ha").map((t) => t.id)).toEqual([346]);
    expect(filterBySearch(TEXTS, "MIN'HA").map((t) => t.id)).toEqual([346]);
    expect(filterBySearch(TEXTS, "béréchit").map((t) => t.id)).toEqual([264]);
  });

  it("trouve les autres graphies d'un nom", () => {
    expect(filterBySearch(TEXTS, "chabbat").map((t) => t.id)).toEqual([2]);
    expect(filterBySearch(TEXTS, "mincha").map((t) => t.id)).toEqual([346]);
    expect(filterBySearch(TEXTS, "bereshit").map((t) => t.id)).toEqual([264]);
  });

  it("cherche aussi dans le livre ou le seder", () => {
    expect(filterBySearch(TEXTS, "zeraim").map((t) => t.id)).toEqual([1]);
    expect(filterBySearch(TEXTS, "sefer").map((t) => t.id)).toEqual([103]);
  });

  it("rend tout le catalogue quand le terme est vide", () => {
    expect(filterBySearch(TEXTS, "")).toBe(TEXTS);
    expect(filterBySearch(TEXTS, "   ")).toBe(TEXTS);
  });

  it("nomme un livre par sa partie latine", () => {
    expect(bookName("זרעים (Zeraim)")).toBe("Zeraim");
    expect(bookName("Berechit")).toBe("Berechit");
  });

  it("regroupe par livre dans l'ordre du catalogue", () => {
    const groups = groupByBook(TEXTS.filter((t) => t.type === "Talmud Bavli"));
    expect(Object.keys(groups)).toEqual(["זרעים (Zeraim)", "מועד (Moed)"]);
    expect(groups["זרעים (Zeraim)"].map((t) => t.id)).toEqual([1]);
  });

  it("donne ses autres noms à un Tehilim", () => {
    expect(aliasesOf(TEXTS[2])).toEqual(
      expect.arrayContaining(["Psaume 1", "Psalm 1", "תהילים 1", "תהילים א"]),
    );
  });
});

/**
 * Le vrai catalogue, avec ce que les gens tapent réellement. Une ligne rouge
 * ici veut dire qu'une recherche qui marchait ne trouve plus son texte, ou
 * qu'elle en ramène d'autres.
 */
describe("recherche dans le vrai catalogue", () => {
  const catalog = (textStudiesJson as TextStudiesJson).textStudies;
  const found = (term: string) => filterBySearch(catalog, term).map((t) => latinPart(t.name));

  it.each([
    ["chabbat", ["Shabbat", "Shabbat"]],
    ["kidouchin", ["Kiddushin", "Kiddushin"]],
    ["baba metsia", ["Bava Metzia", "Bava Metzia"]],
    ["roch hachana", ["Rosh Hashanah", "Rosh Hashanah"]],
    // Le traité, et le livre d'Esther par son autre nom, Meguilat Esther.
    ["meguila", ["Megillah", "Megillah", "Esther"]],
    ["pessahim", ["Pesachim", "Pesachim"]],
    ["kaddish", ["Kaddich"]],
    ["shacharit", ["Chaharit"]],
    ["maariv", ["Arvit"]],
    ["noach", ["Noah"]],
    ["kedochim", ["Kedoshim"]],
    ["behoukotai", ["Bechukotai"]],
    ["vaet'hanan", ["Va'etchanan"]],
    ["juges", ["Shoftim"]],
    ["jonas", ["Trei Asar"]],
    ["pirke avot", ["Avot"]],
    ["psaume 23", ["Tehilim 23"]],
    ["תהילים כג", ["Tehilim 23"]],
    ["כי תשא", ["Ki Tisa"]],
    ["hanukkah", ["Nerot Hanouka"]],
    ["circoncision", ["Brit Mila"]],
    ["150", ["Tehilim 150"]],
  ])("« %s »", (term, expected) => {
    expect(found(term)).toEqual(expected);
  });

  it("rattrape une faute de frappe", () => {
    expect(found("berakot").slice(0, 2)).toEqual(["Berakhot", "Berakhot"]);
    expect(found("shabatt")).toEqual(["Shabbat", "Shabbat"]);
  });

  it("trouve un livre de la Torah par son nom français", () => {
    const genese = found("genèse");
    expect(genese).toHaveLength(12);
    expect(genese[0]).toBe("Berechit");
  });

  it("ne ramène rien pour une phrase sans rapport", () => {
    expect(found("aucun texte de ce nom")).toEqual([]);
  });

  it("tient le Tehilim 1 en tête de « Tehilim 1 »", () => {
    expect(found("Tehilim 1")[0]).toBe("Tehilim 1");
  });
});

describe("autres noms du catalogue", () => {
  const catalog = (textStudiesJson as TextStudiesJson).textStudies;

  it("désignent chacun un texte du catalogue", () => {
    const keys = new Set(
      catalog.flatMap((t) => [latinPart(t.name), `${latinPart(t.name)}|${t.livre}`]),
    );
    const orphans = Object.keys(TEXT_ALIASES).filter((key) => !keys.has(key));
    expect(orphans).toEqual([]);
  });

  it("désignent chacun un livre du catalogue", () => {
    const books = new Set(catalog.map((t) => bookName(t.livre)));
    const orphans = Object.keys(BOOK_ALIASES).filter((key) => !books.has(key));
    expect(orphans).toEqual([]);
  });
});
