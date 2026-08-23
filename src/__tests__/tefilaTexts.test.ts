import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { HDate } from "@hebcal/core";
import { activeOccasions } from "../services/dailyCycles";
import { parseContent, resolveFilePath } from "../services/textService";
import { entryByCorpusSlug } from "../content/etudeTexts";

// Les textes de tefila : blocs conditionnels de Birkat Hamazon (ajouts du
// calendrier) et occasions qui les pilotent.

const hd = (y: number, m: number, d: number) => new HDate(new Date(y, m - 1, d, 12));

describe("activeOccasions", () => {
  it("jour ordinaire : aucun ajout du calendrier", () => {
    // Mardi 18 août 2026, 5 Eloul. Les clés permanentes du sidour (saison,
    // tahanoun, jour de la semaine, Lédavid en Eloul) sont là ; aucun ajout
    // de fête ne s'affiche.
    const occ = activeOccasions(hd(2026, 8, 18), false);
    const additions = [
      "shabbat",
      "shabbat-or-moed",
      "rosh-chodesh",
      "rosh-hashana",
      "yom-tov",
      "moed",
      "moadim",
      "nissim",
      "teshuva",
      "torah-semaine",
    ];
    expect(additions.filter((key) => occ.has(key))).toEqual([]);
    expect(occ.has("ete")).toBe(true);
    expect(occ.has("barkhenou")).toBe(true);
    expect(occ.has("tahanoun")).toBe(true);
    expect(occ.has("jour-2")).toBe(true);
    expect(occ.has("ledavid")).toBe(true);
  });

  it("Chabbat : Retsé, mais pas Yaalé véyavo", () => {
    const occ = activeOccasions(hd(2026, 8, 22), false);
    expect(occ.has("shabbat")).toBe(true);
    expect(occ.has("shabbat-or-moed")).toBe(true);
    expect(occ.has("moed")).toBe(false);
  });

  it("Roch Hodech : Yaalé véyavo", () => {
    // 13 août 2026 = 30 Av, Roch Hodech Eloul.
    const occ = activeOccasions(hd(2026, 8, 13), false);
    expect(occ.has("rosh-chodesh")).toBe(true);
    expect(occ.has("moed")).toBe(true);
    expect(occ.has("nissim")).toBe(false);
  });

  it("Hanouka : Al hanissim dès le premier jour, pas la veille", () => {
    // 25 Kislev 5787 = 5 décembre 2026 ; la veille porte « 1 Candle » chez
    // hebcal (l'allumage du soir) mais n'est pas encore Hanouka.
    expect(activeOccasions(hd(2026, 12, 5), false).has("nissim")).toBe(true);
    expect(activeOccasions(hd(2026, 12, 4), false).has("nissim")).toBe(false);
  });

  it("Dix jours de pénitence : de Roch Hachana à Yom Kippour", () => {
    // 5787 : Roch Hachana le 12 septembre 2026, Yom Kippour le 21.
    expect(activeOccasions(hd(2026, 9, 12), false).has("teshuva")).toBe(true);
    expect(activeOccasions(hd(2026, 9, 21), false).has("teshuva")).toBe(true);
    // La veille (29 Eloul) et le lendemain (11 Tichri) n'en sont pas.
    expect(activeOccasions(hd(2026, 9, 11), false).has("teshuva")).toBe(false);
    expect(activeOccasions(hd(2026, 9, 22), false).has("teshuva")).toBe(false);
  });

  it("Pessah : Yom Tov et jours de fête", () => {
    // 2 avril 2026 = 15 Nissan 5786.
    const occ = activeOccasions(hd(2026, 4, 2), false);
    expect(occ.has("yom-tov")).toBe(true);
    expect(occ.has("moed")).toBe(true);
    expect(occ.has("moadim")).toBe(true);
  });

  it("Roch Hachana : son ajout le jour même, pas la veille", () => {
    // 12 septembre 2026 = 1 Tichri 5787 ; le 11 est encore le 29 Eloul.
    expect(activeOccasions(hd(2026, 9, 12), false).has("rosh-hashana")).toBe(true);
    expect(activeOccasions(hd(2026, 9, 11), false).has("rosh-hashana")).toBe(false);
  });

  it("Les fêtes mineures homonymes n'ouvrent aucun ajout", () => {
    // 14 août 2026 = 1 Eloul : « Rosh Hashana LaBehemot », le nouvel an du
    // bétail, un mois avant Roch Hachana. Roch Hodech Eloul y est bien, lui.
    const behemot = activeOccasions(hd(2026, 8, 14), false);
    expect(behemot.has("rosh-hashana")).toBe(false);
    expect(behemot.has("rosh-chodesh")).toBe(true);

    // 1er mai 2026 = 14 Iyar, « Pessah Sheni » : un jour ordinaire, sans
    // Yaalé véyavo.
    const sheni = activeOccasions(hd(2026, 5, 1), false);
    expect(sheni.has("moadim")).toBe(false);
    expect(sheni.has("moed")).toBe(false);
  });
});

