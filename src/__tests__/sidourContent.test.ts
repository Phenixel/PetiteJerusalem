import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { parseContent, resolveFilePath } from "../services/textService";
import type { TextContent, TextParagraph, TextRun } from "../services/textService";
import { injectWeeklyTorah } from "../services/sidourService";
import type { WeeklyParasha } from "../services/dailyCycles";
import { getParashaForShabbat } from "../services/dailyCycles";
import torahWeekdayJson from "../datas/torahWeekday.json";

/**
 * Les fichiers du sidour (public/texts/tefila/{chaharit,minha,arvit}.json,
 * générés par scripts/build-sidour.mjs) : leur structure doit rester en
 * accord avec le lecteur, les clés `when` avec les occasions du calendrier
 * (dailyCycles.activeOccasions), les clés `zman` avec TefilaZman.
 *
 * Le corpus du sidour porte aussi des textes qui ne sont pas des offices (le
 * Chema du coucher, le tikoun hatsot, la havdala, générés par
 * scripts/build-brahot.mjs ; le Kaddich, généré par scripts/build-sidour.mjs
 * comme les offices) : ce qui tient à la 'Amida et aux horaires ne les
 * regarde pas, et ils sont vérifiés plus bas avec les autres textes de
 * liturgie.
 */

const OFFICES = ["chaharit", "minha", "arvit"];

const allEntries = (textStudiesJson as TextStudiesJson).textStudies;

const sidourEntries = allEntries.filter(
  (entry) =>
    String(entry.type) === "Sidour" &&
    OFFICES.some((office) => resolveFilePath(entry).endsWith(`/${office}.json`)),
);

/** Les textes de liturgie qui ne sont pas des offices. */
const autresLiturgies = allEntries.filter(
  (entry) =>
    ["Sidour", "Brahot", "Slihot"].includes(String(entry.type)) && !sidourEntries.includes(entry),
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
  "tahanoun-ordinaire",
  "taanit",
  "selihot-tsom",
  "tsom-guedalia",
  "tsom-tevet",
  "tsom-esther",
  "tsom-tamouz",
  "tsom-esther-veille",
  "tsom-vendredi",
  "tsom-minha",
  "hallel",
  "hallel-complet",
  "hallel-abrege",
  "hanouka",
  "pourim",
  "omer",
  ...Array.from({ length: 8 }, (_, i) => `hanouka-${i + 1}`),
  ...Array.from({ length: 49 }, (_, i) => `omer-${i + 1}`),
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
  "motsae",
  "hoshana-rabba",
  "pesach",
  "shavuot",
  "shemini-atzeret",
  "magdil",
  "migdol",
  ...Array.from({ length: 7 }, (_, day) => `jour-${day}`),
]);

/**
 * Les clés d'une condition `when` (voir saidOn) : « teshuva|hoshana-rabba »
 * en nomme deux, « !teshuva » une, niée.
 */
