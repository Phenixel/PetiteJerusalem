import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { parseContent, resolveFilePath } from "../services/textService";
import type { TextContent } from "../services/textService";
import { injectWeeklyTorah } from "../services/sidourService";
import type { WeeklyParasha } from "../services/dailyCycles";
import { getParashaForShabbat } from "../services/dailyCycles";
import torahWeekdayJson from "../datas/torahWeekday.json";

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
  "lamnatseah-minha",
  ...Array.from({ length: 7 }, (_, day) => `jour-${day}`),
]);

const KNOWN_ZMAN = new Set(["chaharit", "shema", "amida", "minha", "arvit"]);

function loadRaw(entry: TextStudyJsonEntry): unknown {
  const rel = resolveFilePath(entry).replace(/^\//, "");
  return JSON.parse(readFileSync(resolve(__dirname, "../../public", rel), "utf8"));
}

/** Le découpage de la lecture du lundi et du jeudi, paracha par paracha. */
const TORAH_WEEKDAY = torahWeekdayJson as Record<string, { n: number }[]>;

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

    it("dit Lédavid, et seulement en sa saison", () => {
      // Le psaume 27 se dit aux trois offices d'Eloul à Hochana Rabba. Il
      // n'existe que dans les sections de Cha'harit chez Sefaria : Min'ha et
      // Arvit le lui empruntent (voir sourcesFor dans build-sidour.mjs).
      const ledavid = blocks.filter((b) => b.when === "ledavid");
      expect(ledavid).toHaveLength(1);
      expect(ledavid[0].labelText?.fr).toContain("Lédavid");
      expect(ledavid[0].lines).toHaveLength(1);
    });

    it("offre la boussole du Kotel au titre de la 'Amida", () => {
      // La 'Amida se dit tourné vers Jérusalem : son titre porte la boussole.
      // Le drapeau vient de la recette, pas d'une retouche du fichier, sans
      // quoi la prochaine génération l'emporterait sans rien signaler.
      const amida = blocks.filter((b) => b.label === "'Amida");
      expect(amida).toHaveLength(1);
      expect(amida[0].kotel).toBe(true);
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

  // Yitro : la lecture de la semaine va de 18:1 à 18:12, quatre versets par
  // montée (voir src/datas/torahWeekday.json), là où la 1re montée du Chabbat
  // en compte bien davantage.
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
  const versets = Array.from({ length: 20 }, (_, i) => `פסוק ${i + 1}`);
  const parashaContent: TextContent = {
    title: "Yitro",
    type: "Tanakh",
    sections: [
      {
        index: 1,
        label: "Yitro",
        he: versets,
        blocks: [
          { label: "1re montée", lines: versets.slice(0, 15), offset: 0 },
          { label: "2e montée", lines: versets.slice(15), offset: 15 },
        ],
      },
    ],
  };

  it("s'injecte à la place du marqueur, offsets recalculés", () => {
    const before = content.sections[0];
    const injected = injectWeeklyTorah(content, parasha, parashaContent);
    const section = injected.sections[0];
    const torahBlocks = section.blocks!.filter((b) => b.labelText?.fr.includes("Yitro"));

    expect(torahBlocks).toHaveLength(3);
    for (const block of torahBlocks) expect(block.when).toBe("torah-semaine");
    expect(section.he.length).toBe(before.he.length + 12);
    // Les offsets se suivent exactement (marque-pages et translittération).
    let expected = 0;
    for (const block of section.blocks!) {
      expect(block.offset).toBe(expected);
      expected += block.lines.length;
    }
    // Le contenu d'origine n'est pas modifié (fonction pure).
    expect(before.blocks!.some((b) => b.torahWeekly)).toBe(true);
  });

  it("lit le début de la paracha en trois montées, pas la 1re du Chabbat", () => {
    const section = injectWeeklyTorah(content, parasha, parashaContent).sections[0];
    const torahBlocks = section.blocks!.filter((b) => b.labelText?.fr.includes("Yitro"));

    expect(torahBlocks.map((b) => b.labelText!.fr)).toEqual([
      "Parachat Yitro · Cohen",
      "Parachat Yitro · Lévi",
      "Parachat Yitro · Israël",
    ]);
    // Les trois montées se suivent d'un trait depuis le premier verset, et
    // s'arrêtent avant la fin de la 1re montée du Chabbat.
    expect(torahBlocks.flatMap((b) => b.lines)).toEqual(versets.slice(0, 12));
    expect(torahBlocks.map((b) => b.lines.length)).toEqual([4, 4, 4]);
  });

  it("chaque paracha de l'année a son découpage, et il tient dans son fichier", () => {
    // Un an de Chabbats : toutes les parachiot y passent. Chacune doit avoir
    // ses trois montées de semaine, et le fichier de la paracha doit porter
    // assez de versets pour les servir (les versets s'y suivent depuis le
    // premier, c'est ce qui permet de découper par nombres).
    const vues = new Set<string>();
    const samedi = new Date(2026, 0, 3, 12);
    for (let semaine = 0; semaine < 54; semaine++) {
      const parasha = getParashaForShabbat(samedi);
      samedi.setDate(samedi.getDate() + 7);
      if (!parasha) continue;
      const nom = parasha.names[0];
      if (vues.has(nom)) continue;
      vues.add(nom);
      const decoupage = TORAH_WEEKDAY[nom];
      expect(decoupage).toBeDefined();
      expect(decoupage).toHaveLength(3);
      const lus = decoupage.reduce((somme, aliyah) => somme + aliyah.n, 0);
      const versets = parseContent(parasha.entries[0], loadRaw(parasha.entries[0])).sections[0].he;
      expect(versets.length).toBeGreaterThanOrEqual(lus);
    }
    expect(vues.size).toBeGreaterThan(45);
  });

  it("sans découpage connu, s'en tient à la 1re montée du Chabbat", () => {
    const inconnue: WeeklyParasha = { ...parasha, names: ["Parasha inconnue"] };
    const section = injectWeeklyTorah(content, inconnue, parashaContent).sections[0];
    const torahBlocks = section.blocks!.filter((b) => b.labelText?.fr.includes("Yitro"));

    expect(torahBlocks).toHaveLength(1);
    expect(torahBlocks[0].labelText!.fr).toBe("Parachat Yitro · 1re montée");
    expect(torahBlocks[0].lines).toEqual(versets.slice(0, 15));
  });

  it("revient inchangé sans montée à lire", () => {
    const parasha: WeeklyParasha = { names: [], entries: [], weekKey: "2026-08-29" };
    const empty: TextContent = { title: "", type: "Tanakh", sections: [] };
    expect(injectWeeklyTorah(content, parasha, empty)).toBe(content);
  });
});
