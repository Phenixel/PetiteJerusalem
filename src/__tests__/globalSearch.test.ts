import { describe, expect, it } from "vitest";
import type { Chiour, Session } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";
import {
  capHits,
  rankByPrefix,
  searchChiourim,
  searchCities,
  searchFestivals,
  searchPages,
  searchSessions,
  searchTexts,
} from "../services/globalSearch";

/**
 * La recherche unique : chaque source répond au même terme et rend des
 * résultats de la même forme, avec le chemin à ouvrir. Ce qui se teste ici,
 * c'est ce que chacune attrape (et n'attrape pas), et l'ordre où elle le rend.
 */

const t = (key: string) => `[${key}]`;

describe("recherche des pages", () => {
  it("trouve une page par un mot-clé dans n'importe quelle langue", () => {
    expect(searchPages("réglages", "fr", t).map((h) => h.to)).toEqual(["/profile"]);
    expect(searchPages("holidays", "fr", t).map((h) => h.id)).toEqual(["calendar"]);
    expect(searchPages("תהילים", "fr", t).map((h) => h.id)).toEqual(["tehilimDay"]);
  });

  it("mène à l'adresse de l'espace de langue pour les pages traduites", () => {
    expect(searchPages("zmanim", "en", t)[0].to).toBe("/en/shabbat-times");
    expect(searchPages("zmanim", "fr", t)[0].to).toBe("/horaires");
  });

  it("compte le titre traduit comme mot-clé", () => {
    // Le titre vient de la traduction : ici la clé elle-même, entre crochets.
    expect(searchPages("dailyReading.title", "fr", t).map((h) => h.id)).toEqual(["daily"]);
  });

  it("ne répond pas à une seule lettre", () => {
    expect(searchPages("a", "fr", t)).toEqual([]);
  });
});

describe("recherche des textes", () => {
  it("trouve un traité et mène à sa page de la bibliothèque, avec son corpus", () => {
    const hits = searchTexts("Berakhot");
    expect(hits.map((h) => h.to)).toContain("/bibliotheque/talmud/berakhot");
    expect(hits.map((h) => h.to)).toContain("/bibliotheque/michna/berakhot");
    expect(hits.find((h) => h.to === "/bibliotheque/talmud/berakhot")?.tagKey).toBe(
      "study.types.talmud",
    );
  });

  it("met devant les textes dont le nom commence par le terme", () => {
    const titles = searchTexts("ber").map((h) => h.title);
    expect(titles[0]).toMatch(/Berakhot|Berechit/);
    // Les autres (qui contiennent « ber » ailleurs) viennent après.
    expect(titles.slice(0, 2).every((title) => /\bBer/i.test(title))).toBe(true);
  });

  it("dit le livre en sous-titre, sauf quand il répète le nom", () => {
    const berakhot = searchTexts("Berakhot").find((h) => h.to === "/bibliotheque/talmud/berakhot");
    expect(berakhot?.subtitle).toBe("Zeraim");
  });

  it("ne rend rien pour un terme vide", () => {
    expect(searchTexts("  ")).toEqual([]);
  });
});

function session(overrides: Partial<Session>): Session {
  return {
    id: "s1",
    name: "Tehilim pour la guérison",
    type: EnumTypeTextStudy.Tehilim,
    description: "",
    dateLimit: new Date("2099-01-01"),
    createdAt: new Date(),
    personId: "u1",
    creatorName: "Sarah",
    reservations: [],
    ...overrides,
  };
}