const keysOf = (when: string): string[] =>
  when.split("|").map((key) => key.trim().replace(/^!/, ""));

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
      // Sur les blocs, sur les paragraphes, sur les fragments et sur les
      // halakhot : une clé inconnue masquerait un passage pour toujours.
      const whens = blocks.flatMap((b) => [
        b.when,
        ...(b.halakhot ?? []).map((h) => h.when),
        ...(b.paragraphs ?? []).flatMap((p) => [p.when, ...p.runs.map((run) => run.when)]),
      ]);
      const unknown = whens
        .filter((when): when is string => Boolean(when))
        .flatMap(keysOf)
        .filter((key) => !KNOWN_WHEN.has(key));
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
        for (const halakha of block.halakhot ?? []) expect(isFullRubric(halakha)).toBe(true);
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
      // Le jeûne qu'on prend sur soi à Min'ha n'est pas non plus une
      // occasion : l'encadré reste replié, le lecteur l'ouvre le jour où il
      // veut jeûner.
      for (const block of folded) {
        expect(["hazan", "ledavid", "avel", "taanit-yahid"]).toContain(block.fold);
        expect(block.labelText).toBeDefined();
        expect(block.lines.length).toBeGreaterThan(0);
      }
      const labels = folded.map((b) => b.label);
      expect(labels.some((l) => l.includes("Kaddich"))).toBe(true);
    });

    it("garde les variantes de saison, exclusives et à leur place", () => {
      const whens = blocks.map((b) => b.when).filter(Boolean);
      // La demande de pluie : deux paragraphes entiers, un par saison, dans
      // le fil ordinaire (plain), avec la halakha de l'oubli.
      for (const saison of ["barkhenou", "barekh-alenou"]) {
        const bloc = blocks.find((b) => b.when === saison)!;
        expect(bloc.plain).toBe(true);
        expect(bloc.halakhot?.length).toBe(1);
      }
      expect(whens).toContain("moed"); // Ya'alé véyavo
      expect(whens).toContain("nissim"); // 'Al hanissim
      // La mention de la pluie : deux fragments dans le paragraphe des
      // Guevourot, à leur place après « rav lehochia' », l'un ou l'autre.
      const gevurot = blocks.find((b) =>
        (b.paragraphs ?? []).some((p) => p.runs.some((run) => run.when === "ete")),
      )!;
      const runs = gevurot.paragraphs![0].runs;
      const ete = runs.findIndex((run) => run.when === "ete");
      const hiver = runs.findIndex((run) => run.when === "hiver");
      expect(sansSignes((runs[ete - 1] as { text: string }).text)).toContain("רב להושיע");
      expect(hiver).toBe(ete + 1);
      expect(sansSignes((runs[hiver + 1] as { text: string }).text)).toContain("מכלכל חיים");
      // Un texte de saison n'est pas un ajout signalé : pas d'accent.
      expect((runs[ete] as { accent?: boolean }).accent).toBeUndefined();
    });

    it("met les ajouts des dix jours de techouva à leur place, en accent", () => {
      // Comme dans un siddour imprimé : Zokhrénou au milieu d'Avot, Hamélekh
      // hakadoch à la place de haEl hakadoch, et rien d'autre ces jours-là.
      // Chaque fragment `teshuva` est en accent (couleur du thème), et une
      // conclusion remplacée a son fragment « !teshuva » à côté.
      const teshuva = blocks.flatMap((b) =>
        (b.paragraphs ?? []).flatMap((p) => p.runs.filter((run) => run.when === "teshuva")),
      );
      const textes = teshuva.map((run) => (run.kind === "he" ? sansSignes(run.text) : ""));
      expect(textes.some((t) => t.startsWith("זכרנו לחיים"))).toBe(true);
      expect(textes.some((t) => t.startsWith("מי כמוך אב הרחמן"))).toBe(true);
      expect(textes).toContain("המלך הקדוש:");
      expect(textes).toContain("המלך המשפט:");
      expect(textes.some((t) => t.startsWith("וכתב לחיים"))).toBe(true);
      expect(textes.some((t) => t.startsWith("ובספר חיים"))).toBe(true);
      expect(textes).toContain("עושה השלום");
      for (const run of teshuva) expect(run.kind === "he" && run.accent).toBe(true);
      // Plus aucun bloc entier « teshuva » dans la 'Amida : les ajouts vivent
      // dans leurs paragraphes.
      const amida = blocks.findIndex((b) => b.label === "'Amida");
      const avinou = blocks.findIndex((b) => b.label === "Avinou Malkénou");
      for (const bloc of blocks.slice(amida, avinou)) expect(bloc.when).not.toBe("teshuva");
      // Les conclusions ordinaires cèdent la place, sans accent.
      const ordinaires = blocks.flatMap((b) =>
        (b.paragraphs ?? []).flatMap((p) => p.runs.filter((run) => run.when === "!teshuva")),
      );
      expect(ordinaires.map((run) => (run.kind === "he" ? sansSignes(run.text) : ""))).toEqual([
        "האל הקדוש:",
        "מלך אוהב צדקה ומשפט:",
        "עשה שלום",
      ]);
      for (const run of ordinaires) expect(run.kind === "he" && run.accent).toBeUndefined();
    });

    it("accompagne chaque ajout de la halakha de l'oubli, le jour dit seulement", () => {
      const halakhot = blocks.flatMap((b) => b.halakhot ?? []);
      const teshuva = halakhot.filter((h) => h.when === "teshuva");
      expect(teshuva.length).toBeGreaterThanOrEqual(6);
      expect(teshuva.some((h) => h.fr.includes("Hamélekh hakadoch"))).toBe(true);
      // Ya'alé véyavo, 'Al hanissim : la halakha suit le bloc, qui a déjà sa
      // condition.
      const yv = blocks.find((b) => b.when === "moed")!;
      expect(yv.halakhot?.length).toBeGreaterThanOrEqual(1);
      expect(blocks.find((b) => b.when === "nissim")!.halakhot).toHaveLength(1);
    });

    it("ne nomme dans Ya'alé véyavo que la fête du jour", () => {
      const yv = blocks.find((b) => b.when === "moed")!;
      const runs = yv.paragraphs![0].runs;
      expect(runs.map((run) => run.when)).toEqual([
        undefined,
        "rosh-chodesh",
        "pesach",
        "sukkot",
        undefined,
      ]);
    });

    it("ne dit dans 'Al hanissim que le récit du jour", () => {
      const nissim = blocks.find((b) => b.when === "nissim")!;
      expect(nissim.paragraphs!.map((p) => p.when)).toEqual([undefined, "hanouka", "pourim"]);
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
      // On le cherche à sa saison, non à son titre : dans le fil de Cha'harit
      // et de Min'ha il n'en a plus, une ligne ne vaut pas un repère de menu.
      const ledavid = blocks.filter((b) => b.when === "ledavid" || b.fold === "ledavid");
      expect(ledavid).toHaveLength(1);
      expect(ledavid[0].lines).toHaveLength(1);
      expect(sansSignes(ledavid[0].lines[0])).toContain("לדוד יהוה אורי");
      // L'encadré d'Arvit garde son titre : c'est par lui qu'on le déplie.
      if (ledavid[0].fold) expect(ledavid[0].labelText).toBeDefined();
    });

    it("ouvre le parchemin au pitoum haketoret et au Lamnatséa'h, et là seulement", () => {
      // Le drapeau vient de la recette (`klaf` dans build-sidour.mjs), posé
      // sur le paragraphe d'où le parchemin s'ouvre : « Ata hou » pour le
      // pitoum haketoret, le premier verset du psaume 67 pour la menora.
      // Cha'harit dit la ketoret deux fois (aux korbanot, après Ein
      // kélohénou), Min'ha une fois, Arvit jamais ; le psaume 67 se dit une
      // fois par office (après le compte du 'Omer, à Arvit).
      const paragraphes = blocks.flatMap((b) => b.paragraphs ?? []);
      const texte = (p: TextParagraph): string =>
        sansSignes(
          p.runs
            .filter((r): r is TextRun & { kind: "he" } => r.kind === "he")
            .map((r) => r.text)
            .join(" "),
        );
      for (const paragraphe of paragraphes) {
        const debut = texte(paragraphe);
        if (debut.startsWith("אתה הוא יהוה אלהינו, שהקטירו")) {
          expect(paragraphe.klaf).toBe("ketoret");
        } else if (debut.startsWith("למנצח בנגינת")) {
          expect(paragraphe.klaf).toBe("menora");
        } else {
          expect(paragraphe.klaf).toBeUndefined();
        }
      }
      const office = resolveFilePath(entry);
      const ketoret = paragraphes.filter((p) => p.klaf === "ketoret").length;
      expect(ketoret).toBe(office.includes("chaharit") ? 2 : office.includes("minha") ? 1 : 0);
      expect(paragraphes.filter((p) => p.klaf === "menora")).toHaveLength(1);
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
      const talit = blocks.findIndex((b) => b.label === "Le talit et les téfilines");
      if (!resolveFilePath(entry).includes("chaharit")) {
        expect(talit).toBe(-1);
        return;
      }
      // Les téfilines suivent le talit sans titre à eux, et le passage titré
      // suivant est celui des korbanot : entre les deux, le léchem yi'houd se
      // glisse sans titre non plus.
      expect(blocks[talit + 1].label).toBeFalsy();
      expect(blocks.slice(talit + 1).find((b) => b.label)?.label).toBe("Korbanot");
      // Les deux parachiot des téfilines se lisent dans le bloc des téfilines,
      // sans titre à elles : le menu de lecture n'a pas à les distinguer.
      const tefilines = blocks[talit + 1];
      expect(tefilines.lines.length).toBeGreaterThanOrEqual(6);
      expect(sansSignes(tefilines.lines.at(-1)!)).toContain("והיה כייבאך");
      expect(blocks[talit].lines.length).toBeGreaterThan(0);
    });

    it("ferme le moment du tahanoun par un Kaddich, quel que soit le jour", () => {
      // Après le tahanoun, après les supplications du lundi et du jeudi,
      // après les sli'hot d'un jeûne, ou après « Yehi chem » les jours sans
      // tahanoun : le Kaddich vient dans tous les cas, et ne porte donc
      // aucune condition.
      const chaharit = resolveFilePath(entry).includes("chaharit");
      const cle = chaharit ? "tahanoun-ordinaire" : "tahanoun-minha";
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

      // Celui de chacun : plus loin, dans Chéma kolénou, avant « Ki Ata
      // chomé'a », en accent, avec sa didascalie glissée dans le fil.
      const chacun = blocks.findIndex(
        (b, i) =>
          i > hazan &&
          (b.paragraphs ?? []).some((p) => p.runs.some((run) => run.when === "taanit")),
      );
      expect(chacun).toBeGreaterThan(hazan);
      const runs = blocks[chacun].paragraphs!.find((p) =>
        p.runs.some((run) => run.when === "taanit"),
      )!.runs;
      const anenou = runs.findIndex((run) => run.kind === "he" && run.when === "taanit");
      expect(sansSignes((runs[anenou] as { text: string }).text)).toContain("עננו אבינו");
      expect((runs[anenou] as { accent?: boolean }).accent).toBe(true);
      expect(runs[anenou - 1].kind).toBe("rubric");
      expect(sansSignes((runs[0] as { text: string }).text)).toContain("שמע קולנו");
      expect(sansSignes((runs[anenou + 1] as { text: string }).text)).toContain("כי אתה שומע");
    });
  },
);

