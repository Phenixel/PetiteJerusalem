import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { transliterate } from "../services/hebrewTransliteration";
import { markQamatsQatan } from "../services/qamatsQatan";
import { parseContent } from "../services/textService";
import type { TextStudyJsonEntry } from "../models/models";

const QATAN = "ׇ";

describe("the qamats of כָּל is written as a qamats qatan", () => {
  it("marks כל with its prefixes, with or without maqaf, dagesh or teamim", () => {
    expect(markQamatsQatan("כָּל יִשְׂרָאֵל")).toBe("כׇּל יִשְׂרָאֵל");
    expect(markQamatsQatan("וְכָל הַנְּשָׁמָה")).toBe("וְכׇל הַנְּשָׁמָה");
    expect(markQamatsQatan("בְּכָל לְבָבְךָ")).toBe("בְּכׇל לְבָבְךָ");
    expect(markQamatsQatan("מִכָּל, שֶׁכָּל. וּבְכָל:")).toBe("מִכׇּל, שֶׁכׇּל. וּבְכׇל:");
    expect(markQamatsQatan("אֶת־כָּל־הָאָרֶץ")).toBe("אֶת־כׇּל־הָאָרֶץ");
    expect(markQamatsQatan("דְּכָל עָלְמָא")).toBe("דְּכׇל עָלְמָא");
    // A te'am or a meteg on the kaf or the lamed does not change the word.
    expect(markQamatsQatan("כָּ֥ל עַצְמוֹתַ֨י")).toBe("כׇּ֥ל עַצְמוֹתַ֨י");
    expect(markQamatsQatan("כָּל֙")).toBe("כׇּל֙");
  });

  it("leaves the other words alone", () => {
    for (const word of [
      "כָּלָה", // the lamed has a vowel: another word
      "כָּלוּ",
      "נֶאֱכָל", // נ and א are no prefixes
      "מַאֲכָל",
      "הֵיכָל",
      "כֹּל", // holam, already "kol"
      "כְּלָל",
      "שָׂכַל", // patah under the kaf
      "כׇּל", // already marked
      "הָאֳכָלִין", // a qamats read "a" before a hataf qamats
      "חָכְמָה", // read "o", but not a case this rule knows
    ]) {
      expect(markQamatsQatan(word)).toBe(word);
    }
  });

  it("keeps the length of the line, so offsets into it still hold", () => {
    const line = "וְכָל הַחַיִּים יוֹדוּךָ סֶּלָה, בְּכָל עֵת וּבְכָל שָׁעָה";
    expect(markQamatsQatan(line)).toHaveLength(line.length);
    expect(markQamatsQatan(markQamatsQatan(line))).toBe(markQamatsQatan(line));
  });

  it("gives « kol » to the phonetics", () => {
    expect(transliterate(markQamatsQatan("בְּכָל"))).toBe("bekhol");
    expect(transliterate(markQamatsQatan("כָּל"))).toBe("kol");
  });

  it("reaches the text of a Mishna as the reader loads it", () => {
    const dir = join(import.meta.dirname, "../../public/texts/mishna");
    const file = readdirSync(dir).find((name) =>
      /כ[\u05B8\u05BC]{2}ל /.test(readFileSync(join(dir, name), "utf8")),
    );
    expect(file).toBeDefined();
    const data = JSON.parse(readFileSync(join(dir, file!), "utf8"));
    const content = parseContent(
      { type: "Mishna", name: "Mishna", link: "Mishnah_Test" } as unknown as TextStudyJsonEntry,
      data,
    );
    const lines = content.sections.flatMap((section) => section.he);
    expect(lines.some((line) => new RegExp(`כ[\u05BC${QATAN}]{1,2}ל`).test(line))).toBe(true);
    expect(lines.some((line) => /(^|[\s־])כ[\u05B8\u05BC]{2}ל[\s־,.:]/.test(line))).toBe(false);
  });
});
