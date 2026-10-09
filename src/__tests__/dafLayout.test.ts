import { describe, it, expect } from "vitest";
import { dafLines, leadLength, type DafLayoutPage } from "../services/dafLayout";
import type { DafMeforshim } from "../services/textService";

/**
 * Les lignes de la page de Vilna, du fichier à la ligne écrite (dafLayout.ts).
 * Le relevé lui-même est tenu par textLayout.test.ts ; ici, ce qu'on en fait.
 */

const GEMARA = ["מאימתי קורין את שמע", "", "עד סוף האשמורה הראשונה"];
/** La deuxième ligne du fichier est vide : Sefaria la compte, la page non. */
const LINES = [GEMARA[0], GEMARA[2]];
const PASSAGES = [0, 2];

const MEFORSHIM = new Map<number, DafMeforshim>([
  [
    4,
    {
      rashi: [[{ lead: "", text: "סוף הפירוש של הדף הקודם" }]],
      tosafot: [],
      inner: "rashi",
    },
  ],
  [
    5,
    {
      rashi: [[{ lead: "מאימתי קורין", text: "משעה שהכהנים נכנסים" }], [], []],
      tosafot: [[], [], [{ lead: "", text: "עד סוף. פירוש עד שליש הלילה" }]],
      inner: "rashi",
    },
  ],
]);

const PAGE: DafLayoutPage = {
  height: 12000,
  pitch: [280, 250],
  main: [
    [3000, 1500, 4000, [0, 0, 4], [2, 0, 1]],
    [3000, 1780, 4000, [2, 1, 3]],
  ],
  rashi: [
    [7000, 200, 3000, [0, 2, 3, 4]],
    [7000, 450, 3000, [0, 0, 5]],
  ],
  tosafot: [[0, 200, 2800, [2, 0, 6]]],
};

describe("dafLines", () => {
  const lines = dafLines(PAGE, 5, LINES, PASSAGES, MEFORSHIM)!;
  const text = (zone: string): string[] =>
    lines.filter((l) => l.zone === zone).map((l) => l.words.map((w) => w.text).join(" "));

  it("écrit sur chaque ligne les mots que le livre y met", () => {
    expect(text("main")).toEqual(["מאימתי קורין את שמע עד", "סוף האשמורה הראשונה"]);
    expect(text("rashi")).toEqual(["של הדף הקודם", "מאימתי קורין משעה שהכהנים נכנסים"]);
    expect(text("tosafot")).toEqual(["עד סוף. פירוש עד שליש הלילה"]);
  });

  it("garde à chaque mot son passage, son commentaire et son dibbour", () => {
    const main = lines.filter((l) => l.zone === "main").flatMap((l) => l.words);
    expect(main.map((w) => w.passage)).toEqual([0, 0, 0, 0, 2, 2, 2, 2]);
    const [carried, own] = lines.filter((l) => l.zone === "rashi");
    // Un commentaire commencé à la page d'avant ne se relie à aucun passage d'ici.
    expect(carried.words.every((w) => w.passage === -1)).toBe(true);
    expect(own.words.map((w) => w.lead)).toEqual([true, true, false, false, false]);
    expect(own.words.every((w) => w.passage === 0 && w.comment === 0)).toBe(true);
    // Un Tossafot que le fichier ne balise pas : son dibbour finit au premier point.
    const [tosafot] = lines.filter((l) => l.zone === "tosafot");
    expect(tosafot.words.map((w) => w.lead)).toEqual([true, true, false, false, false, false]);
  });

  it("écrit la guemara seule tant que les commentaires arrivent", () => {
    const alone = dafLines(PAGE, 5, LINES, PASSAGES, null)!;
    expect(alone.every((l) => l.zone === "main")).toBe(true);
    expect(alone).toHaveLength(2);
  });

  it("refuse un fichier qui ne colle pas à la guemara", () => {
    expect(dafLines(PAGE, 5, [GEMARA[0]], [0], MEFORSHIM)).toBeNull();
    const far: DafLayoutPage = { ...PAGE, main: [[0, 0, 100, [0, 3, 4]]] };
    expect(dafLines(far, 5, LINES, PASSAGES, MEFORSHIM)).toBeNull();
  });
});

describe("leadLength", () => {
  it("prend le dibbour que le fichier balise", () => {
    expect(leadLength(["הקטר", "חלבים"], ["של", "קרבנות."])).toBe(2);
  });

  it("à défaut, ce qui précède le premier point, s'il est proche", () => {
    expect(leadLength([], "גזרה שמא יעלה ויתלוש. ותימה".split(" "))).toBe(4);
    expect(leadLength([], "ותימה למה לי האי טעמא".split(" "))).toBe(0);
    const long = Array.from({ length: 20 }, () => "מילה");
    expect(leadLength([], [...long, "סוף."])).toBe(0);
  });
});
