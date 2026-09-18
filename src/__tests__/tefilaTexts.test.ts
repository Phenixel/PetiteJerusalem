import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { HDate } from "@hebcal/core";
import { activeOccasions } from "../services/dailyCycles";
import { withoutTachanun } from "../services/tachanun";
import { parseContent, resolveFilePath, saidOn } from "../services/textService";
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
    // Le bloc des fêtes : sept mentions, chacune conditionnée à son occasion,
    // dans le fil et non en bloc de variantes : le jour choisit, et ce qu'il
    // ajoute se lit à la couleur du thème (accent).
    const fetes = blocks.find((b) => (b.paragraphs ?? []).some((p) => p.when === "rosh-chodesh"))!;
    expect(fetes.variants).toBeUndefined();
    for (const paragraph of fetes.paragraphs ?? []) {
      expect(paragraph.runs.some((run) => run.kind === "he" && run.accent)).toBe(true);
    }
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
    // Ce qui change selon le repas sort du fil, en blocs de variantes : on en
    // choisit une, on ne les lit pas toutes. Ce qui change selon le jour
    // reste dans le fil : le calendrier choisit pour le lecteur.
    expect(blocks.filter((b) => b.variants)).toHaveLength(3);
    // Comparé sans vocalisation : l'ordre des signes varie d'une source à l'autre.
    const stripNiqqud = (s: string) => s.normalize("NFC").replace(/[֑-ׇ]/g, "");
    const all = stripNiqqud(content.sections[0].he.join(" "));
    // Le cœur de la bénédiction, absent de l'ancienne version fragmentée.
    expect(all).toContain("ובנה ירושלים");
    expect(all).toContain("בורא נפשות");
  });

  it("Chema al hamita : le verset de cette nuit seul, et trois fois", () => {
    // Ana bekhoah se dit en entier chaque nuit ; c'est ensuite le verset de la
    // nuit qu'on répète trois fois. Les sept versets restent donc dans le fil,
    // et le bloc qui suit n'en montre qu'un, celui du soir, écrit trois fois.
    const content = load("sidour", "chema-al-hamita");
    const blocks = content.sections[0].blocks ?? [];
    const piyout = blocks.find((b) => b.label === "Ana bekhoah")!;
    expect(piyout.paragraphs).toHaveLength(8); // les sept versets, puis Baroukh chem
    for (const paragraph of piyout.paragraphs ?? []) expect(paragraph.when).toBeUndefined();

    const nuit = blocks.find((b) => b.label === "Le verset de cette nuit")!;
    const paragraphs = nuit.paragraphs ?? [];
    expect(paragraphs.map((p) => p.when)).toEqual([
      "jour-0",
      "jour-1",
      "jour-2",
      "jour-3",
      "jour-4",
      "jour-5",
      "jour-6",
    ]);
    for (const paragraph of paragraphs) expect(paragraph.repeat).toBe(3);
    // Un soir donné, un seul se dit : celui du jour hébraïque commencé à la
    // chkia. Dimanche 20 septembre 2026, ce sera le premier.
    const occ = activeOccasions(hd(2026, 9, 20), false);
    const dits = paragraphs.filter((p) => saidOn(p.when, occ, p.unless));
    expect(dits).toHaveLength(1);
    expect(dits[0].when).toBe("jour-0");
    // Et c'est bien le verset que le piyout porte en première ligne.
    const premier = (p: (typeof paragraphs)[number]) =>
      p.runs.map((run) => (run.kind === "he" ? run.text : "")).join(" ");
    expect(premier(dits[0])).toBe(premier(piyout.paragraphs![0]));
  });

  it("Chema al hamita : Hamapil garde son Nom avant hatsot, le pense après", () => {
    // Passé le milieu de la nuit, le Nom et la royauté se pensent : la source
    // les met entre parenthèses, et la halakha qui l'explique ne s'affiche
    // qu'alors. Avant hatsot, la bénédiction se dit en entier.
    const content = load("sidour", "chema-al-hamita");
    const hamapil = (content.sections[0].blocks ?? []).find((b) =>
      (b.halakhot ?? []).some((h) => h.when === "apres-hatsot"),
    )!;
    const paragraphs = hamapil.paragraphs ?? [];
    expect(paragraphs).toHaveLength(2);
    const texte = (i: number) =>
      paragraphs[i].runs.map((run) => (run.kind === "he" ? run.text : "")).join(" ");
    expect(paragraphs[0].unless).toBe("apres-hatsot");
    expect(texte(0)).not.toContain("(");
    expect(paragraphs[1].when).toBe("apres-hatsot");
    expect(texte(1)).toContain("(");
    // Les deux s'excluent : une nuit donnée, une seule des deux se lit.
    const avant = new Set<string>();
    const apres = new Set(["apres-hatsot"]);
    expect(paragraphs.filter((p) => saidOn(p.when, avant, p.unless))).toHaveLength(1);
    expect(paragraphs.filter((p) => saidOn(p.when, apres, p.unless))).toHaveLength(1);
    // Le même texte de part et d'autre, aux parenthèses près.
    expect(texte(1).replace(/[()]/g, "").replace(/\s+/g, " ")).toBe(texte(0));
  });

  it("Chema al hamita : le verset de Yeshayahou est celui du Tanakh servi", () => {
    // « Nafshi ivitikha balayla » (Yeshayahou 26,9) s'ajoute avant « Ata
    // takoum » : il est recopié dans le fichier de tefila, il doit rester
    // identique au verset que le corpus du Tanakh sert par ailleurs.
    const content = load("sidour", "chema-al-hamita");
    const ajout = (content.sections[0].blocks ?? [])
      .flatMap((b) => b.paragraphs ?? [])
      .find((p) => p.rubric?.fr === "Certains ajoutent :")!;
    expect(ajout.muted).toBe(true);
    const verset = ajout.runs.map((run) => (run.kind === "he" ? run.text : "")).join(" ");
    const yeshayahou = JSON.parse(readFileSync("public/texts/tanakh/324.json", "utf8")) as {
      he: string[][];
    };
    expect(verset).toBe(yeshayahou.he[25][8]);
  });

  it("Atarat nedarim : les deux voix alternent, les rites se suivent", () => {
    // Le texte se dit à deux voix, ceux qui demandent et ceux qui délient :
    // ce sont les didascalies qui disent à qui c'est le tour, et il en faut
    // donc une à chaque changement de voix. Les deux rites que le mahzor met
    // à la suite gardent son ordre, chacun sous son titre.
    const content = load("moadim", "atarat-nedarim");
    const blocks = content.sections[0].blocks ?? [];
    expect(blocks.map((b) => b.label)).toEqual([
      "L'annulation des malédictions",
      "La déclaration pour l'avenir",
      "L'annulation des vœux",
      "La déclaration pour l'avenir",
      "Yehi ratson",
      "L'annulation des malédictions du Hida",
    ]);
    // Rien ne se dérobe selon la date : on le dit d'un bout à l'autre.
    for (const block of blocks) expect(block.when).toBeUndefined();
    const paragraphs = blocks.flatMap((b) => b.paragraphs ?? []);
    expect(paragraphs.filter((p) => p.rubric).length).toBeGreaterThan(8);
    // La réponse de ceux qui délient se répète trois fois, comme la
    // didascalie l'annonce.
    expect(paragraphs.filter((p) => p.repeat === 3)).toHaveLength(1);
  });

  it("Atarat nedarim : les deux quand on le dit tiennent dans ses halakhot", () => {
    // La veille de Roch Hachana et la veille de Kippour : c'est la halakha du
    // texte qui le dit, il n'a pas de `when` pour le poser au jour dit.
    const content = load("moadim", "atarat-nedarim");
    const halakhot = (content.sections[0].blocks ?? []).flatMap((b) => b.halakhot ?? []);
    expect(halakhot).toHaveLength(2);
    expect(halakhot.map((h) => h.fr).join(" ")).toContain("Roch Hachana");
    expect(halakhot.map((h) => h.fr).join(" ")).toContain("Kippour");
    for (const halakha of halakhot) expect(halakha.he).toBeTruthy();
  });

  it("Sli'hot : des séparations titrées, aucun ajout masqué", () => {
    const content = load("moadim", "slihot");
    const blocks = content.sections[0].blocks ?? [];
    expect(blocks.length).toBeGreaterThan(10);
    // Rien ne disparaît selon la date : les Sli'hot se lisent d'un bout à
    // l'autre, les passages de saison sont repliés (`fold`), pas cachés.
    for (const block of blocks) expect(block.when).toBeUndefined();
    expect(blocks.filter((b) => b.label).length).toBeGreaterThan(10);
  });

  it("Sli'hot : les ajouts des dix jours de pénitence sont repliables", () => {
    const content = load("moadim", "slihot");
    const folded = (content.sections[0].blocks ?? []).filter(
      (b) => b.fold && !b.fold.startsWith("jour-"),
    );
    expect(folded.length).toBeGreaterThan(2);
    for (const block of folded) expect(block.fold).toBe("teshuva");
    // L'occasion qui les déplie existe bien au calendrier.
    expect(activeOccasions(hd(2026, 9, 15), false).has("teshuva")).toBe(true);
  });

  it("Sli'hot : la té'hina du jour se déplie d'elle-même, les six restent lisibles", () => {
    const content = load("moadim", "slihot");
    const blocks = content.sections[0].blocks ?? [];
    const tehinot = blocks.filter((b) => b.fold?.startsWith("jour-"));
    // Du dimanche au vendredi : le Chabbat ne dit pas de Sli'hot.
    expect(tehinot.map((b) => b.fold)).toEqual([
      "jour-0",
      "jour-1",
      "jour-2",
      "jour-3",
      "jour-4",
      "jour-5",
    ]);
    // Chacune porte son titre dans les trois langues, faute de quoi l'encadré
    // n'aurait rien à afficher : aucune occasion « jour-N » n'a de libellé.
    for (const block of tehinot)
      expect(block.labelText).toMatchObject({
        fr: expect.any(String),
        en: expect.any(String),
        he: expect.any(String),
      });
    // Elles se placent entre le psaume 25 et Atanou, comme dans le sidour.
    const index = (label: string) => blocks.findIndex((b) => b.label === label);
    expect(index("LeDavid élékha (Tehilim 25)")).toBeLessThan(blocks.indexOf(tehinot[0]));
    expect(blocks.indexOf(tehinot[5])).toBeLessThan(index("Ataanou"));
    // Un seul jour à la fois : le mercredi 26 août 2026 n'ouvre que la sienne.
    const occ = activeOccasions(hd(2026, 8, 26), false);
    expect(tehinot.filter((b) => occ.has(b.fold!))).toHaveLength(1);
  });

  it("Sli'hot : les reprises de l'assemblée et les répétitions sont marquées", () => {
    const content = load("moadim", "slihot");
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
    const content = load("moadim", "slihot");
    const bare = content.sections[0].he.join(" ").replace(/[֑-ׇ]/g, "");
    expect(bare).toContain("אנא כעב זדוני תמחהו");
    expect(bare).toContain("ויודע כי משיח אלהים הוא");
    expect(bare).toContain("אלהים אתה ידעת לאולתי");
    expect(bare).toContain("עננו אבינו עננו");
    // Sept strophes, chacune fermée sur le refrain que reprend l'assemblée.
    // Le pizmon s'arrête là : les treize midot qui le suivaient n'étaient pas
    // les siennes, et venaient sans « El mélekh yochev », l'invocation qui les
    // ouvre partout ailleurs dans le fichier.
    const ana = (content.sections[0].blocks ?? []).find((b) => b.label === "Ana ke'av zedoni")!;
    expect(ana.lines).toHaveLength(7);
    for (const paragraph of ana.paragraphs ?? []) {
      expect(paragraph.runs.some((run) => run.kind === "he" && run.strong)).toBe(true);
    }
  });

  it("Sli'hot : « Élohénou chébachamayim » ouvre une lettre, pas chaque demande", () => {
    // Au siddour l'invocation s'écrit une fois, puis viennent les demandes de
    // sa lettre. Le fichier d'origine la répétait devant chacune des soixante.
    const content = load("moadim", "slihot");
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
    const content = load("moadim", "slihot");
    const vidoui = (content.sections[0].blocks ?? []).find((b) => b.label === "Vidoui (Achamnou)")!;
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
      p.runs.some(
        (run) => run.kind === "he" && /רבונו של עולם/.test(run.text.replace(/[֑-ׇ]/g, "")),
      ),
    )!;
    expect(ribono.runs).toHaveLength(2);
    expect(ribono.runs[0]).toMatchObject({ strong: true });
    expect(ribono.runs[1].kind === "he" && ribono.runs[1].strong).toBeFalsy();
  });

  it("Sli'hot : les piyoutim à deux voix portent leur première moitié en gras", () => {
    // « Lekha Adonaï hatsedaka » : chaque ligne s'ouvre sur les mots du paytan
    // et se ferme sur ce qui leur répond, que la ligne suivante reprendra.
    const lekha = (load("moadim", "slihot").sections[0].blocks ?? []).find(
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
    const chema = (load("moadim", "slihot").sections[0].blocks ?? []).find(
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
      ["moadim", "slihot"],
      ["moadim", "atarat-nedarim"],
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
      ["moadim", "slihot"],
      ["moadim", "atarat-nedarim"],
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

// « Sans tahanoun » (réglage du menu de lecture) : le lecteur retire le
// tahanoun que le calendrier laissait, une brit mila ou un marié dans
// l'assemblée. Le jour est refait comme un jour où il ne se dit pas.
describe("withoutTachanun", () => {
  it("retire le tahanoun des deux offices, et met Yehi chem à sa place", () => {
    // Lundi 17 août 2026 : tahanoun ordinaire, avec les supplications du lundi.
    const occ = activeOccasions(hd(2026, 8, 17), false);
    expect(occ.has("tahanoun")).toBe(true);
    expect(occ.has("tahanoun-lundi-jeudi")).toBe(true);

    const sans = withoutTachanun(occ);
    const restants = ["tahanoun", "tahanoun-minha", "tahanoun-ordinaire", "tahanoun-lundi-jeudi"];
    expect(restants.filter((key) => sans.has(key))).toEqual([]);
    expect(sans.has("sans-tahanoun")).toBe(true);
    expect(sans.has("sans-tahanoun-minha")).toBe(true);
    // Le reste du jour ne bouge pas.
    expect(sans.has("ete")).toBe(true);
    expect(sans.has("jour-1")).toBe(true);
    // Et le jeu d'origine n'est pas touché.
    expect(occ.has("tahanoun")).toBe(true);
  });

  it("ne change rien à un Chabbat, qui n'a pas de tahanoun à retirer", () => {
    const occ = activeOccasions(hd(2026, 8, 22), false);
    const sans = withoutTachanun(occ);
    expect([...sans].sort()).toEqual([...occ].sort());
    expect(sans.has("sans-tahanoun")).toBe(false);
  });
});