describe("Min'ha : le jeûne qu'on prend sur soi", () => {
  const entry = sidourEntries.find((e) => resolveFilePath(e).includes("minha"))!;
  const blocks = parseContent(entry, loadRaw(entry)).sections[0].blocks ?? [];

  it("vit dans un encadré replié, avant de reculer de trois pas", () => {
    const i = blocks.findIndex((b) => b.fold === "taanit-yahid");
    expect(i).toBeGreaterThan(0);
    expect(blocks[i].labelText).toBeDefined();
    expect(sansSignes(blocks[i].lines[0])).toContain("רבון העולמים, הריני לפניך");
    // Avant lui, la fin de la 'Amida ; après lui, le jour du jeûne seulement,
    // puis 'Ossé chalom dans le fil.
    expect(sansSignes(blocks[i - 1].lines.at(-1)!)).toContain("יהיו לרצון");
    expect(blocks[i + 1].when).toBe("taanit");
    expect(sansSignes(blocks[i + 1].lines[0])).toContain("גלוי לפניך");
    expect(sansSignes(blocks[i + 2].lines[0])).toContain("שלום במרומיו");
  });
});

describe("Min'ha : les jeûnes publics", () => {
  const entry = sidourEntries.find((e) => resolveFilePath(e).includes("minha"))!;
  const blocks = parseContent(entry, loadRaw(entry)).sections[0].blocks ?? [];

  it("lit « Vaye'hal Moché » en trois montées, sans Kaddich après la lecture", () => {
    // La sortie du séfer précède, avec les clés de tahanoun de Min'ha.
    const sortie = blocks.findIndex((b) => b.label === "Lecture de la Torah");
    expect(blocks[sortie].when).toBe("taanit");
    expect(blocks[sortie].paragraphs![0].when).toBe("tahanoun-minha");
    // Les trois montées dans un seul bloc, sans titre à lui.
    const vayehal = blocks[sortie + 1];
    expect(vayehal.when).toBe("taanit");
    expect(vayehal.label).toBe("");
    expect(vayehal.lines).toHaveLength(3);
    expect(sansSignes(vayehal.lines[0])).toContain("ויחל משה");
    // Après la bénédiction de l'appelé, pas de Kaddich : la haftara, puis
    // le psaume, Yehalelou et le demi-Kaddich qui ouvre la 'Amida.
    expect(sansSignes(blocks[sortie + 2].lines[0])).toContain("אשר נתן לנו את תורתו");
    expect(blocks[sortie + 3].label).toBe("Haftara");
  });

  it("laisse le choix de la haftara : « Dirchou », « Chouva Israël », ou rien", () => {
    const options = blocks.filter((b) => b.choice?.key === "haftara-tsom");
    expect(options.map((b) => b.choice!.id)).toEqual(["dirchou", "chouva", "aucune"]);
    // À tous les jeûnes des sli'hot, et un seul titre pour le menu.
    for (const b of options) expect(b.when).toBe("selihot-tsom");
    expect(options.map((b) => b.label)).toEqual(["Haftara", "", ""]);
    // Le jour propose « Dirchou » à Guedalia, rien aux trois autres.
    expect(options[0].choice!.preferred).toBe("tsom-guedalia");
    expect(options[1].choice!.preferred).toBeUndefined();
    expect(options[2].choice!.preferred).toBe("tsom-tevet|tsom-esther|tsom-tamouz");
    // La note dit qui lit quoi, sur chaque option : elle précède le sélecteur.
    for (const b of options) expect(b.halakhot![0].fr).toMatch(/^Qui lit quoi/);
    const [dirchou, chouva, aucune] = options;
    expect(sansSignes(dirchou.lines.join(" "))).toContain("דרשו יהוה בהמצאו");
    expect(sansSignes(dirchou.lines.join(" "))).toContain("אשר בחר בנביאים טובים");
    expect(sansSignes(dirchou.lines.at(-1)!)).toContain("מגן דוד");
    expect(sansSignes(chouva.lines.join(" "))).toContain("שובה ישראל");
    expect(sansSignes(chouva.lines.join(" "))).toContain("מיאל כמוך");
    expect(sansSignes(chouva.lines.at(-1)!)).toContain("מגן דוד");
    expect(aucune.lines).toEqual([]);
  });

  it("change de psaumes la veille de Pourim et le vendredi", () => {
    // Les psaumes sont des lignes dans le fil, sans titre.
    const psaume = (when: string) => blocks.filter((b) => b.when === when && !b.label);
    // En rangeant le séfer : 20, ou 124, ou 126.
    expect(sansSignes(psaume("tsom-minha")[0].lines[0])).toContain("יענך יהוה ביום צרה");
    expect(sansSignes(psaume("tsom-esther-veille")[0].lines[0])).toContain("לולי יהוה");
    expect(sansSignes(psaume("tsom-vendredi")[0].lines[0])).toContain("בשוב יהוה");
    // Après le Kaddich : 102 (Tich'a beAv compris), ou 22 la veille de Pourim
    // (le vendredi, le 93 du bloc jour-5 est déjà là).
    expect(sansSignes(psaume("tsom-minha|tisha-beav")[0].lines[0])).toContain("תפלה לעני");
    expect(sansSignes(psaume("tsom-esther-veille")[1].lines[0])).toContain("אילת השחר");
    // La supplique « Chema' koli » ouvre l'office, en retrait.
    const chema = blocks.find((b) => b.label === "Supplique « Chema' koli »")!;
    expect(chema.when).toBe("tsom-minha");
    expect(blocks.indexOf(chema)).toBe(1); // juste après le marqueur d'horaire
    expect(chema.lines).toHaveLength(29);
  });
});

