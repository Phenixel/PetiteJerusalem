import { describe, expect, it } from "vitest";
import type { TextStudyJsonEntry } from "../models/models";
import type { TextContent } from "../services/textService";
import {
  hasHebrewLetters,
  normalizeHebrew,
  searchPassages,
  snippetAround,
} from "../services/textContentSearch";

/**
 * La recherche dans le texte des livres : un mot en hébreu, tapé sans
 * voyelles, se trouve dans des lignes qui en portent, avec un extrait autour
 * et un lien qui ouvre le lecteur sur la ligne.
 */

describe("forme comparable de l'hébreu", () => {
  it("retire voyelles, cantillation, balises et ponctuation massorétique", () => {
    expect(normalizeHebrew("אַ֥שְֽׁרֵי־הָאִ֗ישׁ")).toBe("אשרי האיש");
    expect(normalizeHebrew("<b>בראשית.</b> בָּרָ֣א")).toBe("בראשית ברא");
    expect(normalizeHebrew("יָשָֽׁב׃")).toBe("ישב");
  });

  it("reconnaît un terme hébreu", () => {
    expect(hasHebrewLetters("אשרי")).toBe(true);
    expect(hasHebrewLetters("Berakhot")).toBe(false);
  });
});

describe("extrait", () => {
  it("coupe aux mots et signale ce qui continue", () => {
    const text = "אחת שתים שלוש ארבע חמש שש שבע שמונה תשע עשר";
    const start = text.indexOf("חמש");
    const snippet = snippetAround(text, start, start + 3, 8);
    expect(snippet.match).toBe("חמש");
    expect(snippet.before.startsWith("…")).toBe(true);
    expect(snippet.after.endsWith("…")).toBe(true);
    // Pas de mot coupé : ce qui entoure commence et finit à une espace.
    expect(snippet.before.slice(1)).toMatch(/^\S.* $/);
    expect(snippet.after.slice(0, -1)).toMatch(/^ .*\S$/);
  });

  it("ne met pas de points de suspension quand la ligne tient entière", () => {
    expect(snippetAround("אשרי האיש", 0, 4)).toEqual({ before: "", match: "אשרי", after: " האיש" });
  });
});

// Des identifiants hors du catalogue : le chemin du lecteur se calcule alors
// depuis le lien (le numéro du psaume), sans croiser une vraie entrée.
const entry = (n: number, name: string, totalSections = 1): TextStudyJsonEntry => ({
  id: 900_000 + n,
  name,
  livre: "ספר 1 (Sefer 1)",
  link: `https://www.sefaria.org/Psalms.${n}`,
  totalSections,
  type: "Tehilim",
});

const contents: Record<number, TextContent> = {
  1: {
    title: "Tehilim 1",
    type: "Tehilim",
    sections: [
      {
        index: 1,
        label: "Tehilim 1",
        he: ["אַ֥שְֽׁרֵי־הָאִ֗ישׁ אֲשֶׁ֤ר לֹ֥א הָלַךְ֮", "כִּ֤י אִ֥ם־בְּתוֹרַ֥ת יְהֹוָ֗ה חֶ֫פְצ֥וֹ"],
      },
    ],
  },
  2: {
    title: "Tehilim 2",
    type: "Tehilim",
    sections: [{ index: 1, label: "Tehilim 2", he: ["לָ֭מָּה רָגְשׁ֣וּ גוֹיִ֑ם", "אַשְׁרֵ֥י כׇּל־ח֥וֹסֵי בֽוֹ׃"] }],
  },
};

const loadText = async (e: TextStudyJsonEntry) => {
  const content = contents[Number(e.id) - 900_000];
  if (!content) throw new Error("absent");
  return content;
};

describe("recherche des passages", () => {
  it("trouve un mot tapé sans voyelles, et mène à la ligne dans le lecteur", async () => {
    const hits = await searchPassages([entry(1, "Tehilim 1"), entry(2, "Tehilim 2")], "אשרי", {
      loadText,
    });
    expect(hits.map((h) => [h.entry.name, h.line])).toEqual([
      ["Tehilim 1", 0],
      ["Tehilim 2", 1],
    ]);
    expect(hits[0].match).toBe("אשרי");
    expect(hits[0].to).toBe("/bibliotheque/tehilim/1?verset=0");
    expect(hits[1].to).toBe("/bibliotheque/tehilim/2?verset=1");
  });

  it("passe sans bruit un livre illisible et continue avec les autres", async () => {
    const hits = await searchPassages([entry(9, "Absent"), entry(2, "Tehilim 2")], "חוסי", {
      loadText,
    });
    expect(hits.map((h) => h.entry.name)).toEqual(["Tehilim 2"]);
  });

  it("s'arrête dès qu'on le lui demande", async () => {
    let loaded = 0;
    const hits = await searchPassages([entry(1, "Tehilim 1"), entry(2, "Tehilim 2")], "אשרי", {
      loadText: async (e) => {
        loaded++;
        return loadText(e);
      },
      isCancelled: () => loaded >= 1,
    });
    expect(loaded).toBe(1);
    expect(hits).toEqual([]);
  });

  it("borne les résultats, par livre et en tout", async () => {
    const many = entry(1, "Tehilim 1");
    contents[1].sections[0].he = Array(10).fill("אשרי אשרי");
    const hits = await searchPassages([many, entry(2, "Tehilim 2")], "אשרי", {
      loadText,
      maxPerEntry: 3,
      maxHits: 4,
    });
    expect(hits.map((h) => h.entry.name)).toEqual(["Tehilim 1", "Tehilim 1", "Tehilim 1", "Tehilim 2"]);
  });

  it("ne cherche pas un terme trop court ni un terme sans hébreu", async () => {
    expect(await searchPassages([entry(1, "Tehilim 1")], "אש", { loadText })).toEqual([]);
    expect(await searchPassages([entry(1, "Tehilim 1")], "Berakhot", { loadText })).toEqual([]);
  });
});
