import { describe, expect, it } from "vitest";
import {
  approximateDistance,
  isBlankQuery,
  matchesQuery,
  normalizeText,
  phoneticKey,
  searchItems,
} from "../services/fuzzySearch";

/**
 * La recherche tolérante, commune à toutes les barres de recherche : les
 * graphies d'un même nom se retrouvent, une faute de frappe se pardonne, et
 * les réponses approchantes ne viennent que faute de mieux.
 */

/** La clé d'une expression telle qu'on la tape : celle de chaque mot. */
const key = (value: string) =>
  normalizeText(value)
    .split(" ")
    .map((word) => phoneticKey(word, true))
    .join(" ");

const names = <T extends { name: string }>(items: T[]) => items.map((item) => item.name);

describe("normalisation", () => {
  it("efface casse, accents, apostrophes et ponctuation", () => {
    expect(normalizeText("  Béréchit ")).toBe("berechit");
    expect(normalizeText("Min’ha")).toBe("minha");
    expect(normalizeText("Saint-Étienne")).toBe("saint etienne");
    expect(normalizeText("d'Abraham", " ")).toBe("d abraham");
  });

  it("efface voyelles, gershayim et lettres finales de l'hébreu", () => {
    expect(normalizeText("שַׁבָּת")).toBe("שבת");
    expect(normalizeText("כ״ג")).toBe("כג");
    expect(normalizeText('כ"ג')).toBe("כג");
    expect(normalizeText("שלום")).toBe("שלומ");
  });
});

describe("clé phonétique", () => {
  // Chaque ligne : des graphies réellement tapées d'un même nom.
  const SAME = [
    ["Berakhot", "Brakhot", "Berachot", "Brahot", "Berahot"],
    ["Shabbat", "Chabbat", "Chabat", "Shabat"],
    ["Pesachim", "Pessahim", "Pessa'him"],
    ["Kiddushin", "Kidouchin", "Qiddushin"],
    ["Bava Metzia", "Baba Metsia"],
    ["Chagigah", "Haguiga", "'Hagiga"],
    ["Rosh Hashanah", "Roch Hachana"],
    ["Berechit", "Bereshit", "Bereishit", "Béréchit"],
    ["Shemot", "Chemot", "Chmot"],
    ["Min'ha", "Mincha", "Minha"],
    ["Kaddich", "Kaddish", "Kadish"],
    ["Chaharit", "Shacharit", "Sha'harit"],
    ["Hanouka", "Chanukah", "Hanoukka"],
    ["Tikoun Hatsot", "Tikkun Chatzot"],
    ["Sli'hot", "Selichot", "Slichot"],
    ["Beha'alotcha", "Behaalotekha"],
    ["Vayikra", "Vaikra", "Wayyiqra"],
    ["Chayei Sarah", "Hayé Sarah"],
    ["Kohelet", "Qohelet"],
    ["Tetzaveh", "Tetsavé"],
    ["Jonathan", "Yonathan"],
  ];

  it.each(SAME)("« %s » a la même clé que ses autres graphies", (first, ...others) => {
    // Chaque graphie face à sa clé : un échec nomme celle qui s'écarte.
    const keys = Object.fromEntries(others.map((other) => [other, key(other)]));
    const expected = Object.fromEntries(others.map((other) => [other, key(first)]));
    expect(keys).toEqual(expected);
  });

  it("garde un nombre tel quel", () => {
    expect(phoneticKey("119")).toBe("119");
  });

  it("ne rend le h final facultatif que dans ce qu'on tape", () => {
    expect(phoneticKey("noah", true)).toBe("noa");
    expect(phoneticKey("noah")).toBe("noaH");
    expect(phoneticKey("noach", true)).toBe("noaH");
  });

  it("confond en hébreu les lettres-voyelles et les lettres de même son", () => {
    expect(phoneticKey("מידות")).toBe(phoneticKey("מדות"));
    expect(phoneticKey("תענית")).toBe(phoneticKey("תאנית"));
    // Un mot court reste tel quel : כג (23) n'est pas קג (103).
    expect(phoneticKey("כג")).not.toBe(phoneticKey("קג"));
  });
});

describe("distance approchée", () => {
  it("compte les fautes pour trouver un mot dans un texte", () => {
    expect(approximateDistance("brakot", "brakot")).toBe(0);
    expect(approximateDistance("brakot", "braHot")).toBe(1);
    expect(approximateDistance("sabhat", "Habat")).toBeGreaterThan(1);
  });

  it("compte une inversion de deux lettres comme une seule faute", () => {
    expect(approximateDistance("hsabat", "Habat")).toBe(2);
    expect(approximateDistance("abc", "bac")).toBe(1);
  });

  it("part d'un début de mot", () => {
    // « oharot » est au milieu de « toharot », à une faute de « ohalot » :
    // depuis le début du mot, il en faut deux.
    expect(approximateDistance("ohalot", "toharot")).toBe(2);
    expect(approximateDistance("ohalot", "toharot", [0, 1])).toBe(1);
  });
});