describe("Cha'harit : le Hallel et les lectures des jours à lecture propre", () => {
  const entry = sidourEntries.find((e) => resolveFilePath(e).includes("chaharit"))!;
  const blocks = parseContent(entry, loadRaw(entry)).sections[0].blocks ?? [];

  it("porte les deux formes du Hallel, exclusives", () => {
    // Sur le fichier brut : la condition vit sur la ligne, et le lecteur la
    // consomme avant d'en faire un paragraphe.
    const brut = (
      loadRaw(entry) as { blocks: { label?: string; when?: string; lines: unknown[] }[] }
    ).blocks;
    const hallel = brut.find((b) => b.label === "Hallel")!;
    expect(hallel.when).toBe("hallel");
    const lignes = hallel.lines as { when?: string; he?: string }[];
    const entier = lignes.filter((l) => l?.when === "hallel-complet");
    const abrege = lignes.filter((l) => l?.when === "hallel-abrege");
    // « Lo lanou » et « Ahavti » ne sont là qu'au Hallel entier, avec leur
    // suite ; les deux consignes de saut ne sont là qu'à l'abrégé.
    expect(entier).toHaveLength(4);
    expect(abrege).toHaveLength(2);
    expect(sansSignes(String(entier[0].he))).toContain("לא לנו");
    expect(sansSignes(String(entier[2].he))).toContain("אהבתי");
  });

  it("lit un passage par jour à 'Hanouka, dans l'ordre des nessiim", () => {
    const jours = blocks.filter((b) => /^hanouka-\d/.test(b.when ?? ""));
    expect(jours.map((b) => b.when)).toEqual(
      Array.from({ length: 8 }, (_, i) => `hanouka-${i + 1}`),
    );
    // Le deuxième jour lit le nassi de Yissakhar, le huitième celui de Menaché.
    expect(sansSignes(jours[1].lines.join(" "))).toContain("נתנאל בןצוער");
    expect(sansSignes(jours[7].lines.join(" "))).toContain("גמליאל בןפדהצור");
  });

  it("lit la Torah à Pourim et les jours de jeûne", () => {
    const pourim = blocks.find((b) => b.when === "pourim")!;
    expect(pourim.label).toBe("Lecture de la Torah");
    expect(sansSignes(pourim.lines.join(" "))).toContain("עמלק");
    // Les jeûnes lisent « Vaye'hal Moché » en trois montées, chacune sous
    // sa didascalie, dans un seul bloc sans titre : le menu ne retient que
    // la sortie du séfer qui précède, la même que le lundi et le jeudi.
    const sortie = blocks.findIndex(
      (b) => b.label === "Lecture de la Torah" && b.when?.includes("taanit"),
    );
    expect(blocks[sortie].when).toBe("torah-semaine|taanit");
    expect(sansSignes(blocks[sortie].lines[0])).toContain("אל ארך אפים");
    const vayehal = blocks[sortie + 2]; // après le marqueur de la Torah de la semaine
    expect(vayehal.when).toBe("selihot-tsom");
    expect(vayehal.label).toBe("");
    expect(vayehal.paragraphs!.map((p) => p.rubric?.fr)).toEqual([
      "Cohen\u00a0:",
      "Lévi\u00a0:",
      "Israël\u00a0:",
    ]);
    const debuts = vayehal.lines.map((l) => sansSignes(l).slice(0, 12));
    expect(debuts[0]).toContain("ויחל משה");
    expect(debuts[1]).toContain("ויאמר יהוה");
    expect(debuts[2]).toContain("ויפסל");
    // Les mots en retrait qui bornent les montées dans la source ne
    // traînent pas dans le fil.
    expect(sansSignes(vayehal.lines[0])).not.toContain(" לוי ");
    // Tich'a beAv lit « Ki tolid banim » à leur place.
    const neufAv = blocks.find((b) => b.when === "tisha-beav" && b.lines.length === 1)!;
    expect(sansSignes(neufAv.lines[0])).toContain("כיתוליד בנים");
  });

  it("remplace le tahanoun par les sli'hot du jeûne, chacun les siennes", () => {
    // Le tahanoun ordinaire ne se dit pas ces jours-là : sa clé est celle
    // des jours sans sli'hot.
    const ordinaire = blocks.find((b) => b.label === "Ta'hanoun (supplications)")!;
    expect(ordinaire.when).toBe("tahanoun-ordinaire");
    // Chaque jeûne ouvre ses propres sli'hot, dans le fil (plain).
    const propres = [
      ["tsom-guedalia", "Sli'hot du jeûne de Guedalia", "אבלה נפשי"],
      ["tsom-tevet", "Sli'hot du 10 Tévet", "וארץ שפל רומי"],
      ["tsom-esther", "Sli'hot du jeûne d'Esther", "אגגי בהעמיקו"],
      ["tsom-tamouz", "Sli'hot du 17 Tamouz", "אזי בבגדי"],
    ] as const;
    for (const [when, label, texte] of propres) {
      const bloc = blocks.find((b) => b.when === when && b.label === label)!;
      expect(bloc.plain).toBe(true);
      expect(sansSignes(bloc.lines.join(" "))).toContain(texte);
    }
    // Le jeûne de Guedalia a son second piyout, et le psaume qui le ferme.
    const guedalia = blocks.find((b) => b.label === "Sli'hot du jeûne de Guedalia")!;
    expect(sansSignes(guedalia.lines.join(" "))).toContain("יקם דם עבדיך");
    expect(sansSignes(guedalia.lines.at(-1)!)).toContain("נספר תהלתך");
    // Puis les textes communs aux quatre, le vidouy, la nefilat apayim…
    // (les montées de « Vaye'hal Moché », plus loin, portent la même clé).
    const yehiChem = blocks.findIndex((b) => b.when === "sans-tahanoun");
    const communs = blocks.filter((b, i) => b.when === "selihot-tsom" && i < yehiChem);
    expect(communs.map((b) => b.label).filter(Boolean)).toEqual([
      "Sli'hot communes aux quatre jeûnes",
      "Nefilat apayim",
    ]);
    expect(sansSignes(communs[0].lines[0])).toContain("אנשי אמונה");
    expect(sansSignes(communs.at(-1)!.lines[0])).toContain("שוב מחרון אפך");
    // …et, dans la nefilat apayim, le piyout du jour, un par jeûne.
    const nefila = blocks.findIndex((b) => b.label === "Nefilat apayim");
    expect(blocks.slice(nefila + 1, nefila + 5).map((b) => b.when)).toEqual([
      "tsom-guedalia",
      "tsom-tevet",
      "tsom-esther",
      "tsom-tamouz",
    ]);
    expect(sansSignes(blocks[nefila + 3].lines[0])).toContain("אויב גבר");
    // Le tout entre le tahanoun ordinaire et « Yehi chem », que le Kaddich
    // suit quel que soit le jour.
    const ordinaireIndex = blocks.indexOf(ordinaire);
    for (const bloc of communs) expect(blocks.indexOf(bloc)).toBeGreaterThan(ordinaireIndex);
  });

  it("ne met ni talit ni téfilines le matin de Tich'a beAv", () => {
    const talit = blocks.findIndex((b) => b.label === "Le talit et les téfilines");
    // Les deux blocs, celui qui porte le titre et celui des téfilines qui le
    // suit sans titre.
    for (const bloc of [blocks[talit], blocks[talit + 1]]) {
      expect(bloc.when).toBe("sans-tisha-beav");
      // Dans le fil, non en encadré d'ajout : ils se disent presque tous les
      // jours, ce n'est pas une addition du calendrier.
      expect(bloc.plain).toBe(true);
    }
  });
});

