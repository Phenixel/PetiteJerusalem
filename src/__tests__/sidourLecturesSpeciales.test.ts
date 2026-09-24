import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HDate, months } from "@hebcal/core";
import { activeOccasions } from "../services/dailyCycles";
import { parseTefilaBlocks, saidOn, type TextBlock } from "../services/textService";

/**
 * Les lectures de la Torah des jours à lecture propre, telles que le lecteur
 * les affiche : les occasions du jour (activeOccasions), puis les blocs, les
 * paragraphes et les fragments que leurs conditions retiennent (saidOn).
 *
 * Quatre défauts relevés par un audit jour par jour, de 2025 à 2045 :
 * Bamidbar 6, 27 manquait au premier jour de 'Hanouka ; à Roch Hodech Tévet,
 * la lecture de 'Hanouka passait avant celle de Roch Hodech ; la haftara de
 * Min'ha de Tich'a beAv ne s'affichait pas ; une référence (שמות יז ח) était
 * restée au milieu du premier verset de Pourim.
 */

const here = dirname(fileURLToPath(import.meta.url));
const tefila = (name: string): TextBlock[] =>
  parseTefilaBlocks(
    JSON.parse(readFileSync(resolve(here, `../../public/texts/tefila/${name}.json`), "utf8"))
      .blocks,
  );
const CHAHARIT = tefila("chaharit");
const MINHA = tefila("minha");

/** Les lettres seules : ni voyelles, ni te'amim, ni sof passouk. */
const bare = (text: string) =>
  text.replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, "").replace(/\s+/g, " ");

interface Shown {
  block: TextBlock;
  /** Le texte hébreu de chaque paragraphe affiché, en lettres seules. */
  paragraphs: string[];
  /** Les didascalies françaises des paragraphes affichés. */
  rubrics: string[];
}

/** Ce que l'office affiche ce jour-là, bloc par bloc, dans l'ordre. */
function office(blocks: TextBlock[], hd: HDate, il = false): Shown[] {
  const occ = activeOccasions(hd, il);
  return blocks
    .filter((block) => saidOn(block.when, occ, block.unless))
    .map((block) => {
      const shown = (block.paragraphs ?? []).filter((p) => saidOn(p.when, occ, p.unless));
      return {
        block,
        paragraphs: shown.map((p) =>
          bare(
            p.runs
              .filter((run) => run.kind === "he" && saidOn(run.when, occ, run.unless))
              .map((run) => (run.kind === "he" ? run.text : ""))
              .join(" "),
          ),
        ),
        rubrics: shown.map((p) => p.rubric?.fr ?? ""),
      };
    });
}

/** Le texte de tout l'office, d'un seul tenant. */
const fullText = (shown: Shown[]) => shown.flatMap((s) => s.paragraphs).join(" ");

describe("'Hanouka, premier jour", () => {
  // 25 Kislev 5786, lundi 15 décembre 2025.
  const jour = new HDate(25, months.KISLEV, 5786);
  const lecture = office(CHAHARIT, jour).find((s) => s.block.when === "hanouka-1")!;

  it("lit Birkat kohanim entière, verset 27 compris, avant Bamidbar 7", () => {
    const texte = lecture.paragraphs.join(" ");
    const fin26 = texte.indexOf("וישם לך שלום");
    const v27 = texte.indexOf("ושמו את־שמי על־בני ישראל ואני אברכם");
    const v7_1 = texte.indexOf("ויהי ביום כלות משה");
    expect(fin26).toBeGreaterThan(0);
    expect(v27).toBeGreaterThan(fin26);
    expect(v7_1).toBeGreaterThan(v27);
  });

  it("appelle trois montées sous leurs didascalies, sans « לוי » dans le texte", () => {
    expect(lecture.rubrics.filter(Boolean)).toEqual(["Cohen :", "Lévi :", "Israël :"]);
    const texte = lecture.paragraphs.join(" ");
    expect(texte).not.toMatch(/(^| )לוי( |$)/);
    expect(texte).not.toMatch(/(^| )ישראל ויאמר/);
    // La lecture s'achève sur Na'hchon ben 'Aminadav (7, 17).
    expect(texte.trim()).toMatch(/זה קרבן נחשון בן־עמינדב׃?$/);
  });
});

