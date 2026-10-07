import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { leadRanges, markedPieces } from "../services/pageForm";
import {
  parseContent,
  parseDafMeforshim,
  parseParashaRashi,
  placeLabel,
} from "../services/textService";
import {
  commentaryCorpusOf,
  talmudGroups,
  talmudPassageOf,
} from "../composables/usePassageCommentaries";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson } from "../models/models";

/**
 * Les commentaires d'un passage (bulle et panneau d'étude) : chaque ligne de
 * la guemara retrouve Rachi et Tossafot de son passage, chaque verset de la
 * paracha son Rachi, et les mots du dibbour hamat'hil se retrouvent dans le
 * texte pour y être soulignés.
 */

const TEXTS = resolve(__dirname, "../../public/texts");
const read = (path: string): unknown => JSON.parse(readFileSync(resolve(TEXTS, path), "utf8"));
const entries = (textStudiesJson as TextStudiesJson).textStudies;

const berakhot = entries.find((e) => e.type === "Talmud Bavli" && e.link.endsWith("/Berakhot"))!;
/** Le premier chapitre de Berakhot, du 2a au 7a, comme le lecteur le lit. */
const chapitre = parseContent(berakhot, read("talmud/berakhot.json"), {
  berakhot: [{ chapter: 1, startDaf: "2a", endDaf: "7a", startIdx: 0, endIdx: 10 }],
}).sections[0];
const meforshim = parseDafMeforshim(read("talmud-meforshim/berakhot/0.json") as never);

describe("commentaires d'un passage de guemara", () => {
  it("retrouve l'amoud et le passage de Sefaria de chaque ligne", () => {
    expect(talmudPassageOf(chapitre, 0)).toEqual({ amud: 0, passage: 0 });
    const premierDu2b = chapitre.dafBlocks![0].lines.length;
    expect(talmudPassageOf(chapitre, premierDu2b)).toEqual({ amud: 1, passage: 0 });
    expect(talmudPassageOf(chapitre, 100_000)).toBeNull();
  });

  it("donne Rachi puis Tossafot du passage, et rien d'un passage sans commentaire", () => {
    const premier = talmudGroups(meforshim, chapitre, 0);
    expect(premier.map((g) => g.source)).toEqual(["rashi", "tosafot"]);
    expect(premier[0].comments[0].lead).toContain("מאימתי קורין את שמע בערבין");
    // Berakhot 2a, passage 2 (« וחכמים אומרים : עד חצות ») : ni Rachi ni Tossafot.
    expect(talmudGroups(meforshim, chapitre, 1)).toEqual([]);
  });

  it("nomme le passage par son daf, sans la plage du chapitre", () => {
    const sections = [chapitre, { ...chapitre, index: 2 }];
    const verset = (n: number) => `verset ${n}`;
    const passage = (n: number) => `passage ${n}`;
    expect(placeLabel(sections, 1, 2, verset, undefined, passage)).toBe(
      "Chapitre 1 (א) · Daf 2a · passage 3",
    );
  });

  it("souligne dans le passage vocalisé les mots que cite le dibbour", () => {
    const ligne = chapitre.dafBlocks![0].lines[2];
    const rachi = talmudGroups(meforshim, chapitre, 2)[0].comments[0];
    const ranges = leadRanges(ligne, [rachi.lead]);
    expect(ranges).toHaveLength(1);
    const souligne = markedPieces(ligne, ranges).find((p) => p.marked)!.text;
    expect(souligne.replace(/[֑-ׇ]/g, "")).toBe("עד שיעלה עמוד השחר");
  });
});

describe("le dibbour hamat'hil dans le texte", () => {
  it("ignore « וכו' » et les finales, et ne souligne pas un seul mot d'un long dibbour", () => {
    const texte = "רַבָּן גַּמְלִיאֵל אוֹמֵר עַד שֶׁיַּעֲלֶה עַמּוּד הַשַּׁחַר";
    expect(leadRanges(texte, ["רבן גמליאל וכו'"])).toEqual([[0, texte.indexOf(" אוֹמֵר")]]);
    expect(leadRanges(texte, ["רבן שמעון בן גמליאל"])).toEqual([]);
    expect(leadRanges(texte, ["השחר."])).toEqual([[texte.indexOf("הַשַּׁחַר"), texte.length]]);
  });

  it("réunit les dibbourim qui se chevauchent", () => {
    const texte = "בראשית ברא אלהים";
    expect(leadRanges(texte, ["בראשית.", "בראשית ברא"])).toEqual([[0, 10]]);
    expect(markedPieces(texte, [[0, 10]])).toEqual([
      { text: "בראשית ברא", marked: true },
      { text: " אלהים", marked: false },
    ]);
  });
});

describe("commentaires d'un verset de la Torah", () => {
  it("ne propose les commentaires qu'à la guemara et aux parachiot", () => {
    const berechit = entries.find((e) => e.type === "Tanakh" && e.id === 264)!;
    const josue = entries.find((e) => e.type === "Tanakh" && e.id === 318)!;
    const tehilim = entries.find((e) => e.type === "Tehilim")!;
    const paracha = parseContent(berechit, read("tanakh/264.json")).sections[0];
    expect(commentaryCorpusOf("Talmud Bavli", chapitre)).toBe("talmud");
    expect(commentaryCorpusOf("Tanakh", paracha)).toBe("torah");
    expect(
      commentaryCorpusOf("Tanakh", parseContent(josue, read("tanakh/318.json")).sections[0]),
    ).toBeNull();
    expect(
      commentaryCorpusOf("Tehilim", parseContent(tehilim, read("tehilim.json")).sections[0]),
    ).toBeNull();
  });

  it("souligne « בראשית » dans le premier verset", () => {
    const rachi = parseParashaRashi(read("rashi/264.json") as never);
    const verset = parseContent(entries.find((e) => e.id === 264)!, read("tanakh/264.json"))
      .sections[0].he[0];
    const ranges = leadRanges(
      verset,
      rachi[0].map((c) => c.lead),
    );
    expect(ranges.length).toBeGreaterThan(0);
    expect(verset.slice(ranges[0][0], ranges[0][1]).replace(/[֑-ׇ]/g, "")).toMatch(/^בראשית/);
  });
});