describe("fichiers de tefila", () => {
  const load = (corpus: string, slug: string) => {
    const entry = entryByCorpusSlug(corpus, slug)!;
    const data = JSON.parse(readFileSync(`public${resolveFilePath(entry)}`, "utf8"));
    return parseContent(entry, data);
  };

  it("Birkat Hamazon : un fil continu, les ajouts du calendrier en blocs `when`", () => {
    const content = load("brahot", "birkat-hamazon");
    const blocks = content.sections[0].blocks ?? [];
    expect(blocks.length).toBeGreaterThan(5);
    // Les ajouts connus sont là, chacun conditionné.
    const whens = blocks.filter((b) => b.when).map((b) => b.when);
    for (const expected of ["shabbat", "moed", "nissim"]) expect(whens).toContain(expected);
    // Les offsets se suivent : les marque-pages pointent des lignes stables,
    // même quand un bloc conditionnel est masqué à l'affichage.
    let offset = 0;
    for (const block of blocks) {
      expect(block.offset).toBe(offset);
      expect(block.paragraphs).toHaveLength(block.lines.length);
      offset += block.lines.length;
    }
    expect(content.sections[0].he.length).toBe(offset);
  });

  it("Birkat Hamazon : le zimoun porte ses didascalies dans les trois langues", () => {
    const content = load("brahot", "birkat-hamazon");
    const zimun = (content.sections[0].blocks ?? []).find((b) => b.label === "Zimoun")!;
    expect(zimun.labelText).toMatchObject({
      fr: expect.any(String),
      en: expect.any(String),
      he: expect.any(String),
    });
    // Chaque réplique dit qui parle, le mezamen, puis les convives.
    for (const paragraph of zimun.paragraphs ?? []) expect(paragraph.rubric).toBeDefined();
    // « Chamayim », la réponse de l'assemblée, est mise en avant.
    const answered = (zimun.paragraphs ?? []).flatMap((p) => p.runs);
    expect(answered.some((run) => run.kind === "he" && run.strong)).toBe(true);
    // Une didascalie glissée dans le fil ne compte pas dans le texte hébreu.
    const inline = (zimun.paragraphs ?? []).flatMap((p) =>
      p.runs.filter((run) => run.kind === "rubric"),
    );
    expect(inline.length).toBeGreaterThan(0);
    for (const line of zimun.lines) expect(line).not.toContain("בעשרה ויותר");
  });

  it("Mé'ein chaloch : chaque fête ne s'affiche qu'à son jour", () => {
    const content = load("brahot", "brakha-aharona");
    const blocks = content.sections[0].blocks ?? [];
    // Le bloc des fêtes : sept variantes, chacune conditionnée à son occasion.
    const fetes = blocks.find((b) =>
      (b.paragraphs ?? []).some((p) => p.when === "rosh-chodesh"),
    )!;
    expect(fetes.variants).toBe(true);
    const whens = (fetes.paragraphs ?? []).map((p) => p.when);
    expect(whens).toEqual([
      "shabbat",
      "rosh-chodesh",
      "rosh-hashana",
      "pesach",
      "shavuot",
      "sukkot",
      "shemini-atzeret",
    ]);
    // Toutes ces occasions existent au calendrier : le 15 Nissan (Pessah,
    // Yom Tov) doit en allumer, un mardi de 'Hechvan aucune.
    const pessah = activeOccasions(new HDate(new Date(2026, 3, 2)), false);
    expect(pessah.has("pesach")).toBe(true);
    const ordinaire = activeOccasions(hd(2026, 8, 18), false);
    for (const when of whens) expect(ordinaire.has(when!)).toBe(false);
    // Les lignes gardent leur index : les offsets des blocs ne bougent pas.
    expect(fetes.lines).toHaveLength(7);
  });

  it("les didascalies au fil du texte montrent le texte affecté (accent)", () => {
    // « (les jours où l'on dit Moussaf … on dit) מגדול » : le lecteur voit en
    // couleur la partie du texte que la consigne concerne, et מגדיל ne
    // s'affiche que les jours ordinaires (clé magdil).
    const birkat = load("brahot", "birkat-hamazon");
    const paragraphs = (birkat.sections[0].blocks ?? []).flatMap((b) => b.paragraphs ?? []);
    const magdil = paragraphs.find((p) =>
      p.runs.some((run) => run.kind === "he" && run.when === "magdil"),
    )!;
    expect(magdil).toBeDefined();
    const runs = magdil.runs;
    expect(runs.some((run) => run.kind === "he" && run.accent)).toBe(true);
    // La brakha a'harona : la variante d'Israël en accent, jamais masquée.
    const aharona = load("brahot", "brakha-aharona");
    const accented = (aharona.sections[0].blocks ?? [])
      .flatMap((b) => b.paragraphs ?? [])
      .flatMap((p) => p.runs)
      .filter((run) => run.kind === "he" && run.accent);
    expect(accented.length).toBeGreaterThanOrEqual(6);
  });

  it("Brakha A'harona : le Mé'ein chaloch complet puis Boré nefachot", () => {
    const content = load("brahot", "brakha-aharona");
    const blocks = content.sections[0].blocks ?? [];
    expect(blocks.map((b) => b.label).filter(Boolean)).toEqual([
      "Mé'ein chaloch (Al hami'hya)",
      "Boré nefachot",
    ]);
    // Ce qui change selon le repas ou selon le jour sort du fil, en blocs de
    // variantes : on en choisit une, on ne les lit pas toutes.
    expect(blocks.filter((b) => b.variants)).toHaveLength(4);
    // Comparé sans vocalisation : l'ordre des signes varie d'une source à l'autre.
    const stripNiqqud = (s: string) => s.normalize("NFC").replace(/[֑-ׇ]/g, "");
    const all = stripNiqqud(content.sections[0].he.join(" "));
    // Le cœur de la bénédiction, absent de l'ancienne version fragmentée.
    expect(all).toContain("ובנה ירושלים");
    expect(all).toContain("בורא נפשות");
  });

  it("Sli'hot : des séparations titrées, aucun ajout masqué", () => {
    const content = load("slihot", "slihot");
    const blocks = content.sections[0].blocks ?? [];
    expect(blocks.length).toBeGreaterThan(10);
    // Rien ne disparaît selon la date : les Sli'hot se lisent d'un bout à
    // l'autre, les passages de saison sont repliés (`fold`), pas cachés.
    for (const block of blocks) expect(block.when).toBeUndefined();
    expect(blocks.filter((b) => b.label).length).toBeGreaterThan(10);
  });

  it("Sli'hot : les ajouts des dix jours de pénitence sont repliables", () => {
    const content = load("slihot", "slihot");
    const folded = (content.sections[0].blocks ?? []).filter((b) => b.fold);
    expect(folded.length).toBeGreaterThan(2);
    for (const block of folded) expect(block.fold).toBe("teshuva");
    // L'occasion qui les déplie existe bien au calendrier.
    expect(activeOccasions(hd(2026, 9, 15), false).has("teshuva")).toBe(true);
  });

  it("Sli'hot : les reprises de l'assemblée et les répétitions sont marquées", () => {
    const content = load("slihot", "slihot");
    const paragraphs = (content.sections[0].blocks ?? []).flatMap((b) => b.paragraphs ?? []);
    // « בדיל ויעבור », « והושיענו למען שמך »… : ce que reprend l'assemblée.
    const strong = paragraphs.filter((p) => p.runs.some((run) => run.kind === "he" && run.strong));
    expect(strong.length).toBeGreaterThan(50);
    // « HaChem hou haElohim » se dit deux fois : le paragraphe le porte.
    expect(paragraphs.filter((p) => p.repeat === 2).length).toBeGreaterThan(0);
  });

  it("Sli'hot : les deux piyoutim relevés au siddour sont bien là", () => {
    // Ils manquaient au fichier d'origine ; le texte vocalisé vient du siddour
    // Torah-Box (pages 3 à 4 et 7). Comparé sans vocalisation : c'est la suite
    // des consonnes qui fait foi, l'ordre des signes varie d'une source à l'autre.
    const content = load("slihot", "slihot");
    const bare = content.sections[0].he.join(" ").replace(/[֑-ׇ]/g, "");
    expect(bare).toContain("אנא כעב זדוני תמחהו");
    expect(bare).toContain("ויודע כי משיח אלהים הוא");
    expect(bare).toContain("אלהים אתה ידעת לאולתי");
    expect(bare).toContain("עננו אבינו עננו");
    // Chaque strophe se ferme sur le refrain que reprend l'assemblée.
    const ana = (content.sections[0].blocks ?? []).find((b) => b.label === "Ana ke'av zedoni")!;
    expect(ana.lines).toHaveLength(8);
    for (const paragraph of (ana.paragraphs ?? []).slice(0, 7)) {
      expect(paragraph.runs.some((run) => run.kind === "he" && run.strong)).toBe(true);
    }
  });

  it("Sli'hot : « Élohénou chébachamayim » ouvre une lettre, pas chaque demande", () => {
    // Au siddour l'invocation s'écrit une fois, puis viennent les demandes de
    // sa lettre. Le fichier d'origine la répétait devant chacune des soixante.
    const content = load("slihot", "slihot");
    const paragraphs = (content.sections[0].blocks ?? []).flatMap((b) => b.paragraphs ?? []);
    const bare = (p: (typeof paragraphs)[number]) =>
      p.runs
        .filter((run) => run.kind === "he")
        .map((run) => (run.kind === "he" ? run.text : ""))
        .join(" ")
        .replace(/[֑-ׇ]/g, "");
    const invocation = "אלהינו שבשמים";
    // Vingt-deux lettres de l'acrostiche, plus les « kotvenou » des dix jours,
    // qui forment leur propre strophe dans leur encadré.
    const leads = paragraphs.filter((p) => p.lead);
    expect(leads).toHaveLength(23);
    for (const paragraph of leads) expect(bare(paragraph)).toBe(invocation);
    // Elle ne reste en tête de ligne que sur l'appel d'ouverture et les deux
    // de clôture, qui ne sont pas de l'acrostiche.
    const inline = paragraphs.filter((p) => !p.lead && bare(p).startsWith(invocation));
    expect(inline).toHaveLength(3);
    // Une strophe suit toujours son invocation : jamais deux d'affilée.
    const acrostic = "אבגדהוזחטיכלמנסעפצקרשת";
    let letter = -1;
    for (let i = 0; i < paragraphs.length; i++) {
      if (!paragraphs[i].lead) continue;
      expect(paragraphs[i + 1]?.lead).toBeFalsy();
      const next = acrostic.indexOf(bare(paragraphs[i + 1])[0]);
      expect(next).toBeGreaterThanOrEqual(letter);
      letter = next;
    }
  });

  it("Sli'hot : le vidoui tient une ligne par lettre, l'aveu en gras", () => {
    // « Achamnou. Akhalnou maakhalot assourot » : la formule de l'aveu porte
    // la ligne, ce que le rite lui ajoute la suit en texte courant.
    const content = load("slihot", "slihot");
    const vidoui = (content.sections[0].blocks ?? []).find(
      (b) => b.label === "Vidoui (Achamnou)",
    )!;
    const heads = (vidoui.paragraphs ?? [])
      .map((p) => p.runs[0])
      .filter((run) => run.kind === "he" && run.strong)
      .map((run) => (run.kind === "he" ? run.text.replace(/[֑-ׇ]/g, "")[0] : ""));
    // Le bloc porte aussi « Ribono chel olam » et les refrains de clôture,
    // eux aussi mis en avant : l'acrostiche s'y suit d'un trait.
    expect(heads.join("")).toContain("אבגדהוזחטיכלמנסעפצקרשת");
    // « Ribono chel olam » : le verset qui ferme chaque strophe reste en texte
    // courant, seuls les mots du paytan sont en avant.
    const ribono = (vidoui.paragraphs ?? []).find((p) =>
      p.runs.some((run) => run.kind === "he" && /רבונו של עולם/.test(run.text.replace(/[֑-ׇ]/g, ""))),
    )!;
    expect(ribono.runs).toHaveLength(2);
    expect(ribono.runs[0]).toMatchObject({ strong: true });
    expect(ribono.runs[1].kind === "he" && ribono.runs[1].strong).toBeFalsy();
  });

  it("Sli'hot : les piyoutim à deux voix portent leur première moitié en gras", () => {
    // « Lekha Adonaï hatsedaka » : chaque ligne s'ouvre sur les mots du paytan
    // et se ferme sur ce qui leur répond, que la ligne suivante reprendra.
    const lekha = (load("slihot", "slihot").sections[0].blocks ?? []).find(
      (b) => b.label === "Lekha Adonaï hatsedaka",
    )!;
    expect(lekha.paragraphs).toHaveLength(33);
    for (const paragraph of lekha.paragraphs ?? []) {
      const [head, answer] = paragraph.runs;
      expect(paragraph.runs).toHaveLength(2);
      expect(head).toMatchObject({ kind: "he", strong: true });
      expect(head.kind === "he" && head.text.endsWith(".")).toBe(true);
      expect(answer.kind === "he" && answer.strong).toBeFalsy();
    }
  });

  it("Sli'hot : « HaChem melekh » referme chacun de ses deux tercets", () => {
    // Les trois membres d'un tercet portent l'un après l'autre les trois temps
    // de la reprise ; l'assemblée la redit entière à la fin de chacun.
    const chema = (load("slihot", "slihot").sections[0].blocks ?? []).find(
      (b) => b.label === "Chéma Israël",
    )!;
    const refrain = "יהוה מלך. יהוה מלך. יהוה ימלך לעולם ועד:";
    const alone = chema.lines.filter((l) => l.replace(/[֑-ׇ]/g, "") === refrain);
    expect(alone).toHaveLength(3);
    // Un tercet se lit d'un trait : seule sa première ligne garde le blanc
    // d'un paragraphe au-dessus d'elle.
    const paragraphs = chema.paragraphs ?? [];
    const tercet = paragraphs.slice(6, 10);
    expect(tercet.map((p) => !!p.tight)).toEqual([false, true, true, true]);
  });

  it("aucun fragment ne commence par une ponctuation", () => {
    // Les fragments d'un paragraphe sont rendus séparés d'une espace : un
    // fragment ouvrant sur « : » afficherait « הוא : ». La ponctuation reste
    // donc attachée au fragment qu'elle ferme.
    for (const [corpus, slug] of [
      ["slihot", "slihot"],
      ["brahot", "birkat-hamazon"],
      ["brahot", "birkat-halevana"],
      ["brahot", "brakha-aharona"],
      ["brahot", "cheva-brahot"],
    ] as const) {
      const paragraphs = (load(corpus, slug).sections[0].blocks ?? []).flatMap(
        (b) => b.paragraphs ?? [],
      );
      for (const paragraph of paragraphs) {
        for (const run of paragraph.runs) {
          if (run.kind === "he") expect(run.text).not.toMatch(/^[.,;:!?]/);
        }
      }
    }
  });

  it("les didascalies hébraïques ne traînent plus dans le texte", () => {
    // Elles vivaient collées aux versets ; elles sont désormais traduites et
    // rendues à part, aucune ne doit rester dans ce qui se lit.
    const MARKERS = ["בעשרת ימי תשובה", "יש אומרים", "והמסובים עונים", "אומרים קדיש"];
    for (const [corpus, slug] of [
      ["slihot", "slihot"],
      ["brahot", "birkat-hamazon"],
      ["brahot", "birkat-halevana"],
      ["brahot", "brakha-aharona"],
    ] as const) {
      for (const line of load(corpus, slug).sections[0].he) {
        for (const marker of MARKERS) expect(line).not.toContain(marker);
      }
    }
  });
});
