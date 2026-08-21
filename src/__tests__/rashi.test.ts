import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseContent, parseParashaRashi, parseRashiComment } from "../services/textService";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson } from "../models/models";

/**
 * Rachi du chnei mikra : chaque fichier public/texts/rashi/<id>.json doit
 * s'aplatir sur exactement les mêmes lignes que le fichier de sa paracha,
 * c'est l'alignement par index qui place chaque commentaire sous son verset.
 */

const RASHI_DIR = resolve(__dirname, "../../public/texts/rashi");
const TANAKH_DIR = resolve(__dirname, "../../public/texts/tanakh");
const entries = (textStudiesJson as TextStudiesJson).textStudies;

describe("rachi des parachiot", () => {
  it("aligne chaque fichier Rachi sur les versets de sa paracha", () => {
    const files = readdirSync(RASHI_DIR).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const id = Number(file.replace(".json", ""));
      const entry = entries.find((t) => t.id === id);
      expect(entry, `entrée ${id} absente du catalogue`).toBeDefined();
      const parasha = parseContent(
        entry!,
        JSON.parse(readFileSync(resolve(TANAKH_DIR, file), "utf8")),
      );
      const rashi = parseParashaRashi(JSON.parse(readFileSync(resolve(RASHI_DIR, file), "utf8")));
      expect(rashi.length, `${file}: nombre de versets`).toBe(parasha.sections[0].he.length);
      const commented = rashi.filter((comments) => comments.length > 0).length;
      expect(commented, `${file}: aucun verset commenté`).toBeGreaterThan(0);
    }
  });

  it("met le dibbour hamat'hil en avant, sur le premier verset de Yitro", () => {
    const rashi = parseParashaRashi(
      JSON.parse(readFileSync(resolve(RASHI_DIR, "280.json"), "utf8")),
    );
    const first = rashi[0][0];
    expect(first.lead).toContain("וישמע יתרו");
    expect(first.text.length).toBeGreaterThan(0);
    // Le gras de la source ne doit pas fuir dans le texte affiché.
    expect(first.lead).not.toContain("<");
    expect(first.text).not.toContain("<");
  });
});

describe("parseRashiComment", () => {
  it("sépare le dibbour hamat'hil du commentaire", () => {
    expect(parseRashiComment("<b>בראשית.</b> אמר רבי יצחק")).toEqual({
      lead: "בראשית.",
      text: "אמר רבי יצחק",
    });
  });

  it("accepte un commentaire sans dibbour", () => {
    expect(parseRashiComment("פשוטו של מקרא")).toEqual({ lead: "", text: "פשוטו של מקרא" });
  });

  it("ignore un commentaire vide", () => {
    expect(parseRashiComment("  ")).toBeNull();
    expect(parseRashiComment("<b></b>")).toBeNull();
  });
});
