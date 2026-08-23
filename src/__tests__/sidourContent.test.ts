import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { parseContent, resolveFilePath } from "../services/textService";
import type { TextContent } from "../services/textService";
import { injectWeeklyTorah } from "../services/sidourService";
import type { WeeklyParasha } from "../services/dailyCycles";

/**
 * Les fichiers du sidour (public/texts/tefila/{chaharit,minha,arvit}.json,
 * générés par scripts/build-sidour.mjs) : leur structure doit rester en
 * accord avec le lecteur, les clés `when` avec les occasions du calendrier
 * (dailyCycles.activeOccasions), les clés `zman` avec TefilaZman.
 */

const sidourEntries = (textStudiesJson as TextStudiesJson).textStudies.filter(
  (entry) => String(entry.type) === "Sidour",
);

/** Les clés `when` que le calendrier sait poser (voir activeOccasions). */
const KNOWN_WHEN = new Set([
  "shabbat",
  "rosh-chodesh",
  "rosh-hashana",
  "yom-tov",
  "sukkot",
  "nissim",
  "moadim",
  "moed",
  "shabbat-or-moed",
  "teshuva",
  "ete",
  "hiver",
  "barkhenou",
  "barekh-alenou",
  "tahanoun",
  "tahanoun-minha",
  "tahanoun-lundi-jeudi",
  "torah-semaine",
  "sefer-torah",
  "ledavid",
  ...Array.from({ length: 7 }, (_, day) => `jour-${day}`),
]);

const KNOWN_ZMAN = new Set(["chaharit", "shema", "amida", "minha", "arvit"]);

