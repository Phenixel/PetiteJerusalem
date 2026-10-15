import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scrollVerseWords } from "../services/pageForm";
import { pointedVerseWords } from "../services/scrollPointing";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson } from "../models/models";

/**
 * Les voyelles et les teamim dans la forme du Sefer Torah : le mot lu se pose
 * sur le mot écrit (TorahScroll.vue). Il faut donc un mot lu pour chaque mot
 * écrit, dans le même ordre, sur tout le Tanakh du dépôt.
 */

const TEXTS = resolve(__dirname, "../../public/texts");
const POINTS = /[֑-ֽֿ-ׇ]/g;
const letters = (word: string): string => word.replace(POINTS, "").replace(/־/g, "");

const parachiot = (textStudiesJson as TextStudiesJson).textStudies
  .filter((entry) => entry.type === "Tanakh")
  .map((entry) => {
    const data = JSON.parse(readFileSync(resolve(TEXTS, `tanakh/${entry.id}.json`), "utf8")) as {
      he: string[][];
    };
    return { name: entry.name, verses: data.he.flat() };
  });

describe("les voyelles et les teamim du Sefer Torah", () => {
  it("garde les signes, le maqaf et le sof passouk", () => {
    const verse = "וַיְהִ֗י בְּשַׁלַּ֣ח פַּרְעֹה֮ אֶת־הָעָם֒ מִצְרָֽיְמָה׃ {פ}";
    expect(pointedVerseWords(verse)).toEqual([
      "וַיְהִ֗י",
      "בְּשַׁלַּ֣ח",
      "פַּרְעֹה֮",
      "אֶת־",
      "הָעָם֒",
      "מִצְרָֽיְמָה׃",
    ]);
    expect(scrollVerseWords(verse)).toEqual(["ויהי", "בשלח", "פרעה", "את", "העם", "מצרימה"]);
  });

  it("lit le qri à la place du ktiv, et laisse le passek", () => {
    expect(pointedVerseWords("אֶל־(קצוותו) [קְצוֹתָ֖יו] כִּ֣י&thinsp;׀ אָמַ֣ר")).toEqual([
      "אֶל־",
      "קְצוֹתָ֖יו",
      "כִּ֣י",
      "אָמַ֣ר",
    ]);
  });

  it("donne un mot lu pour chaque mot écrit, sur tout le Tanakh", () => {
    expect(parachiot.length).toBeGreaterThan(50);
    const offenders: string[] = [];
    for (const { name, verses } of parachiot) {
      verses.forEach((verse, v) => {
        const written = scrollVerseWords(verse);
        const read = pointedVerseWords(verse);
        if (read.length !== written.length)
          offenders.push(`${name} ${v} : ${read.length}/${written.length}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("ne change les lettres que là où le qri n'est pas le ktiv", () => {
    let differences = 0;
    let words = 0;
    for (const { verses } of parachiot) {
      for (const verse of verses) {
        const written = scrollVerseWords(verse);
        pointedVerseWords(verse).forEach((word, w) => {
          words++;
          if (letters(word) !== written[w]) differences++;
        });
      }
    }
    // Les qri du Tanakh : quelques centaines sur ses 300 000 mots.
    expect(differences).toBeGreaterThan(0);
    expect(differences).toBeLessThan(words / 200);
  });
});