describe("Arvit : le compte du 'Omer", () => {
  const entry = sidourEntries.find((e) => resolveFilePath(e).includes("arvit"))!;
  const blocks = parseContent(entry, loadRaw(entry)).sections[0].blocks ?? [];

  it("donne les quarante-neuf soirs, chacun avec sa bénédiction", () => {
    const soirs = blocks.filter((b) => /^omer-\d/.test(b.when ?? ""));
    expect(soirs).toHaveLength(49);
    expect(soirs.map((b) => b.when)).toEqual(Array.from({ length: 49 }, (_, i) => `omer-${i + 1}`));
    for (const soir of soirs) {
      // La bénédiction finit sur « hayom », le compte l'achève : les deux
      // doivent être dans le même bloc, ou la phrase se coupe en deux.
      expect(sansSignes(soir.lines.join(" "))).toContain("על ספירת העמר");
      expect(sansSignes(soir.lines.join(" "))).toContain("לעמר");
    }
    expect(sansSignes(soirs[0].lines.join(" "))).toContain("יום אחד לעמר");
    expect(sansSignes(soirs[48].lines.join(" "))).toContain("תשעה וארבעים יום");
  });

  it("l'encadre de son ouverture et de sa clôture, et le met à la fin", () => {
    const saison = blocks.filter((b) => b.when === "omer");
    expect(saison).toHaveLength(2);
    expect(saison[0].label).toBe("Sefirat ha'omer");
    expect(sansSignes(saison[1].lines.join(" "))).toContain("אנא בכח");
    // Après 'Alénou : le compte se dit l'office fini.
    const alenou = blocks.findIndex((b) => b.label === "'Alénou léchabéa'h");
    const premierSoir = blocks.findIndex((b) => b.when === "omer-1");
    expect(premierSoir).toBeGreaterThan(alenou);
  });
});

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