function loadRaw(entry: TextStudyJsonEntry): unknown {
  const rel = resolveFilePath(entry).replace(/^\//, "");
  return JSON.parse(readFileSync(resolve(__dirname, "../../public", rel), "utf8"));
}

function isFullRubric(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const rubric = value as Record<string, unknown>;
  return ["fr", "en", "he"].every(
    (lang) => typeof rubric[lang] === "string" && (rubric[lang] as string).length > 0,
  );
}

describe("catalogue du sidour", () => {
  it("porte les trois offices, chacun vers son fichier", () => {
    const paths = sidourEntries.map((entry) => resolveFilePath(entry)).sort();
    expect(paths).toEqual([
      "/texts/tefila/arvit.json",
      "/texts/tefila/chaharit.json",
      "/texts/tefila/minha.json",
    ]);
  });
});

describe.each(sidourEntries.map((entry) => [resolveFilePath(entry), entry] as const))(
  "fichier %s",
  (_path, entry) => {
    const content: TextContent = parseContent(entry, loadRaw(entry));
    const blocks = content.sections[0]?.blocks ?? [];

    it("se parse en une section avec des blocs", () => {
      expect(content.sections).toHaveLength(1);
      expect(blocks.length).toBeGreaterThan(5);
      expect(content.sections[0].he.length).toBeGreaterThan(30);
    });

    it("n'utilise que des clés when connues du calendrier", () => {
      const unknown = blocks
        .map((b) => b.when)
        .filter((when): when is string => Boolean(when) && !KNOWN_WHEN.has(when!));
      expect(unknown).toEqual([]);
    });

    it("n'utilise que des horaires connus du lecteur", () => {
      const zmanim = blocks.filter((b) => b.zman).map((b) => b.zman!);
      expect(zmanim.length).toBeGreaterThan(0);
      expect(zmanim.filter((zman) => !KNOWN_ZMAN.has(zman))).toEqual([]);
    });

    it("donne ses didascalies et halakhot dans les trois langues", () => {
      for (const block of blocks) {
        if (block.labelText) expect(isFullRubric(block.labelText)).toBe(true);
        if (block.halakha) expect(isFullRubric(block.halakha)).toBe(true);
        for (const paragraph of block.paragraphs ?? []) {
          if (paragraph.rubric) expect(isFullRubric(paragraph.rubric)).toBe(true);
        }
      }
    });

    it("replie ce qui ne se dit qu'avec le 'hazan (kedoucha, kaddich)", () => {
      // Le fil de qui prie seul reste net : la kedoucha, Modim dérabanan et
      // les Kaddich du 'hazan vivent dans des encadrés repliés (fold), jamais
      // masqués. La clé « hazan » n'est pas une occasion du calendrier : rien
      // ne les déplie d'office.
      const folded = blocks.filter((b) => b.fold);
      expect(folded.length).toBeGreaterThanOrEqual(2);
      for (const block of folded) {
        expect(block.fold).toBe("hazan");
        expect(block.labelText).toBeDefined();
        expect(block.lines.length).toBeGreaterThan(0);
      }
      const labels = folded.map((b) => b.label);
      expect(labels.some((l) => l.includes("Kaddich"))).toBe(true);
    });

    it("garde les variantes de saison, exclusives et à leur place", () => {
      const whens = blocks.map((b) => b.when).filter(Boolean);
      expect(whens).toContain("ete");
      expect(whens).toContain("hiver");
      expect(whens).toContain("barkhenou");
      expect(whens).toContain("barekh-alenou");
      expect(whens).toContain("moed"); // Ya'alé véyavo
      expect(whens).toContain("nissim"); // 'Al hanissim
    });
  },
);

describe("Cha'harit : la Torah de la semaine", () => {
  const entry = sidourEntries.find((e) => resolveFilePath(e).includes("chaharit"))!;
  const content = parseContent(entry, loadRaw(entry));

  it("Yehalelou ne s'affiche que les jours où le séfer est sorti", () => {
    const blocks = content.sections[0].blocks ?? [];
    const yehalelu = blocks.find((b) => b.when === "sefer-torah");
    expect(yehalelu).toBeDefined();
    // Nettoyé des signes (le paseq compris), c'est bien le psaume Yehalelou.
    const bare = yehalelu!.lines.join(" ").replace(/[֑-ׇ]/g, "").replace(/\s+/g, " ");
    expect(bare).toContain("יהללו אתשם יהוה");
  });

  it("la kedoucha de Ouva letsion marque ses voix, haute et basse", () => {
    const blocks = content.sections[0].blocks ?? [];
    const ouva = blocks.find((b) => b.label === "Ouva letsion")!;
    const rubrics = (ouva.paragraphs ?? [])
      .map((paragraph) => paragraph.rubric?.he ?? "")
      .filter(Boolean);
    expect(rubrics.filter((r) => r === "בקול רם:").length).toBeGreaterThanOrEqual(3);
    expect(rubrics.filter((r) => r === "בלחש:").length).toBeGreaterThanOrEqual(3);
  });

  it("porte le marqueur torahWeekly, conditionné au lundi/jeudi", () => {
    const marker = content.sections[0].blocks!.find((b) => b.torahWeekly);
    expect(marker).toBeDefined();
    expect(marker!.when).toBe("torah-semaine");
    expect(marker!.lines).toHaveLength(0);
  });

  it("s'injecte à la place du marqueur, offsets recalculés", () => {
    const parashaEntry: TextStudyJsonEntry = {
      id: 999,
      name: "יתרו (Yitro)",
      livre: "Chemot",
      link: "https://www.sefaria.org/Parashat_Yitro",
      totalSections: 1,
      type: "Tanakh",
    };
    const parasha: WeeklyParasha = {
      names: ["Yitro"],
      entries: [parashaEntry],
      weekKey: "2026-08-29",
    };
    const parashaContent: TextContent = {
      title: "Yitro",
      type: "Tanakh",
      sections: [
        {
          index: 1,
          label: "Yitro",
          he: ["פסוק א", "פסוק ב", "פסוק ג", "פסוק ד"],
          blocks: [
            { label: "1re montée", lines: ["פסוק א", "פסוק ב", "פסוק ג"], offset: 0 },
            { label: "2e montée", lines: ["פסוק ד"], offset: 3 },
          ],
        },
      ],
    };

    const before = content.sections[0];
    const injected = injectWeeklyTorah(content, parasha, parashaContent);
    const section = injected.sections[0];
    const torahBlock = section.blocks!.find((b) => b.labelText?.fr.includes("Yitro"));

    expect(torahBlock).toBeDefined();
    // Seule la 1re montée est lue.
    expect(torahBlock!.lines).toEqual(["פסוק א", "פסוק ב", "פסוק ג"]);
    expect(torahBlock!.when).toBe("torah-semaine");
    expect(section.he.length).toBe(before.he.length + 3);
    // Les offsets se suivent exactement (marque-pages et translittération).
    let expected = 0;
    for (const block of section.blocks!) {
      expect(block.offset).toBe(expected);
      expected += block.lines.length;
    }
    // Le contenu d'origine n'est pas modifié (fonction pure).
    expect(before.blocks!.some((b) => b.torahWeekly)).toBe(true);
  });

  it("revient inchangé sans montée à lire", () => {
    const parasha: WeeklyParasha = { names: [], entries: [], weekKey: "2026-08-29" };
    const empty: TextContent = { title: "", type: "Tanakh", sections: [] };
    expect(injectWeeklyTorah(content, parasha, empty)).toBe(content);
  });
});
