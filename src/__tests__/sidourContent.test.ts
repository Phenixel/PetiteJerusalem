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
  "sans-tahanoun",
  "sans-tahanoun-minha",
  "taanit",
  "tisha-beav",
  "sans-tisha-beav",
  "chir-tsom-tichri",
  "chir-tsom-tamouz",
  "chir-lendemain-kippour",
  "chir-hanouka",
  "chir-pourim",
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

/** Un texte hébreu sans ses signes : les voyelles varient, les lettres non. */
const sansSignes = (texte: string): string =>
  texte.replace(/[\u0591-\u05C7]/g, "").replace(/\s+/g, " ");

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
      // ne les déplie d'office. Celle de Lédavid en est une, et c'est tout
      // l'intérêt : l'encadré s'ouvre de lui-même en sa saison.
      const folded = blocks.filter((b) => b.fold);
      expect(folded.length).toBeGreaterThanOrEqual(2);
      for (const block of folded) {
        expect(["hazan", "ledavid", "avel"]).toContain(block.fold);
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

    it("dit Lédavid, et la saison décide de ce qu'on en voit", () => {
      // Le psaume 27 se dit aux trois offices, d'Eloul à Chemini 'Atséret. Il
      // n'existe que dans les sections de Cha'harit chez Sefaria : Min'ha et
      // Arvit le lui empruntent (voir sourcesFor dans build-sidour.mjs).
      //
      // À Cha'harit et à Min'ha il n'est là qu'en saison (`when`). À Arvit il
      // ouvre l'office toute l'année, dans un encadré (`fold`) que sa saison
      // déplie : c'est le premier texte de la page, il ne peut pas y
      // apparaître et disparaître sans laisser l'office sans entrée.
      const ledavid = blocks.filter((b) => b.labelText?.fr.startsWith("Lédavid"));
      expect(ledavid).toHaveLength(1);
      expect(ledavid[0].when ?? ledavid[0].fold).toBe("ledavid");
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

    it("revêt le talit et les téfilines avant d'entrer dans la prière", () => {
      // À Cha'harit seulement, et à leur place : après les bénédictions du
      // matin, avant 'Akédat Its'hak. On ne prie pas d'abord pour s'en revêtir
      // ensuite.
      const talit = blocks.findIndex((b) => b.label === "Le talit");
      if (!resolveFilePath(entry).includes("chaharit")) {
        expect(talit).toBe(-1);
        return;
      }
      expect(blocks[talit + 1].label).toBe("Les téfilines");
      // Le passage suivant qui porte un titre : entre les deux, le léchem
      // yi'houd se glisse sans titre à lui.
      expect(blocks.slice(talit + 2).find((b) => b.label)?.label).toBe("'Akédat Its'hak");
      // Les deux parachiot des téfilines se lisent dans le bloc des téfilines,
      // sans titre à elles : le menu de lecture n'a pas à les distinguer.
      const tefilines = blocks[talit + 1];
      expect(tefilines.lines.length).toBeGreaterThanOrEqual(6);
      expect(sansSignes(tefilines.lines.at(-1)!)).toContain("והיה כייבאך");
      expect(blocks[talit].lines.length).toBeGreaterThan(0);
    });

    it("ferme le moment du tahanoun par un Kaddich, quel que soit le jour", () => {
      // Après le tahanoun, après les supplications du lundi et du jeudi, ou
      // après « Yehi chem » les jours sans tahanoun : le Kaddich vient dans
      // les trois cas, et ne porte donc aucune condition.
      const chaharit = resolveFilePath(entry).includes("chaharit");
      const cle = chaharit ? "tahanoun" : "tahanoun-minha";
      // Le premier bloc du tahanoun : la clé revient plus loin dans l'office
      // (les psaumes qui suivent Achré), ce n'est plus le même moment.
      const debut = blocks.map((b) => b.when).indexOf(cle);
      if (debut < 0) return; // Arvit n'a pas de tahanoun.

      const suite = blocks.slice(debut + 1);
      const yehiChem = suite.find(
        (b) => b.when === (chaharit ? "sans-tahanoun" : "sans-tahanoun-minha"),
      );
      expect(sansSignes(yehiChem?.lines.join(" ") ?? "")).toContain("יהי שם יהוה מברך");

      const kaddich = suite.find((b) => b.fold === "hazan");
      expect(kaddich).toBeDefined();
      expect(kaddich!.when).toBeUndefined();
      expect(sansSignes(kaddich!.lines.join(" "))).toContain("יתגדל ויתקדש");
    });

    it("place birkat kohanim juste avant Sim chalom, quand l'office en a", () => {
      // Les cohanim se tournent vers l'arche quand le 'hazan commence Sim
      // chalom : la bénédiction est finie quand il l'entame, elle vient donc
      // juste avant. Arvit n'en a pas ; à Min'ha, elle n'est là qu'un jour de
      // jeûne, et l'office ordinaire enchaîne « Vé'al koulam » sur Sim chalom.
      const i = blocks.findIndex((b) => b.label === "Birkat kohanim");
      if (i < 0) {
        expect(resolveFilePath(entry)).toContain("arvit");
        return;
      }
      expect(blocks[i].fold).toBe("hazan");
      expect(sansSignes(blocks[i + 1].lines[0]).startsWith("שים שלום")).toBe(true);
    });

    it("donne son 'Anénou à chacun, et celui du 'hazan à sa place", () => {
      // Deux 'Anénou, qui ne sont pas au même endroit : celui du 'hazan est
      // une bénédiction à lui, entre Réé et Refaénou ; celui de chacun entre
      // dans Chéma kolénou, sans conclusion. Arvit n'en a pas : on ne jeûne
      // pas la nuit.
      const hazan = blocks.findIndex((b) => b.label === "'Anénou (le 'hazan)");
      if (hazan < 0) {
        expect(resolveFilePath(entry)).toContain("arvit");
        return;
      }
      expect(blocks[hazan].when).toBe("taanit");
      expect(blocks[hazan].fold).toBe("hazan");
      // Refaénou suit tout de suite : la bénédiction du 'hazan s'insère entre
      // Réé et elle.
      expect(sansSignes(blocks[hazan + 1].lines[0]).startsWith("רפאנו")).toBe(true);

      // Celui de chacun : plus loin, après Chéma kolénou, et sans titre à lui.
      const chacun = blocks.findIndex(
        (b, i) => i > hazan && b.when === "taanit" && !b.label && !b.fold,
      );
      expect(chacun).toBeGreaterThan(hazan);
      expect(sansSignes(blocks[chacun].lines[0])).toContain("עננו אבינו");
      expect(sansSignes(blocks[chacun - 1].lines.at(-1)!)).toContain("שמע קולנו");
    });
  },
);

describe("Cha'harit : ce qui s'ajoute au psaume du jour", () => {
  const entry = sidourEntries.find((e) => resolveFilePath(e).includes("chaharit"))!;
  const blocks = parseContent(entry, loadRaw(entry)).sections[0].blocks ?? [];

  it("suit le psaume du jour, sans le remplacer", () => {
    // Les six psaumes de la semaine d'abord, puis ceux des dates : on dit les
    // deux, l'un après l'autre.
    const dernierJour = blocks.map((b) => b.when).lastIndexOf("jour-5");
    const dates = blocks
      .map((b, i) => ({ when: b.when ?? "", i }))
      .filter(({ when }) => when.startsWith("chir-"));
    expect(dates.map(({ when }) => when)).toEqual([
      "chir-tsom-tichri",
      "chir-lendemain-kippour",
      "chir-hanouka",
      "chir-pourim",
      "chir-tsom-tamouz",
    ]);
    for (const { i } of dates) expect(i).toBeGreaterThan(dernierJour);
  });

  it("garde à part le psaume de la maison endeuillée, replié", () => {
    // Aucun calendrier ne sait où l'on prie : il est là tous les jours, mais
    // fermé, et c'est le lecteur qui l'ouvre.
    const avel = blocks.find((b) => b.fold === "avel")!;
    expect(avel).toBeDefined();
    expect(avel.when).toBeUndefined();
    expect(sansSignes(avel.lines.join(" "))).toContain("שמעוזאת כלהעמים");
  });
});

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
    // Le passage n'a plus de titre à lui (il se lit dans la suite d'Achré) :
    // on le retrouve à son premier mot.
    // À son premier mot, et à lui seul : le verset est cité ailleurs (la
    // seconde version de 'Anénou), le chercher dans le corps du texte
    // tomberait sur le mauvais bloc.
    const ouva = blocks.find((b) =>
      sansSignes(String(b.lines[0] ?? "")).startsWith("ובא לציון גואל"),
    )!;
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