/**
 * Les autres textes de liturgie (bénédictions, rites, Sli'hot) : ils n'ont ni
 * 'Amida ni horaires, mais ils passent par le même lecteur, et ce qui vaut
 * pour lui vaut pour eux.
 *
 * Le point qui compte vraiment : la source du siddour alterne des consignes en
 * hébreu et le texte qui se dit, et les scripts les séparent au petit corps et
 * à la vocalisation (voir dropInstructionSmalls). Une consigne restée dans le
 * fil se lirait comme une prière ; ce test la rattrape.
 */
describe.each(autresLiturgies.map((entry) => [resolveFilePath(entry), entry] as const))(
  "texte de liturgie %s",
  (_path, entry) => {
    const content: TextContent = parseContent(entry, loadRaw(entry));
    const blocks = content.sections[0]?.blocks ?? [];

    it("se parse en une section avec des blocs", () => {
      expect(content.sections).toHaveLength(1);
      expect(blocks.length).toBeGreaterThan(0);
      expect(content.sections[0].he.length).toBeGreaterThan(0);
    });

    it("donne ses didascalies et halakhot dans les trois langues", () => {
      for (const block of blocks) {
        if (block.labelText) expect(isFullRubric(block.labelText)).toBe(true);
        for (const halakha of block.halakhot ?? []) expect(isFullRubric(halakha)).toBe(true);
        for (const paragraph of block.paragraphs ?? []) {
          if (paragraph.rubric) expect(isFullRubric(paragraph.rubric)).toBe(true);
        }
      }
    });

    it("ne garde aucune consigne dans le texte qui se dit", () => {
      // Ce qui se lit est vocalisé, les consignes de la source ne le sont pas :
      // dix caractères hébreux d'affilée sans une seule voyelle, c'est une
      // consigne qui a échappé au tri.
      const signes = /[֑-ֽֿׁׂׄ-ׇ]/;
      // Le Nom s'écrit parfois sans voyelles au milieu d'un texte vocalisé
      // (le vidouy des Sli'hot) : ce n'est pas une consigne.
      const NOMS = /יהוה|אלהינו|אלהים|אלהי|אדני/g;
      const suites = content.sections[0].he
        .map((ligne) => ligne.replace(NOMS, " "))
        .flatMap((ligne) => ligne.match(/[א-ת"'׳״\s]{10,}/g) ?? [])
        .filter((suite) => !signes.test(suite) && suite.trim().length >= 10);
      expect(suites).toEqual([]);
    });

    it("n'utilise que des clés when connues du calendrier", () => {
      // Sur les blocs, sur les paragraphes, sur les fragments et sur les
      // halakhot : une clé inconnue masquerait un passage pour toujours.
      const whens = blocks.flatMap((b) => [
        b.when,
        ...(b.halakhot ?? []).map((h) => h.when),
        ...(b.paragraphs ?? []).flatMap((p) => [p.when, ...p.runs.map((run) => run.when)]),
      ]);
      const unknown = whens
        .filter((when): when is string => Boolean(when))
        .flatMap(keysOf)
        .filter((key) => !KNOWN_WHEN.has(key));
      expect(unknown).toEqual([]);
    });
  },
);
