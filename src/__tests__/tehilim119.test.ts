import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseContent } from "../services/textService";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson } from "../models/models";

/**
 * Le psaume 119 se lit strophe par strophe : vingt-deux blocs de huit
 * versets, chacun titré par la lettre par laquelle ses versets commencent.
 * C'est là qu'on cherche les lettres d'un nom.
 */
const studies = (textStudiesJson as TextStudiesJson).textStudies;
const tehilim = JSON.parse(
  readFileSync(resolve(__dirname, "../../public/texts/tehilim.json"), "utf8"),
);
const psaume = (n: number) =>
  parseContent(studies.find((t) => t.type === "Tehilim" && t.name === `Tehilim ${n}`)!, tehilim)
    .sections[0];

/** La première lettre d'un verset, signes retirés. */
const premiereLettre = (verset: string) => verset.replace(/[^א-ת]/g, "")[0];

describe("Tehilim 119 : l'acrostiche", () => {
  it("découpe le psaume en vingt-deux strophes de huit versets", () => {
    const section = psaume(119);
    const blocks = section.blocks ?? [];
    expect(blocks).toHaveLength(22);
    expect(blocks.flatMap((b) => b.lines)).toEqual(section.he);
    for (const [i, block] of blocks.entries()) {
      expect(block.offset).toBe(i * 8);
      expect(block.lines).toHaveLength(8);
    }
  });

  it("titre chaque strophe par la lettre qui ouvre ses versets", () => {
    for (const block of psaume(119).blocks ?? []) {
      expect(block.heading?.kind).toBe("letter");
      const letter = block.heading?.kind === "letter" ? block.heading.letter : "";
      for (const verset of block.lines) expect(premiereLettre(verset)).toBe(letter);
    }
  });

  it("laisse les autres psaumes d'un seul tenant", () => {
    expect(psaume(1).blocks).toBeUndefined();
    expect(psaume(118).blocks).toBeUndefined();
  });
});
