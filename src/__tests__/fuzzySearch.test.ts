import { describe, expect, it } from "vitest";
import {
  approximateDistance,
  normalizeText,
  phoneticKey,
  searchItems,
  type SearchField,
} from "../services/fuzzySearch";

/**
 * La recherche tolérante, commune à toutes les barres de recherche : les
 * graphies d'un même nom se retrouvent, une faute de frappe se pardonne, et
 * les réponses approchantes ne viennent que faute de mieux.
 */

/** La clé d'une expression telle qu'on la tape. */
const key = (value: string) =>
  normalizeText(value)
    .split(" ")
    .map((word) => phoneticKey(word, true))
    .join(" ");

const matches = (term: string, fields: SearchField[]) =>
  searchItems([0], term, () => fields).length > 0;

const search = (names: string[], term: string, keepOrder = false) =>
  searchItems(names, term, (name) => [name], { keepOrder });

describe("normalisation", () => {
  it("efface casse, accents, apostrophes, ponctuation et voyelles hébraïques", () => {
    expect(normalizeText("  Béréchit ")).toBe("berechit");
    expect(normalizeText("Min’ha")).toBe("minha");
    expect(normalizeText("Saint-Étienne")).toBe("saint etienne");
    expect(normalizeText("d'Abraham", " ")).toBe("d abraham");
    expect(normalizeText("שַׁבָּת")).toBe("שבת");
    expect(normalizeText('כ"ג')).toBe("כג");
  });
});

describe("clé phonétique", () => {
  // Chaque ligne : des graphies réellement tapées d'un même nom.
  it.each([
    ["Berakhot", "Brakhot", "Berachot", "Brahot"],
    ["Shabbat", "Chabbat", "Shabat"],
    ["Pesachim", "Pessahim", "Pessa'him"],
    ["Kiddushin", "Kidouchin", "Qiddushin"],
    ["Bava Metzia", "Baba Metsia"],
    ["Chagigah", "Haguiga", "'Hagiga"],
    ["Rosh Hashanah", "Roch Hachana"],
    ["Berechit", "Bereshit", "Bereishit", "Béréchit"],
    ["Min'ha", "Mincha", "Minha"],
    ["Kaddich", "Kaddish"],
    ["Chaharit", "Shacharit"],
    ["Hanouka", "Chanukah", "Hanoukka"],
    ["Vayikra", "Wayyiqra"],
    ["Tetzaveh", "Tetsavé"],
    ["Jonathan", "Yonathan"],
  ])("« %s » a la même clé que ses autres graphies", (first, ...others) => {
    expect(others.map(key)).toEqual(others.map(() => key(first)));
  });

  it("ne rend le h final facultatif que dans ce qu'on tape", () => {
    expect(phoneticKey("noah", true)).toBe("noa");
    expect(phoneticKey("noah")).toBe("noaH");
  });

  it("confond en hébreu les lettres-voyelles et les lettres de même son", () => {
    expect(phoneticKey("מידות")).toBe(phoneticKey("מדות"));
    expect(phoneticKey("כג")).not.toBe(phoneticKey("קג"));
  });
});

describe("distance approchée", () => {
  it("compte les fautes, inversion comprise, depuis un début de mot", () => {
    expect(approximateDistance("brakot", "braHot")).toBe(1);
    expect(approximateDistance("abc", "bac")).toBe(1);
    expect(approximateDistance("ohalot", "toharot")).toBe(2);
    expect(approximateDistance("ohalot", "toharot", [0, 1])).toBe(1);
  });
});

describe("recherche", () => {
  const TEXTS = ["Shabbat", "Shevuot", "Berakhot", "Bava Kamma", "Bava Metzia", "Ketubot", "Bo"];

  it("rend tout quand la recherche est vide", () => {
    expect(searchItems(TEXTS, " ' ", (text) => [text])).toBe(TEXTS);
  });

  it("trouve une autre graphie, les mots dans n'importe quel ordre", () => {
    expect(search(TEXTS, "chabbat")).toEqual(["Shabbat"]);
    expect(search(TEXTS, "metsia baba")).toEqual(["Bava Metzia"]);
  });

  it("pardonne une faute de frappe, faute de mieux seulement", () => {
    expect(search(TEXTS, "brakot")).toEqual(["Berakhot"]);
    expect(search(TEXTS, "bava")).toEqual(["Bava Kamma", "Bava Metzia"]);
  });

  it("ne cherche deux lettres qu'en début de mot", () => {
    expect(search(TEXTS, "bo")).toEqual(["Bo"]);
  });

  it("ne trouve rien quand un mot ne répond pas", () => {
    expect(search(TEXTS, "aucun texte de ce nom")).toEqual([]);
  });

  it("range le début du nom devant, sauf si l'on garde l'ordre", () => {
    expect(search(["Toulon", "Londres"], "lon")).toEqual(["Londres", "Toulon"]);
    expect(search(["Toulon", "Londres"], "lon", true)).toEqual(["Toulon", "Londres"]);
  });

  it("préfère tous les mots dans un même champ", () => {
    const psalms = [
      { name: "Tehilim 2", livre: "Sefer 1" },
      { name: "Tehilim 100", livre: "Sefer 4" },
    ];
    const found = searchItems(psalms, "sefer 1", (text) => [text.name, text.livre]);
    expect(found.map((text) => text.name)).toEqual(["Tehilim 2"]);
  });

  it("cherche un nombre comme un nombre", () => {
    const psalms = ["Tehilim 23", "Tehilim 123", "Tehilim 230"];
    expect(search(psalms, "tehilim 23")).toEqual(["Tehilim 23", "Tehilim 230"]);
    expect(search(psalms, "tehilim 24")).toEqual([]);
  });

  it("lit l'apostrophe comme une lettre ou comme une séparation", () => {
    expect(matches("abraham", ["La paracha d'Abraham"])).toBe(true);
    expect(matches("minha", ["Min'ha"])).toBe(true);
    expect(matches("min'ha", ["Minha"])).toBe(true);
  });

  it("ne cherche que des débuts de mots dans un texte long", () => {
    const fields = [{ text: "Un cours sur le travail", long: true }];
    expect(matches("trav", fields)).toBe(true);
    expect(matches("rav", fields)).toBe(false);
    expect(matches("travial", fields)).toBe(false);
  });

  it("connaît les abréviations, les titres et l'hébreu", () => {
    expect(matches("st etienne", ["Saint-Étienne"])).toBe(true);
    expect(matches("rabbi yossef", ["Rav Yossef"])).toBe(true);
    expect(matches("שַׁבָּת", ["שבת (Shabbat)"])).toBe(true);
    expect(matches("מידות", ["מדות (Middot)"])).toBe(true);
  });
});