describe("recherche", () => {
  const TEXTS = [
    { name: "Shabbat" },
    { name: "Shevuot" },
    { name: "Berakhot" },
    { name: "Bava Kamma" },
    { name: "Bava Metzia" },
    { name: "Ketubot" },
    { name: "Bo" },
  ];
  const search = (term: string) => names(searchItems(TEXTS, term, (text) => [text.name]));

  it("rend tout quand la recherche est vide", () => {
    expect(searchItems(TEXTS, "", (text) => [text.name])).toBe(TEXTS);
    expect(searchItems(TEXTS, "  ' ", (text) => [text.name])).toBe(TEXTS);
    expect(isBlankQuery(" ' ")).toBe(true);
  });

  it("trouve une autre graphie", () => {
    expect(search("chabbat")).toEqual(["Shabbat"]);
    expect(search("baba metsia")).toEqual(["Bava Metzia"]);
  });

  it("cherche chaque mot, dans n'importe quel ordre", () => {
    expect(search("metsia baba")).toEqual(["Bava Metzia"]);
    expect(search("bava")).toEqual(["Bava Kamma", "Bava Metzia"]);
  });

  it("pardonne une faute de frappe, faute de mieux", () => {
    expect(search("brakot")).toEqual(["Berakhot"]);
    expect(search("shabatt")).toEqual(["Shabbat"]);
  });

  it("tait les approchants quand une réponse franche existe", () => {
    // « bava » est à une lettre du « haba » de Shabbat : on ne le montre pas.
    expect(search("bava")).not.toContain("Shabbat");
  });

  it("ne cherche deux lettres qu'en début de mot", () => {
    expect(search("bo")).toEqual(["Bo"]);
  });

  it("ne trouve rien quand un mot ne répond pas", () => {
    expect(search("bava rien")).toEqual([]);
    expect(search("aucun texte de ce nom")).toEqual([]);
  });

  it("range le début du nom devant le milieu", () => {
    const cities = [{ name: "Toulon" }, { name: "Londres" }];
    expect(names(searchItems(cities, "lon", (city) => [city.name]))).toEqual(["Londres", "Toulon"]);
  });

  it("garde l'ordre d'origine si on le demande", () => {
    const cities = [{ name: "Toulon" }, { name: "Londres" }];
    const found = searchItems(cities, "lon", (city) => [city.name], { keepOrder: true });
    expect(names(found)).toEqual(["Toulon", "Londres"]);
  });

  it("préfère tous les mots dans un même champ", () => {
    const psalms = [
      { name: "Tehilim 2", livre: "Sefer 1" },
      { name: "Tehilim 100", livre: "Sefer 4" },
    ];
    const found = searchItems(psalms, "sefer 1", (text) => [text.name, text.livre]);
    expect(names(found)).toEqual(["Tehilim 2"]);
  });

  it("cherche un nombre comme un nombre", () => {
    const psalms = [{ name: "Tehilim 23" }, { name: "Tehilim 123" }, { name: "Tehilim 230" }];
    const found = searchItems(psalms, "tehilim 23", (text) => [text.name]);
    expect(names(found)).toEqual(["Tehilim 23", "Tehilim 230"]);
    expect(names(searchItems(psalms, "tehilim 24", (text) => [text.name]))).toEqual([]);
  });

  it("lit une requête collée", () => {
    const texts = [{ name: "Birkat Hamazon" }, { name: "Rosh Hashanah" }];
    expect(names(searchItems(texts, "a mazon", (text) => [text.name]))).toEqual(["Birkat Hamazon"]);
    expect(names(searchItems(texts, "rochachana", (text) => [text.name]))).toEqual([
      "Rosh Hashanah",
    ]);
  });

  it("lit l'apostrophe d'une élision comme une séparation", () => {
    expect(matchesQuery("abraham", ["La paracha d'Abraham"])).toBe(true);
    expect(matchesQuery("minha", ["Min'ha"])).toBe(true);
    expect(matchesQuery("min'ha", ["Minha"])).toBe(true);
  });

  it("ne cherche que des débuts de mots dans un texte long", () => {
    const fields = [{ text: "Un cours sur le travail", long: true }];
    expect(matchesQuery("travail", fields)).toBe(true);
    expect(matchesQuery("trav", fields)).toBe(true);
    expect(matchesQuery("rav", fields)).toBe(false);
    expect(matchesQuery("travial", fields)).toBe(false);
  });

  it("connaît les abréviations et les titres", () => {
    expect(matchesQuery("st etienne", ["Saint-Étienne"])).toBe(true);
    expect(matchesQuery("rabbi yossef", ["Rav Yossef"])).toBe(true);
    expect(matchesQuery("rav yossef", ["Rabbin Yossef"])).toBe(true);
  });

  it("cherche en hébreu, voyelles ou pas", () => {
    expect(matchesQuery("שַׁבָּת", ["שבת (Shabbat)"])).toBe(true);
    expect(matchesQuery("מידות", ["מדות (Middot)"])).toBe(true);
  });
});