describe("Roch Hodech Tévet, dans 'Hanouka", () => {
  // 30 Kislev 5787, jeudi 10 décembre 2026 : 6e jour de 'Hanouka.
  const jour = new HDate(30, months.KISLEV, 5787);
  const shown = office(CHAHARIT, jour);

  it("lit Roch Hodech en trois montées, puis le nassi du jour en quatrième", () => {
    const roshChodesh = shown.findIndex((s) =>
      s.rubrics.some((r) => r.startsWith("À Roch Hodech Tévet")),
    );
    const nassi = shown.findIndex((s) => s.paragraphs.some((p) => p.startsWith("ביום הששי")));
    expect(roshChodesh).toBeGreaterThan(-1);
    expect(nassi).toBeGreaterThan(roshChodesh);
    // Un seul nassi : celui du sixième jour.
    expect(fullText(shown)).not.toContain("ביום השביעי נשיא");
  });

  it("ne garde ni les quatre montées ordinaires ni la lecture de 'Hanouka seule", () => {
    const texte = fullText(shown);
    // Le verset 3 n'est lu qu'une fois : la reprise ne sert qu'à quatre
    // montées. (Le Moussaf, plus loin, cite lui aussi Bamidbar 28.)
    const lecture = shown.find((s) => s.block.when === "rosh-chodesh-hanouka")!;
    expect(lecture.paragraphs.join(" ").split("ואמרת להם זה האשה").length - 1).toBe(1);
    expect(shown.some((s) => s.rubrics.some((r) => r.includes("quatre montées")))).toBe(false);
    // Ni l'ordre du jour de 'Hanouka (« ג' גברי »), ni son demi-Kaddich.
    expect(texte).not.toContain("קוראים ג' גברי");
    expect(shown.some((s) => s.block.when === "hanouka")).toBe(false);
  });

  it("dit le Titkabal de Roch Hodech après le Hallel, un seul Kaddich", () => {
    const hallel = shown.findIndex((s) => s.block.when === "hallel");
    const suivant = shown[hallel + 1];
    expect(suivant.block.labelText?.fr).toBe("Kaddich Titkabal (le 'hazan)");
    expect(shown[hallel + 2].block.labelText?.fr).not.toMatch(/Kaddich/);
  });

  it("garde le septième jour quand il tombe le 1er Tévet", () => {
    const septieme = office(CHAHARIT, new HDate(1, months.TEVET, 5787));
    expect(fullText(septieme)).toContain("ביום השביעי נשיא");
    expect(fullText(septieme)).not.toContain("ביום הששי נשיא");
  });
});

describe("Min'ha de Tich'a beAv", () => {
  const haftarot = (hd: HDate) =>
    office(MINHA, hd).filter((s) => s.block.choice?.key === "haftara-tisha-beav");

  it("propose la haftara, « Chouva Israël » d'abord, « Dirchou » en choix", () => {
    // 9 Av 5786, jeudi 23 juillet 2026.
    const options = haftarot(new HDate(9, months.AV, 5786));
    expect(options.map((s) => s.block.choice?.id)).toEqual(["chouva", "dirchou"]);
    expect(options[0].block.choice?.preferred).toBe("tisha-beav");
    expect(options[0].paragraphs.join(" ")).toContain("שובה ישראל עד יהוה אלהיך");
    expect(options[1].paragraphs.join(" ")).toContain("דרשו יהוה בהמצאו");
  });

  it("la propose aussi quand le jeûne est reporté au dimanche", () => {
    // 10 Av 5789, dimanche 22 juillet 2029 : le 9 tombait un Chabbat.
    expect(haftarot(new HDate(10, months.AV, 5789))).toHaveLength(2);
  });

  it("ne la mêle pas au choix des autres jeûnes", () => {
    // 3 Tichri 5787, jeûne de Guedalia : seul le choix des jeûnes s'affiche.
    const guedalia = office(MINHA, new HDate(3, months.TISHREI, 5787));
    expect(guedalia.some((s) => s.block.choice?.key === "haftara-tisha-beav")).toBe(false);
    expect(guedalia.some((s) => s.block.choice?.key === "haftara-tsom")).toBe(true);
  });
});

describe("Pourim", () => {
  // 14 Adar 5786, mardi 3 mars 2026.
  const lecture = office(CHAHARIT, new HDate(14, months.ADAR_I, 5786)).find(
    (s) => s.block.when === "pourim",
  )!;

  it("lit « Vayavo 'Amalek » sans référence au milieu du texte", () => {
    const texte = lecture.paragraphs.join(" ");
    expect(texte).not.toContain("(");
    expect(texte).not.toContain("שמות יז");
    expect(texte).toContain("ויבא עמלק וילחם");
  });

  it("appelle trois montées sous leurs didascalies", () => {
    expect(lecture.rubrics.filter((r) => /^(Cohen|Lévi|Israël)/.test(r))).toEqual([
      "Cohen :",
      "Lévi :",
      "Israël :",
    ]);
    expect(lecture.paragraphs.at(-1)).toMatch(/מדר דר׃?$/);
  });
});