describe("recherche des chaînes de lecture", () => {
  const sessions = [
    session({ id: "s1", slug: "tehilim-guerison" }),
    session({ id: "s2", name: "Chass en un an", creatorName: "David", description: "Talmud" }),
    session({ id: "s3", name: "Michna cachée", creatorName: "Léa", hidden: true }),
    session({ id: "s4", name: "Michna bloquée", creatorName: "Léa", personId: "blocked" }),
    session({ id: "s5", name: "Tehilim finis", creatorName: "Léa", isEnded: true }),
  ];

  it("cherche dans le nom, le créateur et la description", () => {
    expect(searchSessions(sessions, "sarah").map((h) => h.id)).toEqual(["s1"]);
    expect(searchSessions(sessions, "talmud").map((h) => h.id)).toEqual(["s2"]);
    expect(searchSessions(sessions, "guérison")[0].to).toBe("/share-reading/session/tehilim-guerison");
    // Sans slug : l'identifiant.
    expect(searchSessions(sessions, "chass")[0].to).toBe("/share-reading/session/s2");
  });

  it("tait les chaînes masquées et celles des créateurs bloqués", () => {
    const hits = searchSessions(sessions, "michna", { blockedCreatorIds: ["blocked"] });
    expect(hits).toEqual([]);
  });

  it("range les chaînes terminées après les autres, et les dit telles", () => {
    const hits = searchSessions(sessions, "tehilim", { isFinished: (s) => s.isEnded === true });
    expect(hits.map((h) => [h.id, h.finished])).toEqual([
      ["s1", false],
      ["s5", true],
    ]);
  });
});

describe("recherche des chiourim", () => {
  const chiourim: Chiour[] = [
    {
      slug: "emouna-1",
      name: "La émouna au quotidien",
      description: "Premier cours",
      auteur: "Rav Cohen",
      categories: ["Pensée juive"],
      mediaUrl: "",
      niveau: null,
      auteurId: null,
      serieId: null,
      episode: null,
    },
    {
      slug: "chabbat-2",
      name: "Les lois du Chabbat",
      description: "",
      auteur: null,
      categories: ["Halakha"],
      mediaUrl: "",
      niveau: null,
      auteurId: null,
      serieId: null,
      episode: null,
    },
  ];

  it("cherche dans le titre, l'auteur, la description et les catégories", () => {
    expect(searchChiourim(chiourim, "emouna").map((h) => h.to)).toEqual(["/chiourim/emouna-1"]);
    expect(searchChiourim(chiourim, "cohen").map((h) => h.id)).toEqual(["emouna-1"]);
    expect(searchChiourim(chiourim, "halakha").map((h) => h.id)).toEqual(["chabbat-2"]);
    expect(searchChiourim(chiourim, "premier")[0].subtitle).toBe("Rav Cohen");
  });
});

describe("recherche des villes", () => {
  it("met les villes qui commencent par le terme devant celles qui le contiennent", () => {
    const titles = searchCities("mar", "fr").map((h) => h.title);
    expect(titles[0]).toBe("Marseille");
    expect(titles.every((title) => /mar/i.test(title.normalize("NFD")))).toBe(true);
  });

  it("mène à la page de la ville dans l'espace de langue, Paris au hub", () => {
    expect(searchCities("marseille", "en")[0].to).toBe("/en/shabbat-times/marseille");
    expect(searchCities("paris", "fr")[0].to).toBe("/horaires");
  });

  it("ne répond pas à une seule lettre", () => {
    expect(searchCities("p", "fr")).toEqual([]);
  });
});

describe("recherche des fêtes", () => {
  it("trouve une fête par son nom dans n'importe quelle langue et l'ouvre dans la sienne", () => {
    expect(searchFestivals("passover", "fr").map((h) => h.to)).toEqual(["/calendrier/pessah"]);
    expect(searchFestivals("pessah", "he")[0].to).toMatch(/^\/he\//);
    expect(searchFestivals("פסח", "en")[0].title).toBe("Passover");
  });
});

describe("outils", () => {
  it("coupe une section à sa limite et garde le total", () => {
    expect(capHits([1, 2, 3], 2)).toEqual({ hits: [1, 2], total: 3 });
  });

  it("classe par préfixe sans changer l'ordre à rang égal", () => {
    const hits = [{ title: "Sanhedrin" }, { title: "Berakhot" }, { title: "Bekhorot" }];
    expect(rankByPrefix(hits, "be").map((h) => h.title)).toEqual([
      "Berakhot",
      "Bekhorot",
      "Sanhedrin",
    ]);
  });
});
