/**
 * Construit les textes du sidour de semaine (Cha'harit, Min'ha, Arvit, et le
 * Kaddich comme texte à lui) à partir du Siddur Edot HaMizrach de l'export
 * public Sefaria (GCS), au format des fichiers de tefila
 * (public/texts/tefila/*, voir loadTefila dans src/services/textService.ts).
 *
 * Lancer avec : node scripts/build-sidour.mjs
 *
 * La mise en forme est une recette explicite, bloc par bloc : quels segments
 * de la source entrent, avec quelles didascalies (trilingues), quelles
 * conditions de calendrier (`when`, voir dailyCycles.activeOccasions), quelles
 * halakhot et quels marqueurs d'horaires (`zman`) et de lecture de la Torah
 * (`torahWeekly`). La source porte ses consignes en hébreu dans des balises
 * <small> ; la recette les remplace par des didascalies dans les trois
 * langues, le reste des <small> (références, acronymes) est retiré.
 *
 * Licence des textes : l'export Sefaria « merged » combine des sources du
 * domaine public.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  cleanFinal,
  dropSmalls,
  fetchMerged,
  fetchSiddur,
  MACHZOR_YOM_KIPPUR_URL,
  outerSmalls,
  segText,
  sliceBetween,
  splitAfter,
  stripMarks,
} from "./lib/sefaria-siddur.mjs";
import {
  AJOUT_GUEDALIA,
  AVAL_HATANOU,
  CHEMA_KOLI,
  CHLOCH_ESRE_MIDOT,
  CHOUV_MEHARON,
  NEFILAT_APAYIM,
  YIKOM_DAM,
} from "./lib/selihot-tsom.mjs";
import {
  HALAKHA_LOULAV,
  HALAKHA_AVANT_LOULAV,
  LIGNES_AVANT_LOULAV,
  LIGNES_LOULAV,
  RUBRIC_NAANOUIM_ANA,
  RUBRIC_NAANOUIM_HODOU,
  RUBRIC_NAANOUIM_HODOU_FIN,
} from "./lib/loulav.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/texts/tefila");

/**
 * « Ki tolid banim », Devarim 4, 25 à 40 : la lecture du matin de Tich'a
 * beAv. L'export du siddour ne la porte pas ; elle vient du fichier de la
 * paracha Vaét'hanan (public/texts/tanakh/308.json, découpé en montées : la
 * seconde ouvre au 4, 5, le verset 25 est donc son vingt-et-unième).
 */
const KI_TOLID_BANIM = (() => {
  const vaethanan = JSON.parse(
    readFileSync(resolve(__dirname, "../public/texts/tanakh/308.json"), "utf8"),
  );
  const versets = vaethanan.he[1].slice(20, 36);
  if (versets.length !== 16 || !/תוֹלִ/.test(versets[0])) {
    throw new Error("Vaét'hanan : le découpage de la 2e montée a changé");
  }
  return versets.join(" ");
})();

/**
 * Les fichiers de textes que l'application sert déjà (public/texts), lus une
 * fois chacun : un livre des Nevi'im sert à plusieurs haftarot.
 */
const TEXTS = resolve(__dirname, "../public/texts");
const textsLus = new Map();
function readText(rel) {
  if (!textsLus.has(rel)) textsLus.set(rel, JSON.parse(readFileSync(resolve(TEXTS, rel), "utf8")));
  return textsLus.get(rel);
}

/**
 * Un psaume, entier ou entre deux versets (numérotés depuis 1), tiré du
 * fichier des Tehilim que l'application sert (public/texts/tehilim.json) :
 * l'export du siddour ne porte ni ceux que les jeûnes ajoutent à Min'ha
 * (20, 22, 124, 126) ni le « Chir lama'alot » qui ferme leurs sli'hot.
 */
const TEHILIM = readText("tehilim.json");
function psaume(n, from = 1, to = Infinity) {
  const versets = TEHILIM[String(n)].he.slice(from - 1, to);
  return cleanFinal(versets.join(" ").replace(/\{[פס]\}/g, " "));
}

/**
 * Des versets d'un livre du Tanakh que l'application sert, chapitre et
 * versets numérotés depuis 1 : les haftarot de Min'ha des jeûnes. `livre`
 * est le numéro du livre dans le catalogue (public/texts/tanakh) ; les Trei
 * 'Assar y sont un seul livre, dont les chapitres se suivent de Hochéa à
 * Malakhi.
 */
function versets(livre, chapitre, from, to) {
  const texte = readText(`tanakh/${livre}.json`).he[chapitre - 1].slice(from - 1, to);
  if (texte.length !== to - from + 1) {
    throw new Error(`Versets manquants : livre ${livre}, ${chapitre}, ${from} à ${to}`);
  }
  return cleanFinal(texte.join(" ").replace(/\{[פס]\}/g, " "));
}

/**
 * « Vessamou et chemi », Bamidbar 6, 27 : le dernier verset de Birkat
 * kohanim. Le premier jour de 'Hanouka, l'usage séfarade commence la lecture
 * à Birkat kohanim (6, 22), et la source du siddour saute ce verset pour
 * passer directement à 7, 1. Il vient du fichier de la paracha Nasso que
 * l'application sert (public/texts/tanakh/298.json).
 */
const VESSAMOU = (() => {
  const nasso = readText("tanakh/298.json").he.flat();
  const i = nasso.findIndex((v) => stripMarks(v).startsWith("ושמו את־שמי"));
  if (i < 1 || !stripMarks(nasso[i - 1]).includes("וישם לך שלום")) {
    throw new Error("Nasso : Bamidbar 6, 27 introuvable après Birkat kohanim");
  }
  return cleanFinal(nasso[i].replace(/\{[פס]\}/g, " "));
})();

/**
 * Les trois montées du premier jour de 'Hanouka, telles que la source les
 * donne dans sa consigne : le Cohen jusqu'à « lifné hamichkan » (7, 3), le
 * Lévi jusqu'à « la'hanoukat hamizbéa'h » (7, 11), Israël jusqu'à
 * « Na'hchon ben 'Aminadav » (7, 17). La source les marque d'un <small> au
 * milieu du texte, que la lecture en mode « full » laissait passer comme un
 * mot ordinaire ; ici, chacune reçoit sa didascalie.
 */
const HANOUKA_1_LEVI = "ויאמר יהוה אל־משה לאמר";
const HANOUKA_1_ISRAEL = "ויהי המקריב ביום הראשון";

/**
 * Les trois montées de Pourim, « Vayavo 'Amalek » (Chemot 17, 8 à 16) : 8 à
 * 10, 11 à 13, 14 à 16. Même raison que pour 'Hanouka : la source les marque
 * en ligne, et porte même une référence (« (שמות יז ח) ») au milieu du
 * premier verset, que le mode « full » affichait.
 */
const POURIM_MONTEES = [
  { fr: "Cohen", en: "Kohen", he: "כהן", until: "והיה כאשר ירים" },
  { fr: "Lévi", en: "Levi", he: "לוי", from: "והיה כאשר ירים", until: "ויאמר יהוה אל־משה כתב" },
  { fr: "Israël", en: "Yisrael", he: "ישראל", from: "ויאמר יהוה אל־משה כתב" },
];

/**
 * Les korbanot d'un jour de Souccot (Bamidbar 29, 17 à 34), trois versets par
 * jour, du deuxième au septième : la lecture de la Torah de 'Hol haMoed.
 * L'export du siddour ne les porte pas ; ils viennent du fichier de la
 * paracha Pin'has (public/texts/tanakh/304.json, découpé en montées : la
 * septième ouvre au 29, 12, et le passage du deuxième jour est son sixième
 * verset). Chaque passage ouvre sur « וּבַיּוֹם » et le nom du jour : la
 * construction s'arrête si le découpage du fichier a bougé.
 */
const PINHAS = readText("tanakh/304.json");
const JOURS_SOUCCOT = ["", "", "השני", "השלישי", "הרביעי", "החמישי", "הששי", "השביעי"];
function korbanotSouccot(jour) {
  const debut = 5 + (jour - 2) * 3;
  const passage = PINHAS.he[6].slice(debut, debut + 3);
  const tete = stripMarks(passage[0] ?? "").replace(/\s+/g, " ");
  if (passage.length !== 3 || !tete.startsWith(`וביום ${JOURS_SOUCCOT[jour]} `)) {
    throw new Error(`Pin'has : le passage du jour ${jour} de Souccot a bougé`);
  }
  return cleanFinal(passage.join(" ").replace(/\{[פס]\}/g, " "));
}

// ---------- Recette → fichier ----------

/**
 * Le texte d'une ligne ou d'un fragment : un segment de la source (`seg`,
 * dans le `mode` de segText) ou de l'hébreu écrit ici (`he`), débarrassé des
 * consignes restées dans le texte (`strip`) et découpé entre deux repères
 * (`from`/`until`, voir sliceBetween).
 */
function lineText(spec, segs) {
  let text;
  if (spec.he !== undefined) {
    text = cleanFinal(spec.he);
  } else {
    text = segText(segs[spec.seg], spec.mode);
  }
  for (const cut of spec.strip ?? []) {
    text = text.split(cut).join(" ");
  }
  if (spec.from || spec.until) text = sliceBetween(text, spec);
  return text.replace(/\s+/g, " ").trim();
}

/**
 * La condition d'un bloc, d'une ligne, d'un fragment ou d'une halakha :
 * `when` le jour où il se dit, `unless` le jour qui le retire.
 *
 * Les deux disent la même chose à l'envers, mais ne s'échangent pas : le site
 * sert ces fichiers à des versions de l'application plus anciennes que lui
 * (l'app native télécharge les textes, son code reste celui de sa version, et
 * une version installée peut rester des mois en arrière). Une version
 * ancienne masque tout `when` qu'elle ne sait pas lire, clé qu'elle ne connaît
 * pas ou syntaxe qu'elle n'a pas ; le passage disparaît alors au milieu d'une
 * prière, sans rien dire. Un champ qu'elle ne connaît pas, en revanche, elle
 * l'ignore, et affiche le passage.
 *
 * D'où la règle, qui vaut pour tout ce que ce fichier écrit (voir
 * docs/compatibilite-textes.md) :
 *
 *  - `when` ne porte qu'une clé simple, sans `!` ni `|`, et une clé qu'une
 *    version publiée connaît déjà, sauf à conditionner un passage que ces
 *    versions n'ont jamais eu ;
 *  - tout ce qui affine un passage déjà servi, l'exception comme la négation,
 *    passe par `unless` ;
 *  - une alternative (« l'un ou l'autre jour ») s'écrit en deux passages, un
 *    par clé, puisque les deux jours s'excluent.
 *
 * Un test le vérifie (src/__tests__/sidourCompatibilite.test.ts).
 */
function condition(spec) {
  return {
    ...(spec.when ? { when: spec.when } : {}),
    ...(spec.unless ? { unless: spec.unless } : {}),
  };
}

/**
 * Un fragment d'une ligne à fragments (`parts`) : le texte se prend comme
 * pour une ligne, et sa condition le réserve à son jour (`when`, « teshuva »)
 * ou le lui retire (`unless`, « teshuva » pour la conclusion ordinaire, voir
 * saidOn dans textService et CONDITIONS plus haut). C'est ainsi qu'un ajout
 * du calendrier entre dans le paragraphe à sa place, et qu'une conclusion
 * cède la sienne à l'autre le jour dit, au lieu d'un second paragraphe sous
 * le premier. `accent` marque ce que le jour ajoute ou change, que le lecteur
 * lit à la couleur du thème ; sans accent, un fragment conditionnel est une
 * variante ordinaire (morid hatal, l'autre conclusion). `rubric` glisse une
 * didascalie devant le fragment.
 */
function partRuns(spec, segs) {
  // Un fragment qui n'est qu'une didascalie : rien à prendre à la source.
  if (spec.rubric && spec.he === undefined && spec.seg === undefined) {
    return [{ r: spec.rubric, ...condition(spec) }];
  }
  const text = lineText(spec, segs);
  if (!text) throw new Error(`Fragment vide : ${JSON.stringify(spec)}`);
  const cond = condition(spec);
  const conditionnel = spec.when || spec.unless;
  const runs = [];
  if (spec.rubric) runs.push({ r: spec.rubric, ...cond });
  if (spec.accent) runs.push({ v: text, ...cond });
  else if (spec.strong) runs.push({ b: text, ...cond });
  else if (conditionnel) runs.push({ he: text, ...cond });
  else runs.push(text);
  return runs;
}

/**
 * La didascalie que seules les versions publiées lisent.
 *
 * Quand une conclusion en remplace une autre le jour dit (« Hamélekh
 * hakadoch » aux dix jours de techouva), le lecteur à jour retire l'ordinaire
 * par `unless` et ne montre que celle du jour. Une version publiée, elle,
 * ignore `unless` : elle affiche les deux, l'une derrière l'autre, sans rien
 * entre elles. Et aucune clé ne peut lui faire cacher l'ordinaire, son
 * calendrier ne sait pas nommer « hors des dix jours » (voir
 * docs/compatibilite-textes.md).
 *
 * Cette didascalie lui rend alors la présentation du sidour imprimé, qui
 * écrit les deux conclusions et met la règle entre : « aux dix jours de
 * techouva, on conclut : ». Sa condition se contredit exprès, `when` et
 * `unless` sur la même clé : elle ne tient que pour un lecteur qui ignore
 * `unless`, donc pour ces versions-là et pour elles seules. Elle s'enlèvera
 * quand la flotte aura rattrapé.
 */
function didascalieDeRemplacement(when, rubric) {
  return { rubric, when, unless: when };
}

/**
 * Une ligne de recette :
 *   { seg, mode?, strip?: [..], from?, until?, he?: "littéral", rubric?,
 *     when?, muted?, tight?, lead?, repeat?, strong?, alt?: { rubric, text },
 *     parts?: [fragment, ...] }
 * `answer` fait suivre la ligne de la réponse de l'assemblée, en gras (amen,
 * ken yehi ratson) ; `strip` retire des consignes restées dans le texte
 * extrait ; `from`/`until`
 * découpent le segment entre deux repères (voir sliceBetween) ; `when` ne dit
 * la ligne qu'à cette occasion ; `alt` ajoute dans le fil une didascalie
 * suivie du texte qu'elle affecte, à la fin de la ligne ou, si `alt.after` le
 * demande, juste après le mot qu'elle remplace ; `parts` compose la ligne de
 * plusieurs fragments, chacun avec sa condition (voir partRuns) ;
 * `splitAmen` déplie un kaddich en une phrase par ligne, chacune suivie de sa
 * réponse (voir buildKaddishLines) ; `splitBr` déplie une liste que la source
 * tient en un segment, une ligne par <br> (voir buildBrLines) ;
 * `klaf` (« ketoret », « menora ») marque
 * le paragraphe d'où le lecteur ouvre le parchemin correspondant (voir
 * KlafViewer.vue) : le pitoum haketoret tel qu'un sofer l'écrit, le psaume 67
 * en forme de menora.
 */
function buildLine(spec, segs) {
  const line = {};
  if (spec.rubric) line.rubric = spec.rubric;
  if (spec.parts) {
    line.he = spec.parts.flatMap((part) => partRuns(part, segs));
    if (spec.when) line.when = spec.when;
    if (spec.unless) line.unless = spec.unless;
    if (spec.muted) line.muted = true;
    if (spec.tight) line.tight = true;
    if (spec.lead) line.lead = true;
    if (spec.klaf) line.klaf = spec.klaf;
    return line;
  }
  const text = lineText(spec, segs);
  if (!text) return null;
  if (spec.strong) line.he = [{ b: text }];
  else if (spec.answer) line.he = [text, { b: spec.answer }];
  else if (spec.alt) {
    const when = condition(spec.alt);
    const [debut, suite] = spec.alt.after ? splitAfter(text, spec.alt.after) : [text, ""];
    line.he = [debut, { r: spec.alt.rubric, ...when }, { v: spec.alt.text, ...when }];
    if (suite) line.he.push(suite);
  } else line.he = text;
  if (spec.repeat) line.repeat = spec.repeat;
  if (spec.when) line.when = spec.when;
  if (spec.unless) line.unless = spec.unless;
  if (spec.muted) line.muted = true;
  if (spec.tight) line.tight = true;
  if (spec.lead) line.lead = true;
  if (spec.klaf) line.klaf = spec.klaf;
  // Sans autre attribut, une simple chaîne suffit au format.
  const keys = Object.keys(line);
  if (keys.length === 1 && typeof line.he === "string") return line.he;
  return line;
}

/**
 * Un kaddich, une phrase par ligne : la source borne chaque réponse de
 * l'assemblée d'un [אָמֵן] imbriqué dans un <small>. On découpe le segment sur
 * ces marqueurs, et chaque phrase s'achève sur sa réponse (אָמֵן) en gras,
 * comme une reprise de l'assemblée.
 */
function buildKaddishLines(spec, segs) {
  return outerSmalls(segs[spec.seg])
    .join(" ")
    .split(/<small>\s*\[[^\]]+\]\s*<\/small>/)
    .map((part) => {
      let text = cleanFinal(dropSmalls(part));
      for (const cut of spec.strip ?? []) text = text.split(cut).join(" ");
      return text.replace(/\s+/g, " ").trim();
    })
    .filter((text) => text.length > 0)
    .map((text, i) => {
      const line = { he: [text, { b: "(אָמֵן)" }] };
      if (i === 0 && spec.rubric) line.rubric = spec.rubric;
      if (i > 0 || spec.tight) line.tight = true;
      return line;
    });
}

/**
 * Une liste que la source donne en un seul segment, une ligne par <br> : les
 * aveux du 'Al het, les fautes du 'Al hataïm. On rend un paragraphe par ligne,
 * serrés les uns sous les autres (`tight`), comme le sidour les imprime ;
 * sinon, les cinquante aveux du vidouy s'étirent sur autant d'écrans. La
 * didascalie, s'il y en a une, ouvre la première.
 *
 * La condition, elle, se porte sur le bloc : une liste ne se dit pas à
 * moitié, et ses lignes n'en portent aucune. `muted` les passe toutes au
 * second plan, quand c'est la liste entière que l'on ne dit pas partout.
 */
function buildBrLines(spec, segs) {
  const lignes = String(segs[spec.seg] ?? "")
    .split(/<br\s*\/?>/)
    .map((part) => cleanFinal(dropSmalls(part)))
    .filter((text) => text.length > 0);
  if (lignes.length < 2) throw new Error(`Liste d'une seule ligne : segment ${spec.seg}`);
  return lignes.map((text, i) => {
    const line = { he: text };
    if (i === 0 && spec.rubric) line.rubric = spec.rubric;
    if (i > 0 || spec.tight) line.tight = true;
    if (spec.muted) line.muted = true;
    // Sans autre attribut, une simple chaîne suffit au format.
    return Object.keys(line).length === 1 ? text : line;
  });
}

function buildBlock(spec, sections) {
  const block = {};
  if (spec.labelText) {
    block.label = spec.labelText.fr;
    block.labelText = spec.labelText;
  }
  if (spec.when) block.when = spec.when;
  if (spec.unless) block.unless = spec.unless;
  if (spec.plain) block.plain = true;
  if (spec.fold) block.fold = spec.fold;
  // Une halakha, ou plusieurs : chacune avec son `when` (voir Halakha dans
  // textService), pour que la règle de Hamélekh hakadoch n'apparaisse
  // qu'aux dix jours de techouva.
  if (spec.halakha) block.halakha = spec.halakha;
  if (spec.zman) block.zman = spec.zman;
  if (spec.torahWeekly) block.torahWeekly = true;
  if (spec.kotel) block.kotel = true;
  if (spec.naanouim) block.naanouim = true;
  if (spec.mirror) block.mirror = true;
  if (spec.numbered) block.numbered = true;
  // L'une des options d'un choix laissé au lecteur (voir TextChoice dans
  // textService) : la clé du choix, l'identifiant de l'option, son intitulé.
  if (spec.choice) block.choice = spec.choice;
  const segs = spec.src ? sections[spec.src] : [];
  if (spec.src && !segs) throw new Error(`Section source inconnue : ${spec.src}`);
  block.lines = (spec.lines ?? [])
    .flatMap((line) => {
      if (line.splitAmen) return buildKaddishLines(line, segs ?? []);
      if (line.splitBr) return buildBrLines(line, segs ?? []);
      return [buildLine(line, segs ?? [])];
    })
    .filter((line) => line !== null);
  // Une option de choix peut être vide : « pas de haftara » est un choix.
  if (!block.zman && !block.torahWeekly && !block.choice && block.lines.length === 0) {
    throw new Error(`Bloc vide : ${spec.labelText?.fr ?? spec.when ?? "?"}`);
  }
  return block;
}

// ---------- Didascalies et halakhot partagées ----------

const R = (fr, en, he) => ({ fr, en, he });

/**
 * Ce que disent les femmes, là où le texte se décline. La source le donne
 * déjà, dans ses <small> : le mot au féminin, à la suite du masculin. On le
 * reprend tel quel plutôt que de redonner la phrase entière.
 */
const FEMMES = R("(les femmes disent)", "(women say)", "(האשה אומרת)");

const RUBRIC = {
  hazan: R("Le 'hazan dit :", "The chazan says:", "ואומר החזן:"),
  kahal: R("L'assemblée répond :", "The congregation answers:", "ועונים הקהל:"),
  hazanReprend: R("Le 'hazan reprend :", "The chazan repeats:", "וחוזר החזן:"),
  bassevoix: R("À voix basse :", "In an undertone:", "בלחש:"),
  hautevoix: R("À voix haute :", "Aloud:", "בקול רם:"),
  assis: R("Assis, on dit :", "Seated, say:", "ישב ויאמר:"),
  debout: R("Debout, on dit :", "Standing, say:", "עומדים ואומרים:"),
  certains: R("Certains ajoutent :", "Some add:", "יש נוהגים לומר:"),
  repetition: R(
    "Pendant la répétition du 'hazan, l'assemblée dit :",
    "During the chazan's repetition, the congregation says:",
    "בחזרת הש״ץ אומרים:",
  ),
  teshuvaOn: R(
    "Pendant les dix jours de techouva, on ajoute :",
    "During the Ten Days of Repentance, add:",
    "בעשרת ימי תשובה מוסיפים:",
  ),
};

const STRIP = {
  teshuvaDisent: "בעשרת ימי תשובה אומרים:",
  bassevoix: "בלחש:",
};

// Les trois offices partagent la même 'Amida : la recette de ses blocs est
// écrite une fois, avec la table des index propres à chaque office.
const HALAKHA = {
  amida: R(
    "La 'Amida se dit debout, pieds joints, face à Jérusalem, à voix basse et sans interruption.",
    "The Amidah is said standing, feet together, facing Jerusalem, in an undertone and without interruption.",
    "העמידה נאמרת בעמידה, ברגליים צמודות, לכיוון ירושלים, בלחש וללא הפסקה.",
  ),
  eteMention: R(
    "Si l'on a dit machiv haroua'h oumorid haguéchem, on reprend au début de la bénédiction ; si la 'Amida est achevée, on la recommence.",
    "If mashiv haruach umorid hageshem was said, go back to the start of the blessing; if the Amidah was finished, repeat it.",
    "אמר משיב הרוח ומוריד הגשם, חוזר לראש הברכה؛ סיים את העמידה, חוזר לראשה.",
  ),
  hiverMention: R(
    "Si l'on a oublié machiv haroua'h mais dit morid hatal, on ne recommence pas.",
    "If mashiv haruach was omitted but morid hatal was said, do not repeat.",
    "שכח משיב הרוח ואמר מוריד הטל, אינו חוזר.",
  ),
  eteDemande: R(
    "Si l'on a demandé la pluie (barekh 'alénou), on reprend au début de la bénédiction ; si la 'Amida est achevée, on la recommence.",
    "If rain was requested (barech aleinu), go back to the start of the blessing; if the Amidah was finished, repeat it.",
    "שאל גשם (ברך עלינו), חוזר לראש הברכה؛ סיים את העמידה, חוזר לראשה.",
  ),
  hiverDemande: R(
    "Si l'on a oublié la demande de pluie, on la rattrape dans Choméa' tefila. Passé cela, on reprend à Barekh 'alénou, et si la 'Amida est achevée, on la recommence.",
    "If the request for rain was omitted, insert it in Shomea tefillah. Past that, go back to Barech aleinu; if the Amidah was finished, repeat it.",
    "שכח שאלת גשם, אומרה בשומע תפילה؛ עבר, חוזר לברך עלינו, ואם סיים את העמידה חוזר לראשה.",
  ),
  melekhKadosh: R(
    "Dix jours de techouva : on conclut « Hamélekh hakadoch ». Si l'on a conclu haEl hakadoch, on recommence la 'Amida.",
    "Ten Days of Repentance: conclude with “Hamelech hakadosh”. If haEl hakadosh was said, repeat the Amidah.",
    "בעשרת ימי תשובה חותמים « המלך הקדוש ». חתם האל הקדוש, חוזר לראש העמידה.",
  ),
  melekhMishpat: R(
    "Dix jours de techouva : on conclut « Hamélekh hamichpat ». Si l'on a conclu Mélekh ohev tsedaka oumichpat, on ne recommence pas.",
    "Ten Days of Repentance: conclude with “Hamelech hamishpat”. If Melech ohev tzedakah umishpat was said, do not repeat.",
    "בעשרת ימי תשובה חותמים « המלך המשפט ». חתם מלך אוהב צדקה ומשפט, אינו חוזר.",
  ),
  /** Les quatre ajouts des dix jours qui ne font pas recommencer. */
  oubliTeshuva: (fr, en, he) =>
    R(
      `Dix jours de techouva : si l'on a oublié ${fr}, on ne recommence pas.`,
      `Ten Days of Repentance: if ${en} was omitted, do not repeat.`,
      `בעשרת ימי תשובה: שכח ${he}, אינו חוזר.`,
    ),
  nahem: R(
    "À Min'ha de Tich'a beAv, Na'hem entre dans la bénédiction de Jérusalem, dont la conclusion change. Si on l'a oublié, on ne recommence pas.",
    "At Mincha on Tisha b'Av, Nachem enters the blessing of Jerusalem, whose conclusion changes. If it was omitted, do not repeat.",
    "במנחה של תשעה באב אומרים נחם בברכת ירושלים, וחתימתה משתנה. שכח, אינו חוזר.",
  ),
  anenou: R(
    "Un jour de jeûne, qui jeûne dit 'Anénou dans Chéma kolénou, sans conclusion. Si on l'a oublié, on ne recommence pas.",
    "On a fast day, whoever is fasting says Anenu within Shema kolenu, without a closing blessing. If it was omitted, do not repeat.",
    "בתענית, המתענה אומר עננו בשמע קולנו בלי חתימה. שכח, אינו חוזר.",
  ),
  yaaleVeyavoJour: R(
    "À Roch Hodech et à 'Hol haMoed, Ya'alé véyavo entre dans Retsé. Si on l'a oublié, on recommence depuis Retsé ; si la 'Amida est achevée, on la recommence.",
    "On Rosh Hodesh and Chol haMoed, Yaale veyavo enters Retseh. If it was omitted, go back to Retseh; if the Amidah was finished, repeat it.",
    "בראש חודש ובחול המועד אומרים יעלה ויבוא ברצה. שכח, חוזר לרצה؛ סיים את העמידה, חוזר לראשה.",
  ),
  yaaleVeyavoSoir: R(
    "À Roch Hodech, Ya'alé véyavo entre dans Retsé. Si on l'a oublié à Arvit, on ne recommence pas.",
    "On Rosh Hodesh, Yaale veyavo enters Retseh. If it was omitted at Arvit, do not repeat.",
    "בראש חודש אומרים יעלה ויבוא ברצה. שכח בערבית, אינו חוזר.",
  ),
  alHanissim: R(
    "À 'Hanouka et à Pourim, 'Al hanissim entre dans Modim. Si on l'a oublié, on ne recommence pas.",
    "On Hanukkah and Purim, Al hanissim enters Modim. If it was omitted, do not repeat.",
    "בחנוכה ובפורים אומרים על הניסים במודים. שכח, אינו חוזר.",
  ),
  ataHonantanu: R(
    "À la sortie de Chabbat et de Yom Tov, Ata 'honantanou entre dans 'Honen hadaat. Si on l'a oublié, on ne recommence pas : la havdala sur la coupe en tient lieu.",
    "At the close of Shabbat and Yom Tov, Atah chonantanu enters Chonen hadaat. If it was omitted, do not repeat: havdalah over the cup takes its place.",
    "במוצאי שבת ויום טוב אומרים אתה חוננתנו בחונן הדעת. שכח, אינו חוזר؛ סומך על ההבדלה שעל הכוס.",
  ),
  shemaMatin: R(
    "Avant le Chéma, on a en tête d'accomplir la mitsva de le lire et de proclamer l'unité du Nom. On couvre les yeux de la main droite pour le premier verset, qu'on dit avec concentration.",
    "Before the Shema, intend to fulfill the mitzvah of reading it and of proclaiming God's oneness. Cover your eyes with the right hand for the first verse, said with full concentration.",
    "קודם קריאת שמע יכוין לקיים מצוות הקריאה וליחד את השם. יכסה עיניו ביד ימין בפסוק הראשון, ויאמרנו בכוונה.",
  ),
  pessoukeDezimra: R(
    "De Baroukh chéamar à Yichtaba'h, on ne s'interrompt pas pour parler.",
    "From Baruch sheamar to Yishtabach, do not interrupt to speak.",
    "מברוך שאמר עד ישתבח אין מפסיקים בדיבור.",
  ),
  birkotHashahar: R(
    "Les bénédictions du matin, même si l'on n'en a pas eu l'occasion sur le moment, se rattrapent toute la matinée.",
    "The morning blessings, even past their moment, may be made up all morning.",
    "ברכות השחר, אפשר להשלימן כל שעות הבוקר.",
  ),
  tahanoun: R(
    "On ne le dit pas dans une maison de deuil, un jour de brit-mila, en présence d'un marié, ni les jours où l'usage de la communauté s'en dispense.",
    "It is not said in a house of mourning, on the day of a brit mila, in the presence of a groom, or on days when the community's custom omits it.",
    "אין אומרים אותו בבית אבל, ביום ברית מילה, במעמד חתן, ובימים שמנהג הקהילה לדלגו.",
  ),
  torahSemaine: R(
    "On lit dans la Torah le début de la paracha de la semaine, en trois montées.",
    "The beginning of the week's parasha is read from the Torah, in three aliyot.",
    "קוראים בתורה את תחילת פרשת השבוע, בשלושה עולים.",
  ),
  vayehal: R(
    "Un jour de jeûne public, on lit « Vaye'hal Moché » (Chemot 32, 11 à 14, puis 34, 1 à 10), en trois montées, le matin comme à Min'ha.",
    "On a public fast, “Vayechal Moshe” (Exodus 32:11-14, then 34:1-10) is read in three aliyot, in the morning and at Mincha.",
    "בתענית ציבור קוראים « ויחל משה » (שמות לב, יא-יד; לד, א-י) בשלושה עולים, בשחרית ובמנחה.",
  ),
  hallel: R(
    "Le Hallel se dit debout. Selon l'usage séfarade, l'individuel le dit sans bénédiction.",
    "Hallel is said standing. By Sephardic custom, an individual says it without a blessing.",
    "אומרים הלל מעומד. למנהג הספרדים היחיד אומרו בלא ברכה.",
  ),
};

// ---------- 'Amida commune ----------

/**
 * Birkat kohanim dans la répétition, juste avant Sim chalom : les cohanim
 * montent bénir l'assemblée, verset après verset, et l'on répond amen. S'il
 * n'y a pas de cohanim, le 'hazan dit à leur place « Élohénou vélohé
 * avoténou », et l'on répond « ken yehi ratson ».
 *
 * `ix` : la bénédiction des cohanim (`bracha`), les trois versets qu'ils
 * disent (`versets` : trois segments à Cha'harit, un seul à Min'ha, d'où le
 * repère qui ouvre chacun), la formule du 'hazan (`hazan`) et ses trois
 * versets (`versetsHazan`). `extra` porte ce qui distingue un office :
 * Min'ha n'a de birkat kohanim qu'un jour de jeûne.
 */
function birkatKohanimBlock(src, ix, extra = {}) {
  const OUVERTURES = ["יְבָרֶכְךָ", "יָאֵר", "יִשָּׂא"];
  return {
    src,
    fold: "hazan",
    labelText: R("Birkat kohanim", "Birkat kohanim", "ברכת כהנים"),
    ...extra,
    lines: [
      {
        seg: ix.bracha,
        mode: "small",
        strip: ["הקהל עונים"],
        from: "בָּרוּךְ אַתָּה",
        until: "אָמֵן",
        answer: "(אָמֵן)",
        rubric: R(
          "S'il y a plus d'un cohen, le 'hazan les appelle : « Cohanim ». Les cohanim bénissent :",
          "If there is more than one kohen, the chazan calls them: “Kohanim.” The kohanim bless:",
          "אם יש יותר מכהן אחד קורא להם החזן: כהנים. והכהנים מברכים:",
        ),
      },
      ...OUVERTURES.map((ouverture, i) => ({
        seg: ix.versets[i],
        mode: "small",
        from: ouverture,
        until: "אָמֵן",
        answer: "(אָמֵן)",
        tight: i > 0,
        rubric:
          i === 0
            ? R(
                "Le 'hazan dit, et les cohanim le reprennent mot à mot :",
                "The chazan says it, and the kohanim repeat word for word:",
                "ואומר החזן והכהנים אחריו מילה במילה:",
              )
            : undefined,
      })),
      {
        seg: ix.hazan,
        mode: "small",
        rubric: R(
          "S'il n'y a pas de cohanim, le 'hazan dit :",
          "If there are no kohanim, the chazan says:",
          "אם אין כהנים אומר החזן:",
        ),
      },
      ...OUVERTURES.map((ouverture, i) => ({
        seg: ix.versetsHazan[i],
        mode: "small",
        from: ouverture,
        until: "כֵּן יְהִי רָצוֹן",
        answer: "(כֵּן יְהִי רָצוֹן)",
        tight: true,
      })),
      { seg: ix.versetsHazan[2], mode: "small", from: "וְשָׂמוּ", tight: true },
    ],
  };
}

/**
 * Les blocs de la 'Amida d'un office. `ix` : index des segments dans la
 * source de cet office ; `opts` : ce qui n'existe pas partout (kedoucha,
 * modim derabanan, Ata 'honantanou à la sortie de Chabbat…).
 *
 * Ce que le jour ajoute ou change entre dans le paragraphe à sa place, comme
 * dans un siddour imprimé : Zokhrénou au milieu d'Avot, Hamélekh hakadoch à
 * la place de haEl hakadoch, Ya'alé véyavo avec la fête du jour et elle
 * seule. Le lecteur ne montre que ce qui se dit ce jour-là, à la couleur du
 * thème, et la halakha de l'oubli n'accompagne le passage que les jours où
 * elle sert.
 */
function amidaBlocks(src, ix, opts = {}) {
  const blocks = [];

  // Avot. Aux dix jours de techouva, Zokhrénou entre avant « Mélekh 'ozer ».
  blocks.push({
    src,
    labelText: R("'Amida", "The Amidah", "עמידה"),
    kotel: true,
    halakha: [
      HALAKHA.amida,
      { ...HALAKHA.oubliTeshuva("Zokhrénou", "Zochrenu", "זכרנו"), when: "teshuva" },
    ],
    lines: [
      { seg: 1 },
      {
        parts: [
          { seg: ix.avot, strip: [STRIP.teshuvaDisent], until: "מֶֽלֶךְ עוֹזֵר" },
          {
            seg: ix.avot,
            mode: "small",
            strip: [STRIP.teshuvaDisent],
            when: "teshuva",
            accent: true,
          },
          { seg: ix.avot, strip: [STRIP.teshuvaDisent], from: "מֶֽלֶךְ עוֹזֵר" },
        ],
      },
    ],
  });

  // Guevourot, d'un seul tenant : la mention de la saison (morid hatal en
  // été, machiv haroua'h en hiver) à sa place après « rav lehochia' », et aux
  // dix jours de techouva Mi kamokha av hara'haman avant « vénééman ».
  blocks.push({
    src,
    halakha: [
      { ...HALAKHA.eteMention, when: "ete" },
      { ...HALAKHA.hiverMention, when: "hiver" },
      { ...HALAKHA.oubliTeshuva("Mi kamokha", "Mi chamocha", "מי כמוך"), when: "teshuva" },
    ],
    lines: [
      {
        parts: [
          { seg: ix.gevurot },
          { he: "מוֹרִיד הַטָּל.", when: "ete" },
          { he: "מַשִּׁיב הָרֽוּחַ וּמוֹרִיד הַגֶּֽשֶׁם.", when: "hiver" },
          { seg: ix.mekhalkel, strip: [STRIP.teshuvaDisent], until: "וְנֶֽאֱמָן" },
          {
            seg: ix.mekhalkel,
            mode: "small",
            strip: [STRIP.teshuvaDisent],
            when: "teshuva",
            accent: true,
          },
          { seg: ix.mekhalkel, strip: [STRIP.teshuvaDisent], from: "וְנֶֽאֱמָן" },
        ],
      },
    ],
  });

  // La kedoucha ne se dit qu'avec la répétition du 'hazan : elle reste là,
  // dans un encadré replié, sans couper le fil de qui prie seul.
  if (ix.kedushaText !== undefined) {
    blocks.push({
      src,
      labelText: R("Kedoucha", "Kedushah", "קדושה"),
      fold: "hazan",
      lines: [{ seg: ix.kedushaText, mode: "small", rubric: RUBRIC.repetition }],
    });
  }

  // Ata kadoch : la conclusion change aux dix jours de techouva, et c'est la
  // seule dont l'oubli fait recommencer la 'Amida.
  blocks.push({
    src,
    halakha: [{ ...HALAKHA.melekhKadosh, when: "teshuva" }],
    lines: [
      {
        parts: [
          {
            seg: ix.ataKadosh,
            strip: [STRIP.teshuvaDisent, "הַמֶּלֶךְ הַקָּדוֹשׁ:"],
            until: "הָאֵל הַקָּדוֹשׁ",
          },
          { he: "הָאֵל הַקָּדוֹשׁ:", unless: "teshuva" },
          didascalieDeRemplacement(
            "teshuva",
            R(
              "Aux dix jours de techouva, on conclut\u00a0:",
              "During the Ten Days of Repentance, conclude:",
              "בעשרת ימי תשובה חותמים:",
            ),
          ),
          { he: "הַמֶּלֶךְ הַקָּדוֹשׁ:", when: "teshuva", accent: true },
        ],
      },
    ],
  });

  // Bénédictions intermédiaires. À Arvit, la sortie de Chabbat et de Yom Tov
  // glisse Ata 'honantanou dans 'Honen hadaat, avant « vé'honénou ».
  //
  // Deux fois le même fragment, sous deux clés qui ne se recouvrent jamais :
  // la sortie de Chabbat, de très loin le cas courant, se nomme par le jour
  // de la semaine, que les versions publiées connaissent ; la sortie de Yom
  // Tov, qui tombe n'importe quel autre soir, par « motsae-yom-tov », une clé
  // que seules les versions qui la posent affichent. Surtout pas « motsae »,
  // qui couvre aussi le dimanche : les versions v3.10.1 et v3.10.2 le
  // connaissent sans connaître `unless`, et diraient Ata 'honantanou deux
  // fois le samedi soir. Le dimanche hébraïque peut être Yom Tov lui-même (le
  // 16 Tichri, le 16 Nissan) : ce soir-là on ne sépare rien, d'où l'exception.
  if (ix.ataHonantanu !== undefined) {
    blocks.push({
      src,
      halakha: [
        { ...HALAKHA.ataHonantanu, when: "jour-0", unless: "yom-tov" },
        { ...HALAKHA.ataHonantanu, when: "motsae-yom-tov" },
      ],
      lines: [
        {
          parts: [
            { seg: ix.honen },
            {
              seg: ix.ataHonantanu,
              mode: "small",
              when: "jour-0",
              unless: "yom-tov",
              accent: true,
            },
            { seg: ix.ataHonantanu, mode: "small", when: "motsae-yom-tov", accent: true },
            { seg: ix.vehonenu },
          ],
        },
      ],
    });
  } else {
    blocks.push({ src, lines: [{ seg: ix.honen }] });
  }
  blocks.push({
    src,
    lines: [{ seg: ix.hashivenu }, { seg: ix.selah }, { seg: ix.reeh }],
  });

  // 'Anénou du 'hazan : un jour de jeûne public, il en fait une bénédiction à
  // part, entre Goël Israël et Rofé. Repliée comme le reste de ce qui ne se
  // dit qu'à la répétition.
  if (ix.anenouHazan !== undefined) {
    blocks.push({
      src,
      when: "taanit",
      fold: "hazan",
      labelText: R("'Anénou (le 'hazan)", "Anenu (the chazan)", "עננו (החזן)"),
      lines: [
        {
          seg: ix.anenouHazan,
          mode: "small",
          rubric: R(
            "Un jour de jeûne public, le 'hazan dit à la répétition :",
            "On a public fast, the chazan says in the repetition:",
            "בתענית ציבור השליח ציבור אומר בחזרה:",
          ),
        },
        { seg: ix.anenouHazan + 1, mode: "small", tight: true },
      ],
    });
  }

  blocks.push({ src, lines: [{ seg: ix.refaenu }] });

  // La bénédiction des années, celle de la saison : Barkhénou (la rosée) en
  // été, Barekh 'alénou (la pluie) en hiver. Ce n'est pas un ajout mais le
  // texte ordinaire de la saison : dans le fil, à la couleur du texte, sauf
  // les premières semaines d'une bascule (voir recentSeasonalChanges).
  blocks.push({
    src,
    when: "barkhenou",
    plain: true,
    halakha: HALAKHA.eteDemande,
    lines: [{ seg: ix.barkhenu }],
  });
  blocks.push({
    src,
    when: "barekh-alenou",
    plain: true,
    halakha: HALAKHA.hiverDemande,
    lines: [{ seg: ix.barekhAlenu }],
  });

  blocks.push({ src, lines: [{ seg: ix.teka }] });
  // Hachiva : la conclusion change aux dix jours de techouva.
  blocks.push({
    src,
    halakha: [{ ...HALAKHA.melekhMishpat, when: "teshuva" }],
    lines: [
      {
        parts: [
          {
            seg: ix.hashiva,
            strip: [STRIP.teshuvaDisent, "הַמֶּלֶךְ הַמִּשְׁפָּט:"],
            until: "מֶֽלֶךְ אוֹהֵב",
          },
          { he: "מֶֽלֶךְ אוֹהֵב צְדָקָה וּמִשְׁפָּט:", unless: "teshuva" },
          didascalieDeRemplacement(
            "teshuva",
            R(
              "Aux dix jours de techouva, on conclut\u00a0:",
              "During the Ten Days of Repentance, conclude:",
              "בעשרת ימי תשובה חותמים:",
            ),
          ),
          { he: "הַמֶּלֶךְ הַמִּשְׁפָּט:", when: "teshuva", accent: true },
        ],
      },
    ],
  });

  blocks.push({ src, lines: [{ seg: ix.laminim }, { seg: ix.tsadikim }] });

  // La bénédiction de Jérusalem. À Min'ha de Tich'a beAv, Na'hem, la
  // consolation de Sion, entre entre son corps et sa conclusion, qui change
  // alors elle aussi (« ména'hem Tsion bevinyan Yerouchalayim »).
  if (ix.nahem !== undefined) {
    blocks.push({
      src,
      halakha: [{ ...HALAKHA.nahem, when: "tisha-beav" }],
      lines: [
        {
          parts: [
            { seg: ix.tishkon },
            {
              // Consigne et texte partagent le même <small> : on coupe au
              // premier mot de la prière.
              seg: ix.nahem,
              mode: "small",
              from: "נַחֵם יְהֹוָה",
              when: "tisha-beav",
              accent: true,
            },
            { seg: ix.tishkonHatima, unless: "tisha-beav" },
            didascalieDeRemplacement(
              "tisha-beav",
              R(
                "\u00c0 Min'ha de Tich'a beAv, on conclut\u00a0:",
                "At Mincha on Tisha b'Av, conclude:",
                "במנחה של תשעה באב חותמים:",
              ),
            ),
            { seg: ix.nahem + 1, mode: "small", when: "tisha-beav", accent: true },
          ],
        },
      ],
    });
  } else {
    blocks.push({ src, lines: [{ seg: ix.tishkon }] });
  }

  // Chéma kolénou. 'Anénou de chacun : celui qui jeûne le dit dedans, sans
  // conclusion, avant « Ki Ata chomé'a ».
  const shemaKolenu =
    ix.anenouYahid !== undefined
      ? {
          parts: [
            { seg: ix.shemaKolenu },
            {
              // Consigne et texte vivent dans le même <small> : on coupe au
              // premier mot de la prière plutôt que de tout perdre.
              seg: ix.anenouYahid,
              mode: "smallAll",
              from: "עֲנֵנוּ אָבִינוּ",
              when: "taanit",
              accent: true,
              rubric: R("(qui jeûne ajoute :)", "(whoever is fasting adds:)", "(המתענה מוסיף:)"),
            },
            { seg: ix.kiAta },
          ],
        }
      : { parts: [{ seg: ix.shemaKolenu }, { seg: ix.kiAta }] };
  blocks.push({
    src,
    halakha: ix.anenouYahid !== undefined ? [{ ...HALAKHA.anenou, when: "taanit" }] : undefined,
    lines: [{ seg: ix.tsemah }, shemaKolenu],
  });

  blocks.push({ src, lines: [{ seg: ix.retse }] });

  // Ya'alé véyavo : Roch Hodech et 'Hol haMoed, entre Retsé et « Véata
  // bera'hamekha ». Une seule fête nommée, celle du jour.
  blocks.push({
    src,
    when: "moed",
    halakha: opts.soir
      ? [
          { ...HALAKHA.yaaleVeyavoSoir, when: "rosh-chodesh" },
          { ...HALAKHA.yaaleVeyavoJour, unless: "rosh-chodesh" },
        ]
      : HALAKHA.yaaleVeyavoJour,
    lines: [
      {
        parts: [
          { seg: ix.yv, mode: "small" },
          { seg: ix.yvRH, mode: "small", strip: ["בראש חדש:"], when: "rosh-chodesh" },
          { seg: ix.yvPessah, mode: "small", strip: ["בחוה״מ פסח:"], when: "pesach" },
          { seg: ix.yvSouccot, mode: "small", strip: ["בחוה״מ סוכות:"], when: "sukkot" },
          { seg: ix.yvSuite, mode: "small" },
        ],
      },
    ],
  });

  blocks.push({
    src,
    lines: [
      { seg: ix.veata },
      {
        seg: ix.modim,
        rubric: R(
          "On s'incline à « Modim » et on se redresse au Nom :",
          "Bow at “Modim” and straighten at God's name:",
          "יכרע ב« מודים » ויזקוף בשם:",
        ),
      },
    ],
  });

  if (ix.modimDerabanan !== undefined) {
    blocks.push({
      src,
      labelText: R("Modim dérabanan", "Modim derabanan", "מודים דרבנן"),
      fold: "hazan",
      lines: [
        {
          seg: ix.modimDerabanan,
          mode: "small",
          // La consigne de la source, avec ses deux graphies de guillemet.
          strip: [
            "מודים דרבנן",
            'בחזרת הש"ץ כשהחזן אומר מודים, הקהל אומרים:',
            "בחזרת הש״ץ כשהחזן אומר מודים, הקהל אומרים:",
          ],
          rubric: R(
            "Pendant la répétition, quand le 'hazan dit Modim, l'assemblée dit :",
            "During the repetition, as the chazan says Modim, the congregation says:",
            "בחזרת הש״ץ, כשהחזן אומר מודים, הקהל אומרים:",
          ),
        },
      ],
    });
  }

  // 'Al hanissim, entre Modim et « Vé'al koulam » : le récit de 'Hanouka à
  // 'Hanouka, celui de Pourim à Pourim, jamais les deux.
  blocks.push({
    src,
    when: "nissim",
    halakha: HALAKHA.alHanissim,
    lines: [
      { seg: ix.alHanissim, mode: "small" },
      { seg: ix.hanouka, mode: "small", strip: ["בחנוכה אומרים:"], when: "hanouka", tight: true },
      { seg: ix.pourim, mode: "small", strip: ["בפורים אומרים"], when: "pourim", tight: true },
    ],
  });

  // Vé'al koulam. Aux dix jours de techouva, Oukhtov entre après « Vékhol
  // ha'hayim yodoukha sséla » et avant « Vihalelou », là où la source le
  // pose.
  blocks.push({
    src,
    halakha: [{ ...HALAKHA.oubliTeshuva("Oukhtov", "Uchtov", "וכתוב"), when: "teshuva" }],
    lines: [
      {
        parts: [
          { seg: ix.vealKoulam, strip: [STRIP.teshuvaDisent], until: "וִיהַלְלוּ" },
          {
            seg: ix.vealKoulam,
            mode: "small",
            strip: [STRIP.teshuvaDisent],
            when: "teshuva",
            accent: true,
          },
          { seg: ix.vealKoulam, strip: [STRIP.teshuvaDisent], from: "וִיהַלְלוּ" },
        ],
      },
    ],
  });
  // Birkat kohanim se dit dans la répétition, entre « Vé'al koulam » et Sim
  // chalom : les cohanim se tournent vers l'arche quand le 'hazan commence
  // Sim chalom, la bénédiction est donc finie quand il l'entame.
  if (opts.kohanim) blocks.push(opts.kohanim);
  // Sim chalom. Aux dix jours de techouva, Ouvséfer 'hayim avant la conclusion.
  blocks.push({
    src,
    halakha: [
      {
        ...HALAKHA.oubliTeshuva("Ouvséfer 'hayim", "Uvsefer chayim", "ובספר חיים"),
        when: "teshuva",
      },
    ],
    lines: [
      {
        parts: [
          { seg: ix.simShalom, strip: [STRIP.teshuvaDisent], until: "בָּרוּךְ אַתָּה" },
          {
            seg: ix.simShalom,
            mode: "small",
            strip: [STRIP.teshuvaDisent],
            when: "teshuva",
            accent: true,
          },
          { seg: ix.simShalom, strip: [STRIP.teshuvaDisent], from: "בָּרוּךְ אַתָּה" },
        ],
      },
    ],
  });

  // La fin de la 'Amida : « Yihyou lératson », Élohaï netsor, et le second
  // « Yihyou lératson ». La veille de Kippour, le vidouy s'ouvre entre les
  // deux (`opts.vidouy`, voir vidouyKippour) : la fin se dit alors en deux
  // blocs, lui au milieu, comme le mahzor l'imprime.
  const finAmida = [{ seg: ix.elohaiNetsor }, { seg: ix.lemaan }, { seg: ix.yihyu2, tight: true }];
  if (opts.vidouy) {
    blocks.push({ src, lines: [{ seg: ix.yihyu1 }] }, ...opts.vidouy, { src, lines: finAmida });
  } else {
    blocks.push({ src, lines: [{ seg: ix.yihyu1 }, ...finAmida] });
  }

  // Min'ha, avant de reculer de trois pas : c'est là qu'on prend sur soi un
  // jeûne pour le lendemain. Personne n'y est tenu : le passage vit dans un
  // encadré replié, comme tout ce qui ne se lit pas d'office, et c'est le
  // lecteur qui l'ouvre le jour où il veut jeûner. Le jour du jeûne, le
  // « Ribbon haolamim » qui offre à la place du korban la graisse et le sang
  // perdus se dit, lui, dans le fil : c'est l'ajout du jour.
  if (ix.taanitYahid !== undefined) {
    blocks.push({
      src,
      fold: "taanit-yahid",
      labelText: R(
        "Prendre sur soi un jeûne pour demain",
        "Taking on a fast for tomorrow",
        "קבלת תענית למחר",
      ),
      lines: [
        {
          // Consigne et texte partagent le même <small> : on coupe au premier
          // mot de la prière.
          seg: ix.taanitYahid,
          mode: "small",
          from: "רִבּוֹן הָעוֹלָמִים",
          rubric: R(
            "Qui veut jeûner demain prend son jeûne sur lui ici, avant de reculer de trois pas\u00a0:",
            "Whoever wishes to fast tomorrow accepts the fast here, before stepping back three steps:",
            "הרוצה להתענות למחר מקבל עליו את התענית כאן, לפני שיפסע שלוש פסיעות:",
          ),
        },
      ],
    });
    blocks.push({
      src,
      when: "taanit",
      lines: [
        {
          seg: ix.taanitYahid + 1,
          mode: "small",
          from: "רִבּוֹן הָעוֹלָמִים",
          rubric: R(
            "Le jour du jeûne, on dit\u00a0:",
            "On the fast day, say:",
            "ביום התענית אומרים:",
          ),
        },
      ],
    });
  }

  // 'Ossé chalom, « 'ossé hachalom » aux dix jours de techouva.
  blocks.push({
    src,
    lines: [
      {
        parts: [
          { he: "עֹשֶׂה שָׁלוֹם", unless: "teshuva" },
          didascalieDeRemplacement(
            "teshuva",
            R(
              "Aux dix jours de techouva, on conclut\u00a0:",
              "During the Ten Days of Repentance, conclude:",
              "בעשרת ימי תשובה חותמים:",
            ),
          ),
          { he: "עוֹשֶׂה הַשָּׁלוֹם", when: "teshuva", accent: true },
          { seg: ix.osse, from: "בִּמְרוֹמָיו" },
        ],
      },
      { seg: ix.yehiRatson, mode: "small" },
    ],
  });

  return blocks;
}

/**
 * Le Kaddich du 'hazan, replié : celui qui prie seul ne le dit pas, mais à
 * l'office on veut pouvoir le suivre. Le texte vit dans les segments 4 à 7 de
 * « Uva LeSion » de Cha'harit (yitgadal, titkabal, yehé chelama, 'ossé
 * chalom) ; Min'ha et Arvit le reçoivent sous la clé source `src`.
 */
function kaddishHalf(src, { when, unless, rubric = RUBRIC.hazan, labelText, seg = 4 } = {}) {
  const spec = {
    src,
    fold: "hazan",
    labelText:
      labelText ?? R("Demi-Kaddich (le 'hazan)", "Half Kaddish (the chazan)", "חצי קדיש (החזן)"),
    lines: [{ seg, rubric, splitAmen: true }],
  };
  if (when) spec.when = when;
  if (unless) spec.unless = unless;
  return spec;
}

function kaddishTitkabal(src, { when, seg = 4 } = {}) {
  const spec = {
    src,
    fold: "hazan",
    labelText: R(
      "Kaddich Titkabal (le 'hazan)",
      "Kaddish Titkabbal (the chazan)",
      "קדיש תתקבל (החזן)",
    ),
    lines: [
      { seg, rubric: RUBRIC.hazan, splitAmen: true },
      { seg: seg + 1, tight: true, splitAmen: true },
      { seg: seg + 2, tight: true, splitAmen: true },
      {
        seg: seg + 3,
        strip: ["יפסע שלש פסיעות לאחור"],
        rubric: R(
          "Il recule de trois pas et dit :",
          "He steps back three steps and says:",
          "יפסע שלוש פסיעות לאחור ויאמר:",
        ),
        tight: true,
        splitAmen: true,
      },
    ],
  };
  if (when) spec.when = when;
  return spec;
}

/**
 * Le Kaddich « yehé chelama » (le kaddich des endeuillés), dit après des
 * psaumes : yitgadal, puis yehé chelama et 'ossé chalom, sans titkabal.
 * Comme les autres kaddichim, il est replié : il demande un minyan, celui
 * qui prie seul ne le dit pas. La source le porte en entier là où il se
 * dit ; `seg` pointe son premier segment, le suivant le continue.
 */
function kaddishYeheChelama(src, seg) {
  return {
    src,
    fold: "hazan",
    labelText: R("Kaddich yehé chelama", "Kaddish Yehe Shelama", "קדיש יהא שלמא"),
    lines: [
      {
        seg,
        rubric: R(
          "On dit le Kaddich « yehé chelama » :",
          "The Kaddish “Yehe Shelama” is said:",
          "ואומרים קדיש יהא שלמא:",
        ),
        splitAmen: true,
      },
      { seg: seg + 1, tight: true, splitAmen: true },
    ],
  };
}

/**
 * Le Kaddich « 'al Israël » (dérabanan), dit après un passage d'étude (les
 * korbanot du matin, l'étude qui ferme Kavé : Tana debé Eliyahou, Rabbi
 * Hanina) : yitgadal, le paragraphe 'Al Israël, puis yehé chelama et 'ossé
 * chalom. La source le porte en entier là où il se dit ; `seg` pointe son
 * premier segment, les deux suivants le continuent.
 */
function kaddishAlIsrael(src, seg) {
  return {
    src,
    fold: "hazan",
    labelText: R("Kaddich 'al Israël", "Kaddish al Yisrael", "קדיש על ישראל"),
    lines: [
      {
        seg,
        rubric: R(
          "On dit le Kaddich « 'al Israël » :",
          "The Kaddish “al Yisrael” is said:",
          "ואומרים קדיש על ישראל:",
        ),
        splitAmen: true,
      },
      { seg: seg + 1, tight: true, splitAmen: true },
      { seg: seg + 2, tight: true, splitAmen: true },
    ],
  };
}

/**
 * Hochiénou : les cinq versets qui suivent le psaume du jour (Tehilim 106:47
 * et 48, 135:21, 72:18 et 19). L'export Sefaria du siddour ne les porte pas ;
 * ils sont donc écrits ici, dans la vocalisation du texte massorétique que
 * l'application sert déjà (public/texts/tehilim.json).
 */
const HOSHIENU =
  "הֽוֹשִׁיעֵ֨נוּ ׀ יְ֘הֹוָ֤ה אֱלֹהֵ֗ינוּ וְקַבְּצֵנוּ֮ מִֽן־הַגּ֫וֹיִ֥ם לְ֭הֹדוֹת לְשֵׁ֣ם קׇדְשֶׁ֑ךָ לְ֝הִשְׁתַּבֵּ֗חַ בִּתְהִלָּתֶֽךָ׃ בָּ֤רֽוּךְ־יְהֹוָ֨ה אֱלֹהֵ֪י יִשְׂרָאֵ֡ל מִן־הָ֤עוֹלָ֨ם ׀ וְעַ֬ד הָעוֹלָ֗ם וְאָמַ֖ר כׇּל־הָעָ֥ם אָמֵ֗ן הַֽלְלוּ־יָֽהּ׃ בָּ֘ר֤וּךְ יְהֹוָ֨ה ׀ מִצִּיּ֗וֹן שֹׁ֘כֵ֤ן יְֽרוּשָׁלָ֗͏ִם הַֽלְלוּ־יָֽהּ׃ בָּר֤וּךְ ׀ יְהֹוָ֣ה אֱ֭לֹהִים אֱלֹהֵ֣י יִשְׂרָאֵ֑ל עֹשֵׂ֖ה נִפְלָא֣וֹת לְבַדּֽוֹ׃ וּבָר֤וּךְ ׀ שֵׁ֥ם כְּבוֹד֗וֹ לְע֫וֹלָ֥ם וְיִמָּלֵ֣א כְ֭בוֹדוֹ אֶת־כֹּ֥ל הָאָ֗רֶץ אָ֘מֵ֥ן ׀ וְאָמֵֽן׃";

/** Avinou Malkénou (dix jours de techouva), après la 'Amida. */
function avinouMalkenou(src, from, to) {
  const lines = [];
  for (let i = from; i <= to; i++) {
    lines.push({ seg: i, mode: "small", tight: i !== from });
  }
  return {
    src,
    when: "teshuva",
    plain: true,
    labelText: R("Avinou Malkénou", "Avinu Malkenu", "אבינו מלכנו"),
    lines,
  };
}

/**
 * La sortie du séfer Torah : ce qui se dit avant la lecture, d'« El erekh
 * apayim » (ou « Yehi Adonaï » les jours sans tahanoun) à la bénédiction de
 * l'appelé. Le lundi et le jeudi ordinaires, les jours de jeûne public, le
 * matin comme à Min'ha : la même cérémonie, seule la lecture change.
 * `tahanoun` et `sansTahanoun` sont les clés de l'office (Min'ha a les
 * siennes) ; `halakha` porte celle de la lecture du jour.
 */
function sortieSeferTorah({ when, tahanoun, sansTahanoun, halakha }) {
  return {
    src: "Torah Reading",
    when,
    plain: true,
    labelText: R("Lecture de la Torah", "Torah reading", "קריאת התורה"),
    halakha,
    lines: [
      {
        seg: 2,
        when: tahanoun,
        rubric: R("On dit d'abord :", "First, say:", "תחילה אומרים:"),
      },
      { seg: 3, when: tahanoun, tight: true },
      // Les jours sans tahanoun, « Yehi Adonaï Elohénou 'imanou » tient
      // la place des deux « El erekh apayim ».
      {
        seg: 5,
        when: sansTahanoun,
        rubric: R("On dit d'abord :", "First, say:", "תחילה אומרים:"),
      },
      {
        seg: 6,
        rubric: R(
          "Quand on sort le séfer Torah :",
          "As the Torah scroll is taken out:",
          "כשמוציאים ספר תורה אומרים:",
        ),
      },
      {
        seg: 8,
        rubric: R(
          "On montre l'écriture à l'assemblée :",
          "The script is shown to the congregation:",
          "מגביה ומראה הכתב לקהל ואומרים:",
        ),
      },
      // Sur la téba, avant Barekhou : l'appelé salue l'assemblée, qui lui
      // répond.
      {
        seg: 9,
        mode: "full",
        strip: ["ואומר העולה:"],
        rubric: R("L'appelé dit :", "The one called up says:", "ואומר העולה:"),
      },
      {
        seg: 10,
        mode: "full",
        strip: ["ועונים הקהל:"],
        rubric: RUBRIC.kahal,
        tight: true,
      },
      {
        seg: 11,
        mode: "full",
        strip: ["ואומר העולה:"],
        rubric: R("L'appelé dit :", "The one called up says:", "ואומר העולה:"),
      },
      {
        seg: 12,
        mode: "full",
        strip: ["ועונים הקהל:"],
        rubric: RUBRIC.kahal,
        tight: true,
      },
      {
        seg: 13,
        mode: "full",
        strip: ["וחוזר העולה:"],
        rubric: R("L'appelé reprend :", "The one called up repeats:", "וחוזר העולה:"),
        tight: true,
      },
      {
        seg: 15,
        rubric: R(
          "Avant la lecture, l'appelé bénit :",
          "Before the reading, the one called up blesses:",
          "ומברך העולה לפני הקריאה:",
        ),
      },
    ],
  };
}

/** La bénédiction de l'appelé après la lecture. */
function benedictionApresLecture(when) {
  return {
    src: "Torah Reading",
    when,
    plain: true,
    lines: [
      {
        seg: 17,
        rubric: R(
          "Après la lecture, l'appelé bénit :",
          "After the reading, the one called up blesses:",
          "אחר הקריאה מברך העולה:",
        ),
      },
    ],
  };
}

/**
 * Les trois montées de « Vaye'hal Moché » (Chemot 32, 11 à 14 ; 34, 1 à 3 ;
 * 34, 4 à 10), bornées par leurs premiers mots : la source les marque de
 * deux mots en retrait (לוי, ישראל) que le fil ne garde pas.
 */
const VAYEHAL_MONTEES = [
  { fr: "Cohen", en: "Kohen", he: "כהן", until: "ויאמר יהוה אל־משה פסל" },
  {
    fr: "Lévi",
    en: "Levi",
    he: "לוי",
    from: "ויאמר יהוה אל־משה פסל",
    until: "ויפסל שני־לחת",
  },
  { fr: "Israël", en: "Yisrael", he: "ישראל", from: "ויפסל שני־לחת" },
];

/**
 * La lecture de la Torah des jeûnes publics, « Vaye'hal Moché » : un seul
 * bloc, une montée par paragraphe, chacune sous sa didascalie. Le menu de
 * lecture n'y jette qu'un repère, celui de la sortie du séfer qui précède :
 * trois titres pour trois montées, c'était trop.
 */
function vayehalBlock(when) {
  return {
    src: "Taanit.Torah",
    when,
    plain: true,
    lines: VAYEHAL_MONTEES.map((montee) => ({
      seg: 1,
      from: montee.from,
      until: montee.until,
      rubric: R(`${montee.fr} :`, `${montee.en}:`, `${montee.he}:`),
    })),
  };
}

/**
 * Les sli'hot des quatre jeûnes publics à Cha'harit (Guedalia, 10 Tévet,
 * Esther, 17 Tamouz), après la répétition de la 'Amida, à la place du
 * tahanoun ordinaire : elles en contiennent le vidouy, la nefilat apayim et
 * les supplications longues du lundi et du jeudi. L'ordre est celui du
 * sidour imprimé : les sli'hot propres au jeûne, puis les textes communs aux
 * quatre, puis la nefilat apayim avec son piyout, un par jeûne, et sa fin.
 *
 * La source Sefaria porte les quatre jeûnes, chacun suivi des textes communs
 * (ceux du jeûne de Guedalia servent pour tous) ; ce qu'elle ne porte pas
 * vient du sidour imprimé (scripts/lib/selihot-tsom.mjs). Tout se lit dans le
 * fil (plain) : ce sont les prières du jour, pas un ajout à signaler.
 */
function selihotTsomBlocks() {
  const debout = R(
    "Après la répétition de la 'Amida, en restant debout, on dit (dans certaines communautés, on commence par le vidouy et la nefilat apayim, suivant l'opinion de l'Ari zal) :",
    "After the repetition of the Amidah, still standing, say (in some communities, the viduy and nefilat apayim come first, following the Ari zal):",
    "אחר חזרת הש״ץ, מעומד, אומרים (יש קהילות שמקדימות וידוי ונפילת אפים, כדעת האר״י):",
  );
  const certainsNeDisentPas = R(
    "Certaines communautés ne récitent pas les versets du paragraphe suivant :",
    "Some communities do not say the verses of the following paragraph:",
    "יש קהילות שאינן אומרות את פסוקי הקטע הבא:",
  );
  // « Vaya'avor », et ce que le jeûne de Guedalia y ajoute dans certaines
  // communautés : la fin du verset (Chemot 34, 9). Les sli'hot propres aux
  // trois autres jeûnes n'ont que faire de cet ajout.
  const vaavor = (seg, ajout = true) => [{ seg, tight: true }, ...(ajout ? [ajoutGuedalia] : [])];
  const ajoutGuedalia = {
    he: AJOUT_GUEDALIA,
    when: "tsom-guedalia",
    muted: true,
    tight: true,
    rubric: R(
      "(Au jeûne de Guedalia, certaines communautés ajoutent :)",
      "(On the Fast of Gedaliah, some communities add:)",
      "(בצום גדליה יש קהילות שמוסיפות:)",
    ),
  };
  // Des paragraphes serrés les uns sous les autres, comme le sidour les
  // imprime ; `premiere` habille le premier (sa didascalie) et tous (muted).
  const serrees = (textes, premiere = {}) =>
    textes.map((he, i) => {
      const { rubric, ...communs } = premiere;
      return i === 0 ? { he, rubric, ...communs } : { he, tight: true, ...communs };
    });
  const nefila = (jeune, fr, en, he) => ({
    when: `tsom-${jeune}`,
    plain: true,
    lines: serrees(NEFILAT_APAYIM[jeune], { rubric: R(fr, en, he) }),
  });

  return [
    // --- Le jeûne de Guedalia ------------------------------------------
    {
      src: "Tsom.Guedalia",
      when: "tsom-guedalia",
      plain: true,
      labelText: R(
        "Sli'hot du jeûne de Guedalia",
        "Selichot of the Fast of Gedaliah",
        "סליחות לצום גדליה",
      ),
      lines: [
        { seg: 3, rubric: debout },
        ...vaavor(4),
        { seg: 5 },
        { seg: 6 },
        ...vaavor(7),
        ...serrees(YIKOM_DAM),
        { he: psaume(79, 12, 13), tight: true },
      ],
    },
    {
      when: "tsom-guedalia",
      plain: true,
      lines: serrees(CHLOCH_ESRE_MIDOT, {
        muted: true,
        rubric: R(
          "Dans certaines communautés, on récite avant chaque « Vaya'avor » une strophe du passage suivant :",
          "In some communities, a stanza of the following is said before each “Vayaavor”:",
          "יש קהילות שאומרות לפני כל « ויעבר » בית מן הפיוט הזה:",
        ),
      }),
    },
    // --- Le 10 Tévet -----------------------------------------------------
    {
      src: "Tsom.Tevet",
      when: "tsom-tevet",
      plain: true,
      labelText: R("Sli'hot du 10 Tévet", "Selichot of the Tenth of Tevet", "סליחות לעשרה בטבת"),
      lines: [
        { seg: 2, rubric: debout },
        { seg: 3, tight: true },
        { seg: 4, tight: true },
        { seg: 5, tight: true },
        { seg: 6, tight: true },
        { seg: 7 },
        ...vaavor(8, false),
        { seg: 10 },
        { seg: 13 },
        ...vaavor(14, false),
        { seg: 11 },
        { seg: 12, tight: true },
      ],
    },
    // --- Le jeûne d'Esther ----------------------------------------------
    {
      src: "Tsom.Esther",
      when: "tsom-esther",
      plain: true,
      labelText: R(
        "Sli'hot du jeûne d'Esther",
        "Selichot of the Fast of Esther",
        "סליחות לתענית אסתר",
      ),
      lines: [
        { seg: 2, rubric: debout },
        ...vaavor(3, false),
        // « Agagi », puis, après El mélekh et Vaya'avor, « Yi'halta
        // 'avadekha », que la source range à sa suite dans le même segment.
        { seg: 4, until: "יחלת עבדיך" },
        { seg: 11 },
        ...vaavor(12, false),
        { seg: 4, from: "יחלת עבדיך" },
        { seg: 5, muted: true, rubric: certainsNeDisentPas },
        { seg: 6 },
        { seg: 7, muted: true, rubric: certainsNeDisentPas },
        { seg: 8 },
        { seg: 9, muted: true, rubric: certainsNeDisentPas },
        { seg: 10 },
      ],
    },
    // --- Le 17 Tamouz ----------------------------------------------------
    {
      src: "Tsom.Tamouz",
      when: "tsom-tamouz",
      plain: true,
      labelText: R(
        "Sli'hot du 17 Tamouz",
        "Selichot of the Seventeenth of Tammuz",
        "סליחות לי״ז בתמוז",
      ),
      lines: [
        { seg: 3, rubric: debout },
        { seg: 4, tight: true },
        { seg: 5, tight: true },
        { seg: 6, tight: true },
        { seg: 7, tight: true },
        { seg: 8, tight: true },
        { seg: 9 },
        ...vaavor(10, false),
        { seg: 12 },
        { seg: 13, tight: true },
        { seg: 16 },
        ...vaavor(17, false),
        { seg: 14 },
        { seg: 15, tight: true },
      ],
    },
    // --- Les textes communs aux quatre jeûnes ----------------------------
    {
      src: "Tsom.Guedalia",
      when: "selihot-tsom",
      plain: true,
      labelText: R(
        "Sli'hot communes aux quatre jeûnes",
        "Selichot common to the four fasts",
        "סליחות לארבע התעניות",
      ),
      lines: [
        {
          seg: 9,
          rubric: R(
            "Textes communs aux quatre jeûnes :",
            "Texts common to the four fasts:",
            "הסליחות המשותפות לארבע התעניות:",
          ),
        },
        { seg: 10 },
        ...vaavor(11),
        { seg: 13 },
        { seg: 14 },
        ...vaavor(15),
        { seg: 16 },
        { seg: 17 },
        { seg: 19 },
      ],
    },
    {
      src: "Vidui",
      when: "selihot-tsom",
      plain: true,
      lines: [
        {
          seg: 1,
          rubric: R(
            "En récitant le passage suivant, on incline légèrement la tête et, du poing droit, on se frappe la poitrine du côté du cœur. (Dans les communautés qui suivent l'Ari zal, on saute ce passage, déjà récité, pour reprendre à « Achamnou mikol 'am ».)",
            "While saying the following, bow the head slightly and strike the chest over the heart with the right fist. (In communities following the Ari zal, this passage, already said, is skipped, resuming at “Ashamnu mikol am”.)",
            "באמירת הקטע הבא מרכינים מעט את הראש ומכים באגרוף ימין על הלב. (הנוהגים כדעת האר״י מדלגים על קטע זה, שכבר נאמר, וממשיכים ב« אשמנו מכל עם ».)",
          ),
        },
      ],
    },
    {
      src: "Tsom.Guedalia",
      when: "selihot-tsom",
      plain: true,
      lines: [{ parts: [{ seg: 20 }, { he: AVAL_HATANOU }] }, { seg: 21 }],
    },
    {
      src: "Vidui",
      when: "selihot-tsom",
      plain: true,
      lines: [
        {
          seg: 2,
          rubric: R(
            "(Dans les communautés qui suivent l'Ari zal, on saute ce passage, déjà récité, pour reprendre à « Vehou ra'houm ».)",
            "(In communities following the Ari zal, this passage, already said, is skipped, resuming at “Vehu rachum”.)",
            "(הנוהגים כדעת האר״י מדלגים על קטע זה, שכבר נאמר, וממשיכים ב« והוא רחום ».)",
          ),
        },
        ...vaavor(3),
      ],
    },
    {
      src: "Tsom.Guedalia",
      when: "selihot-tsom",
      plain: true,
      lines: [
        {
          seg: 24,
          rubric: R(
            "Un jour de brit-mila (en présence du mohel, du père du nouveau-né ou du sandak) et les sept jours du mariage quand le 'hatan est présent, on passe directement à la lecture de la Torah, précédée du Kaddich :",
            "On the day of a brit mila (in the presence of the mohel, the father or the sandak) and during the seven days of a wedding when the groom is present, go straight to the Torah reading, preceded by the Kaddish:",
            "ביום ברית מילה (במעמד המוהל, אבי הבן או הסנדק) ובשבעת ימי המשתה כשהחתן נמצא, עוברים ישר לקריאת התורה, ולפניה הקדיש:",
          ),
        },
        { seg: 25 },
        { seg: 26 },
        { seg: 27 },
        { seg: 28 },
      ],
    },
    // --- La nefilat apayim, avec le piyout du jeûne ------------------------
    {
      src: "Vidui",
      when: "selihot-tsom",
      plain: true,
      labelText: R("Nefilat apayim", "Nefilat apayim", "נפילת אפים"),
      lines: [
        {
          seg: 4,
          rubric: R(
            "On se rassoit pour dire la nefilat apayim. Certains se penchent en avant et inclinent la tête sur le bras gauche :",
            "Sit down for nefilat apayim. Some lean forward and rest the head on the left arm:",
            "יושבים לנפילת אפים. יש שמטים את הראש על זרוע שמאל:",
          ),
        },
        { seg: 6, tight: true },
        {
          seg: 7,
          rubric: R(
            "(Pour les communautés qui suivent l'Ari zal, le tahanoun se termine ici, et le 'hazan dit le Kaddich.)",
            "(For communities following the Ari zal, the tachanun ends here, and the chazan says the Kaddish.)",
            "(לנוהגים כדעת האר״י התחנון מסתיים כאן, והחזן אומר קדיש.)",
          ),
        },
      ],
    },
    nefila(
      "guedalia",
      "Au jeûne de Guedalia, on dit :",
      "On the Fast of Gedaliah, say:",
      "בצום גדליה אומרים:",
    ),
    nefila("tevet", "Au 10 Tévet, on dit :", "On the Tenth of Tevet, say:", "בעשרה בטבת אומרים:"),
    nefila(
      "esther",
      "Au jeûne d'Esther, on dit :",
      "On the Fast of Esther, say:",
      "בתענית אסתר אומרים:",
    ),
    nefila(
      "tamouz",
      "Au 17 Tamouz, on dit :",
      "On the Seventeenth of Tammuz, say:",
      "בי״ז בתמוז אומרים:",
    ),
    {
      src: "Vidui",
      when: "selihot-tsom",
      plain: true,
      lines: [
        { he: CHOUV_MEHARON },
        { seg: 8 },
        { seg: 9 },
        {
          he: psaume(121),
          muted: true,
          rubric: R(
            "Dans certaines communautés, on a l'habitude d'ajouter :",
            "In some communities, it is customary to add:",
            "יש קהילות שנוהגות להוסיף:",
          ),
        },
      ],
    },
  ];
}

/**
 * La supplique « Chema' koli » que certaines communautés disent avant Min'ha
 * d'un jeûne public, sauf un vendredi et la veille de Pourim.
 */
function chemaKoliBlock() {
  return {
    when: "tsom-minha",
    plain: true,
    labelText: R("Supplique « Chema' koli »", "Supplication “Shema koli”", "בקשת « שמע קולי »"),
    lines: CHEMA_KOLI.map((he, i) => ({
      he,
      muted: true,
      tight: i > 0,
      rubric:
        i === 0
          ? R(
              "Avant la prière de Min'ha, certaines communautés récitent la supplique suivante, sauf un vendredi et la veille de Pourim :",
              "Before Mincha, some communities say the following supplication, except on a Friday and on the eve of Purim:",
              "לפני תפילת מנחה יש קהילות שאומרות את הבקשה הזאת, חוץ מערב שבת וערב פורים:",
            )
          : undefined,
    })),
  };
}

/**
 * La haftara de Min'ha des jeûnes : un choix laissé au lecteur, car chaque
 * communauté fait autrement (voir la note qui précède le sélecteur). Trois
 * options d'une même clé : « Dirchou », « Chouva Israël », ou rien. Seule la
 * première porte un titre, pour que le menu de lecture n'en montre qu'un. Le
 * jour propose « Dirchou » à Guedalia et rien aux trois autres jeûnes (l'usage
 * du Maroc, et celui de la plupart des Sefaradim) ; le lecteur tranche, et
 * son choix est retenu.
 */
function haftaraBlocks() {
  const NOTE = R(
    "Qui lit quoi : les Achkenazim lisent « Dirchou » à Min'ha de chaque jeûne public (Rema, Ora'h 'Hayim 566, 1). La plupart des Sefaradim ne lisent pas de haftara à Min'ha d'un jeûne, hormis Tich'a beAv (Choul'han Aroukh, Rambam, 'Hida, Rav Ovadia Yossef). Les communautés du Maroc lisent « Dirchou » au seul jeûne de Guedalia, et rien aux trois autres. Certaines communautés lisent « Chouva Israël » aux jeûnes de Tévet, d'Esther et de Tamouz.",
    "Who reads what: Ashkenazim read “Dirshu” at Mincha of every public fast (Rema, Orach Chayim 566:1). Most Sephardim read no haftarah at Mincha of a fast, except on Tisha BeAv (Shulchan Aruch, Rambam, Chida, Rav Ovadia Yosef). Moroccan communities read “Dirshu” on the Fast of Gedaliah only, and nothing on the three others. Some communities read “Shuva Yisrael” on the fasts of Tevet, Esther and Tammuz.",
    'מי קורא מה: האשכנזים מפטירים « דרשו » במנחה של כל תענית ציבור (רמ"א, אורח חיים תקסו, א). רוב הספרדים אינם מפטירים במנחה של תענית, חוץ מתשעה באב (שולחן ערוך, רמב"ם, חיד"א, הרב עובדיה יוסף). קהילות מרוקו מפטירות « דרשו » בצום גדליה בלבד, ולא בשלוש התעניות האחרות. יש קהילות שמפטירות « שובה ישראל » בצומות טבת, אסתר ותמוז.',
  );
  const ouverture = {
    seg: 1,
    rubric: R(
      "Le troisième appelé lit la haftara, en la faisant précéder et suivre des bénédictions d'usage :",
      "The third one called up reads the haftarah, with its blessings before and after:",
      "העולה השלישי קורא את ההפטרה, בברכותיה לפניה ולאחריה:",
    ),
  };
  const cloture = [
    {
      seg: 4,
      mode: "small",
      rubric: R(
        "Après la haftara, le maftir lit ce verset, puis les bénédictions de clôture :",
        "After the haftarah, the maftir reads this verse, then the closing blessings:",
        "אחר ההפטרה אומר המפטיר פסוק זה, ואחריו ברכות ההפטרה:",
      ),
    },
    { seg: 6, tight: true },
    { seg: 7, tight: true },
    { seg: 8, tight: true },
  ];
  const option = (id, label, preferred, lines) => ({
    src: "Haftara",
    when: "selihot-tsom",
    plain: true,
    choice: { key: "haftara-tsom", id, label, ...(preferred ? { preferred } : {}) },
    halakha: NOTE,
    lines,
  });
  const dirchou = [
    ouverture,
    {
      he: versets(324, 55, 6, 13),
      rubric: R("Yecha'ya 55, 6 à 56, 8 :", "Isaiah 55:6 to 56:8:", "ישעיה נה, ו עד נו, ח:"),
    },
    { he: versets(324, 56, 1, 8), tight: true },
    ...cloture,
  ];
  const chouva = [
    ouverture,
    {
      he: versets(327, 14, 2, 10),
      rubric: R(
        "Hochéa 14, 2 à 10, puis Mikha 7, 18 à 20 :",
        "Hosea 14:2-10, then Micah 7:18-20:",
        "הושע יד, ב עד י, ואחריו מיכה ז, יח עד כ:",
      ),
    },
    { he: versets(327, 39, 18, 20), tight: true },
    ...cloture,
  ];
  const DIRCHOU = R(
    "« Dirchou » (Yecha'ya 55, 6 à 56, 8)",
    "“Dirshu” (Isaiah 55:6 to 56:8)",
    "« דרשו » (ישעיה נה, ו עד נו, ח)",
  );
  const CHOUVA = R(
    "« Chouva Israël » (Hochéa 14, 2 à 10 ; Mikha 7, 18 à 20)",
    "“Shuva Yisrael” (Hosea 14:2-10; Micah 7:18-20)",
    "« שובה ישראל » (הושע יד, ב עד י; מיכה ז, יח עד כ)",
  );
  // Tich'a beAv a sa propre clé de choix : on y lit une haftara même là où
  // l'on n'en lit aucune aux autres jeûnes, et le choix « pas de haftara »
  // fait pour ceux-ci ne doit pas l'effacer. La clé du jour, `tisha-beav`,
  // est connue des versions publiées, et ne conditionne ici que du contenu
  // qu'elles n'avaient pas (voir docs/compatibilite-textes.md).
  const NOTE_TISHA_BEAV = R(
    "Qui lit quoi : à Min'ha de Tich'a beAv, les Sefaradim lisent « Chouva Israël » (Hochéa 14, 2 à 10, puis Mikha 7, 18 à 20), les Achkenazim « Dirchou » (Rema, Ora'h 'Hayim 566, 1).",
    "Who reads what: at Mincha of Tisha BeAv, Sephardim read “Shuva Yisrael” (Hosea 14:2-10, then Micah 7:18-20), Ashkenazim “Dirshu” (Rema, Orach Chayim 566:1).",
    'מי קורא מה: במנחה של תשעה באב הספרדים מפטירים « שובה ישראל » (הושע יד, ב עד י, ואחריו מיכה ז, יח עד כ), והאשכנזים « דרשו » (רמ"א, אורח חיים תקסו, א).',
  );
  const optionTishaBeav = (id, label, preferred, lines) => ({
    src: "Haftara",
    when: "tisha-beav",
    plain: true,
    choice: { key: "haftara-tisha-beav", id, label, ...(preferred ? { preferred } : {}) },
    halakha: NOTE_TISHA_BEAV,
    lines,
  });
  return [
    {
      ...option(
        "dirchou",
        R(
          "« Dirchou » (Yecha'ya 55, 6 à 56, 8)",
          "“Dirshu” (Isaiah 55:6 to 56:8)",
          "« דרשו » (ישעיה נה, ו עד נו, ח)",
        ),
        "tsom-guedalia",
        dirchou,
      ),
      labelText: R("Haftara", "Haftarah", "הפטרה"),
    },
    option(
      "chouva",
      R(
        "« Chouva Israël » (Hochéa 14, 2 à 10 ; Mikha 7, 18 à 20)",
        "“Shuva Yisrael” (Hosea 14:2-10; Micah 7:18-20)",
        "« שובה ישראל » (הושע יד, ב עד י; מיכה ז, יח עד כ)",
      ),
      undefined,
      chouva,
    ),
    option(
      "aucune",
      R("Pas de haftara", "No haftarah", "בלי הפטרה"),
      "tsom-tevet|tsom-esther|tsom-tamouz",
      [],
    ),
    {
      ...optionTishaBeav("chouva", CHOUVA, "tisha-beav", chouva),
      labelText: R("Haftara", "Haftarah", "הפטרה"),
    },
    optionTishaBeav("dirchou", DIRCHOU, undefined, dirchou),
  ];
}

/**
 * Les psaumes de Min'ha des jeûnes pendant qu'on rhabille le séfer Torah :
 * le 20 dans certaines communautés, remplacé par le 124 au jeûne d'Esther
 * tenu la veille de Pourim, par le 126 au 10 Tévet tombé un vendredi.
 */
function psaumesSeferBlocks() {
  const bloc = (when, n, fr, en, he) => ({
    when,
    plain: true,
    lines: [{ he: psaume(n), muted: true, rubric: R(fr, en, he) }],
  });
  return [
    bloc(
      "tsom-minha",
      20,
      "Dans certaines communautés, pendant qu'on rhabille le séfer Torah, on dit :",
      "In some communities, while the Torah scroll is dressed, say:",
      "יש קהילות שאומרות בשעת גלילת ספר התורה:",
    ),
    bloc(
      "tsom-esther-veille",
      124,
      "Au jeûne d'Esther tenu la veille de Pourim, on dit à sa place, en rhabillant le séfer Torah :",
      "On the Fast of Esther held on the eve of Purim, say instead, while the Torah scroll is dressed:",
      "בתענית אסתר בערב פורים אומרים במקומו, בשעת גלילת ספר התורה:",
    ),
    bloc(
      "tsom-vendredi",
      126,
      "Au 10 Tévet tombé un vendredi, on dit à sa place, en rhabillant le séfer Torah :",
      "When the Tenth of Tevet falls on a Friday, say instead, while the Torah scroll is dressed:",
      "בעשרה בטבת שחל בערב שבת אומרים במקומו, בשעת גלילת ספר התורה:",
    ),
  ];
}

// ---------- Recettes des trois offices ----------

function chaharitRecipe() {
  const amida = amidaBlocks(
    "Amida",
    {
      avot: 2,
      gevurot: 3,
      mekhalkel: 5,
      kedushaText: 8,
      ataKadosh: 9,
      honen: 10,
      hashivenu: 11,
      selah: 12,
      reeh: 13,
      refaenu: 17,
      barkhenu: 19,
      barekhAlenu: 21,
      teka: 22,
      hashiva: 23,
      laminim: 24,
      tsadikim: 25,
      tishkon: 26,
      tsemah: 27,
      shemaKolenu: 28,
      kiAta: 31,
      retse: 32,
      yv: 34,
      yvRH: 35,
      yvPessah: 36,
      yvSouccot: 37,
      yvSuite: 38,
      veata: 39,
      modim: 41,
      modimDerabanan: 44,
      alHanissim: 46,
      hanouka: 47,
      pourim: 48,
      vealKoulam: 49,
      anenouHazan: 15,
      anenouYahid: 29,
      simShalom: 65,
      yihyu1: 66,
      elohaiNetsor: 67,
      lemaan: 68,
      yihyu2: 69,
      osse: 70,
      yehiRatson: 71,
    },
    {
      kohanim: birkatKohanimBlock("Amida", {
        bracha: 53,
        versets: [55, 56, 57],
        hazan: 59,
        versetsHazan: [60, 61, 62],
      }),
    },
  );

  const chirJours = [
    ["jour-0", 2, 3],
    ["jour-1", 4, 5],
    ["jour-2", 6, 7],
    ["jour-3", 8, 9],
    ["jour-4", 10, 11],
    ["jour-5", 12, 13],
  ].map(([when, intro, psaume]) => ({
    src: "Song of the Day",
    when,
    plain: true,
    lines: [{ seg: intro }, { seg: psaume, tight: true }],
  }));

  /**
   * Les psaumes qui s'ajoutent au chir chel yom certains jours de l'année.
   * Ils ne remplacent pas celui du jour : on dit le psaume du jour, puis
   * celui-ci. Le dernier, celui de la maison endeuillée, fait exception et
   * prend la place du psaume du jour ; mais aucun calendrier ne sait où l'on
   * prie, il reste donc en retrait, sous sa consigne, à la main du lecteur.
   */
  const chirDates = [
    [
      "chir-tsom-tichri",
      15,
      "(תהילים פ״ג:א׳-ג׳)",
      R(
        "Au jeûne de Guedalia et le 10 Tévet, on ajoute :",
        "On the Fast of Gedaliah and the Tenth of Tevet, add:",
        "בצום גדליה ובעשרה בטבת אומרים:",
      ),
    ],
    [
      "chir-lendemain-kippour",
      17,
      "(תהילים פ״ה:א׳-ג׳)",
      R(
        "Au lendemain de Kippour, on ajoute :",
        "On the day after Yom Kippur, add:",
        "למחרת יום הכיפורים אומרים:",
      ),
    ],
    [
      "chir-hanouka",
      19,
      "(תהילים ל׳:א׳-ב׳)",
      R("À 'Hanouka, on ajoute :", "On Hanukkah, add:", "בחנוכה אומרים:"),
    ],
    [
      "chir-pourim",
      21,
      "(תהילים כ״ב:א׳-ב׳)",
      R(
        "Au jeûne d'Esther et à Pourim, on ajoute :",
        "On the Fast of Esther and on Purim, add:",
        "בתענית אסתר ובפורים אומרים:",
      ),
    ],
    [
      "chir-tsom-tamouz",
      23,
      "(תהילים ע״ט:א׳)",
      R(
        "Le 17 Tamouz, on ajoute :",
        "On the Seventeenth of Tammuz, add:",
        "בשבעה עשר בתמוז אומרים:",
      ),
    ],
  ].map(([when, seg, cite, rubric]) => ({
    src: "Song of the Day",
    when,
    plain: true,
    // Le renvoi au psaume est glissé entre deux mots par la source : on le
    // retire, comme il l'est déjà des psaumes du jour.
    lines: [{ seg, mode: "small", strip: [cite], rubric }],
  }));

  // La maison endeuillée : le psaume 49 prend la place de celui du jour. Aucun
  // calendrier ne sait où l'on prie ; le passage est donc là tous les jours,
  // mais replié, et c'est le lecteur qui l'ouvre le jour où il s'y trouve.
  const chirAvel = {
    src: "Song of the Day",
    fold: "avel",
    labelText: R("Dans une maison endeuillée", "In a house of mourning", "בבית האבל"),
    lines: [
      {
        seg: 25,
        mode: "small",
        strip: ["(תהילים מ״ט:א׳-ג׳)"],
        rubric: R(
          "On dit celui-ci à la place du psaume du jour :",
          "This one is said in place of the psalm of the day:",
          "אומרים זה במקום שיר של יום:",
        ),
      },
      {
        seg: 26,
        mode: "small",
        tight: true,
        rubric: R("Certains ajoutent :", "Some add:", "ויש שמוסיפים:"),
      },
    ],
  };

  return {
    title: "שחרית של חול (Chaharit)",
    blocks: [
      { zman: "chaharit" },
      {
        src: "PP.Modeh Ani",
        // Le réveil, les bénédictions du matin et celles de la Torah se
        // suivent sans qu'on s'arrête entre elles : un seul titre pour les
        // trois, porté par le premier bloc.
        labelText: R("Bénédictions du matin", "Morning blessings", "ברכות השחר"),
        halakha: HALAKHA.birkotHashahar,
        lines: [
          {
            seg: 3,
            rubric: R("Avant toute chose :", "Before anything else:", "כשיעור משנתו יאמר:"),
            alt: { after: "מוֹדֶה", rubric: FEMMES, text: "מוֹדָה" },
          },
        ],
      },
      {
        src: "PP.Morning Blessings",
        lines: [
          {
            seg: 2,
            rubric: R("Après la netilat yadayim :", "After washing the hands:", "אחר נטילת ידיים:"),
          },
          { seg: 4 },
          { seg: 6, alt: { after: "מוֹדֶה", rubric: FEMMES, text: "מוֹדָה" } },
          { seg: 7 },
          { seg: 8 },
          { seg: 9 },
          { seg: 10 },
          { seg: 11 },
          { seg: 12 },
          { seg: 13 },
          { seg: 14 },
          { seg: 16 },
          { seg: 17 },
          { seg: 18 },
          { seg: 19, alt: { rubric: FEMMES, text: "גּוֹיָה:" } },
          { seg: 20, alt: { rubric: FEMMES, text: "שִׁפְחָה:" } },
          {
            seg: 22,
            // Les femmes ne disent pas le même mot au féminin mais une autre
            // phrase, courte : la source la donne sans nom divin ni royauté,
            // et sa consigne dit pourquoi.
            alt: {
              rubric: R(
                "(les femmes disent, sans nom divin ni royauté)",
                "(women say, without the Name and Kingship)",
                "(האשה מברכת בלי שם ומלכות)",
              ),
              text: "בָּרוּךְ שֶׁעָשַׂנִי כִּרְצוֹנוֹ:",
            },
          },
          { seg: 25 },
          { seg: 26, tight: true },
        ],
      },
      {
        src: "PP.Torah Blessings",
        lines: [
          { seg: 1 },
          { seg: 2, tight: true },
          { seg: 3 },
          {
            seg: 4,
            rubric: R(
              "Puis on lit la bénédiction des cohanim :",
              "Then read the priestly blessing:",
              "ואחר כך קוראים ברכת כהנים:",
            ),
          },
        ],
      },
      // Le talit et les téfilines, entre les bénédictions de la Torah et
      // 'Akédat Its'hak, comme dans la source : on s'en revêt avant d'entrer
      // dans la prière.
      {
        // Le matin de Tich'a beAv, on ne les met pas : ils attendent Min'ha.
        when: "sans-tisha-beav",
        plain: true,
        src: "Talit",
        // Le talit et les téfilines se posent l'un après l'autre : un seul
        // titre, qui porte aussi le miroir du bayit de la tête.
        labelText: R("Le talit et les téfilines", "Talit and tefillin", "טלית ותפילין"),
        mirror: true,
        halakha: R(
          "Avant de bénir, on vérifie les fils du tsitsit et on les sépare. On s'enveloppe la tête, puis on rabat le talit sur le corps.",
          "Before blessing, check the tzitzit threads and separate them. Wrap the head, then draw the talit down over the body.",
          "לפני הברכה בודקים את חוטי הציצית ומפרידים אותם. מתעטפים בטלית על הראש, ואחר כך מורידים אותה על הגוף.",
        ),
        lines: [
          {
            seg: 1,
            rubric: R(
              "Avant la bénédiction, il est bon de dire le « léchem yihoud » :",
              "Before the blessing, it is good to say the “leshem yichud”:",
              'לפני שיברך על הציצית טוב לומר "לשם יחוד":',
            ),
          },
          {
            he: "בָּרְכִ֥י נַפְשִׁ֗י אֶת־יְ֫הֹוָ֥ה יְהֹוָ֣ה אֱ֭לֹהַי גָּדַ֣לְתָּ מְּאֹ֑ד ה֖וֹד וְהָדָ֣ר לָבָֽשְׁתָּ׃ עֹֽטֶה־א֭וֹר כַּשַּׂלְמָ֑ה נוֹטֶ֥ה שָׁ֝מַ֗יִם כַּיְרִיעָֽה׃",
            rubric: R(
              "On vérifie les fils du tsitsit, puis on dit :",
              "Check the tzitzit threads, then say:",
              "יבדוק את חוטי הציצית, ויאמר:",
            ),
          },
          { seg: 2 },
          {
            he: "מַה־יָּקָ֥ר חַסְדְּךָ֗ אֱלֹ֫הִ֥ים וּבְנֵ֥י אָדָ֑ם בְּצֵ֥ל כְּ֝נָפֶ֗יךָ יֶחֱסָיֽוּן׃ יִ֭רְוְיֻן מִדֶּ֣שֶׁן בֵּיתֶ֑ךָ וְנַ֖חַל עֲדָנֶ֣יךָ תַשְׁקֵֽם׃ כִּֽי־עִ֭מְּךָ מְק֣וֹר חַיִּ֑ים בְּ֝אוֹרְךָ֗ נִרְאֶה־אֽוֹר׃ מְשֹׁ֣ךְ חַ֭סְדְּךָ לְיֹדְעֶ֑יךָ וְ֝צִדְקָתְךָ֗ לְיִשְׁרֵי־לֵֽב׃",
            rubric: R(
              "En rabattant le talit sur soi :",
              "As the talit is drawn down over the body:",
              "כשמוריד את הטלית על גופו, יאמר:",
            ),
          },
          {
            he: "בָּרוּךְ אַתָּה יְהֹוָה, אֱלֹהֵֽינוּ מֶֽלֶךְ הָעוֹלָם, אֲשֶׁר קִדְּשָׁנוּ בְּמִצְוֹתָיו וְצִוָּנוּ עַל מִצְוַת צִיצִית:",
            muted: true,
            rubric: R(
              "Sur le talit katan, quand la bénédiction du grand talit ne le couvre pas :",
              "On the talit katan, when the large talit's blessing does not cover it:",
              "על טלית קטן, כשאינו נפטר בברכת הטלית הגדול:",
            ),
          },
        ],
      },
      {
        // Le matin de Tich'a beAv, on ne les met pas : ils attendent Min'ha.
        when: "sans-tisha-beav",
        plain: true,
        src: "Tefillin",
        halakha: R(
          "On pose d'abord les téfilines du bras, sur le biceps face au cœur, puis ceux de la tête. On ne parle pas entre les deux.",
          "The arm tefillin goes on first, on the biceps facing the heart, then the head tefillin. Do not speak between the two.",
          "מניחים תחילה תפילין של יד על הזרוע כנגד הלב, ואחר כך של ראש. ואין מפסיקים בדיבור ביניהם.",
        ),
        lines: [
          {
            seg: 1,
            rubric: R(
              "Avant la bénédiction, il est bon de dire le « léchem yihoud » :",
              "Before the blessing, it is good to say the “leshem yichud”:",
              'לפני שיברך על התפילין טוב לומר "לשם יחוד":',
            ),
          },
          { seg: 2 },
          {
            seg: 2,
            mode: "small",
            muted: true,
            rubric: R(
              "Si l'on a parlé entre les téfilines du bras et ceux de la tête, on bénit sur ceux de la tête :",
              "If one spoke between the arm tefillin and the head tefillin, bless over the head tefillin:",
              "אם הפסיק בדיבור בין תפילין של יד לתפילין של ראש, מברך על תפילין של ראש:",
            ),
          },
          {
            seg: 3,
            rubric: R(
              "Les téfilines de la tête posés, on achève l'enroulement au doigt du milieu, une boucle avant chaque « vé'érastikh » :",
              "Once the head tefillin is on, finish winding around the middle finger, one turn before each “ve'erastikh”:",
              'אחר שהניח תפילין של ראש, גומר את הכריכות על האצבע האמצעית, כריכה אחת לפני כל "וארשתיך":',
            ),
          },
          // Les deux parachiot des téfilines : dans le fil, sous le même titre.
          // Ce qui les commande n'est plus une halakha de bloc mais la
          // didascalie de la première, à l'endroit où on les dit.
          {
            seg: 4,
            rubric: R(
              "Les téfilines posés, on dit les deux parachiot. Qui n'en a pas le temps avant la prière les dit après, tant qu'il les porte encore :",
              "Once the tefillin are on, say the two passages. Whoever lacks the time before the prayer says them after, while still wearing them:",
              "אחר הנחת התפילין אומרים שתי פרשיות אלו. מי שלא הספיק קודם התפילה, אומרן אחריה בעוד התפילין עליו:",
            ),
          },
          { seg: 5 },
        ],
      },
      // Le léchem yi'houd, que la source place avant la 'Akéda : une intention,
      // pas un texte de l'office. Il reste en retrait, sans titre à lui, et
      // ne coupe pas le fil pour qui ne le dit pas.
      {
        src: "Morning Prayer",
        lines: [
          {
            seg: 2,
            mode: "small",
            muted: true,
            rubric: R(
              "Certains disent ici, avant la prière :",
              "Some say here, before the prayer:",
              "יש אומרים כאן קודם התפילה:",
            ),
          },
        ],
      },
      {
        src: "Morning Prayer",
        // La 'Akéda, l'acceptation du joug et les korbanot se lisent d'un
        // trait jusqu'à Hodou : un seul titre les porte, celui du premier.
        labelText: R("Korbanot", "Korbanot", "סדר הקרבנות"),
        lines: [
          { seg: 3 },
          { seg: 4 },
          { seg: 6, muted: true, rubric: RUBRIC.certains },
          { seg: 7 },
          { seg: 8 },
        ],
      },
      {
        src: "Morning Prayer",
        halakha: R(
          "Si l'on craint de dépasser l'heure du Chéma, on lit dès ici les trois paragraphes du Chéma, avec l'intention d'accomplir la mitsva.",
          "If the time of the Shema may pass, read all three paragraphs of the Shema here, intending to fulfill the mitzvah.",
          "אם רואה שזמן קריאת שמע עובר, יאמר כאן קריאת שמע כולה בכוונה.",
        ),
        lines: [
          { seg: 9 },
          { seg: 10 },
          { seg: 11 },
          { seg: 13, strong: true },
          {
            seg: 14,
            mode: "small",
            strip: ["ואומר בלחש"],
            rubric: RUBRIC.bassevoix,
            tight: true,
          },
          { seg: 15 },
          { seg: 16 },
          { seg: 17 },
        ],
      },
      {
        src: "Morning Prayer",
        lines: [{ seg: 18 }],
      },
      {
        src: "Incense Offering",
        lines: [
          // D'ici s'ouvre le parchemin du pitoum haketoret.
          { seg: 1, klaf: "ketoret" },
          { seg: 2 },
          { seg: 3 },
          { seg: 4 },
          { seg: 5 },
          { seg: 6 },
          { seg: 7 },
          { seg: 8 },
          {
            seg: 9,
            lead: true,
            rubric: R("Ana bekhoa'h, ligne à ligne :", "Ana bechoach, line by line:", "אנא בכח:"),
          },
          { seg: 10, tight: true },
          { seg: 11, tight: true },
          { seg: 12, tight: true },
          { seg: 13, tight: true },
          { seg: 14, tight: true },
          { seg: 15, tight: true },
          { seg: 17, rubric: RUBRIC.bassevoix, tight: true },
          { seg: 18 },
          { seg: 19 },
          { seg: 20 },
          { seg: 21 },
          { seg: 22 },
          { seg: 23 },
          { seg: 24 },
          { seg: 25 },
          { seg: 26 },
          { seg: 27 },
          { seg: 28 },
          { seg: 29 },
          { seg: 30 },
        ],
      },
      kaddishAlIsrael("Incense Offering", 32),
      {
        src: "Hodu",
        labelText: R("Hodou", "Hodu", "הודו"),
        lines: [{ seg: 1 }, { seg: 2 }, { seg: 3 }, { seg: 4 }, { seg: 5 }],
      },
      {
        src: "Hodu",
        // Les deux occasions où la source le demande, en deux blocs : elles
        // s'excluent (Hochana Rabba tombe le 21 Tichri), et une condition à
        // deux clés n'est pas lue par les versions publiées (voir condition).
        when: "teshuva",
        lines: [
          {
            seg: 7,
            mode: "small",
            strip: ["שתי פעמים"],
            repeat: 2,
            rubric: R(
              "Pendant les dix jours de techouva :",
              "During the Ten Days of Repentance:",
              "בעשרת ימי תשובה אומרים:",
            ),
          },
        ],
      },
      {
        src: "Hodu",
        when: "hoshana-rabba",
        lines: [
          {
            seg: 7,
            mode: "small",
            strip: ["שתי פעמים"],
            repeat: 2,
            rubric: R("À Hochana Rabba :", "On Hoshana Rabbah:", "בהושענא רבה אומרים:"),
          },
        ],
      },
      {
        src: "Hodu",
        lines: [
          {
            seg: 9,
            mode: "full",
            strip: ["שתי פעמים"],
            repeat: 2,
            rubric: RUBRIC.debout,
          },
          { seg: 10, tight: true },
          { seg: 11 },
          {
            seg: 14,
            // Le parchemin où le psaume est écrit en forme de menora.
            klaf: "menora",
            rubric: R(
              "Il est bon de dire ce psaume avec l'image de la menora :",
              "It is good to say this psalm picturing the menorah:",
              "טוב לומר מזמור זה בצורת המנורה:",
            ),
          },
        ],
      },
      {
        src: "Pesukei D'Zimra",
        labelText: R("Pessouké dezimra", "Pesukei dezimra", "פסוקי דזמרה"),
        halakha: HALAKHA.pessoukeDezimra,
        lines: [
          { seg: 1 },
          { seg: 2 },
          { seg: 4 },
          { seg: 5 },
          { seg: 6 },
          { seg: 7 },
          { seg: 8 },
          { seg: 9 },
          { seg: 10 },
          { seg: 11 },
          { seg: 12 },
          {
            seg: 14,
            until: "אתה־הוא יהוה האלהים",
            rubric: R("Debout :", "Standing:", "יאמר מעומד:"),
          },
          {
            seg: 14,
            from: "אתה־הוא יהוה האלהים",
            rubric: R(
              "On peut s'asseoir à partir d'ici :",
              "One may be seated from here:",
              "מכאן אפשר לשבת:",
            ),
            tight: true,
          },
          { seg: 15 },
          { seg: 16 },
          { seg: 17 },
          { seg: 18 },
        ],
      },
      {
        src: "Pesukei D'Zimra",
        when: "teshuva",
        lines: [{ seg: 20, mode: "small", rubric: RUBRIC.teshuvaOn }],
      },
      kaddishHalf("Uva LeSion"),
      {
        src: "Pesukei D'Zimra",
        labelText: R("Barékhou et le Chéma", "Barechu and the Shema", "ברכו וקריאת שמע"),
        lines: [
          {
            seg: 23,
            mode: "full",
            strip: ["ואומר החזן:"],
            rubric: RUBRIC.hazan,
          },
          {
            seg: 24,
            mode: "full",
            strip: ["ועונים הקהל:"],
            rubric: RUBRIC.kahal,
            tight: true,
          },
          {
            seg: 25,
            mode: "full",
            strip: ["ואומר החזן:"],
            rubric: RUBRIC.hazanReprend,
            tight: true,
          },
        ],
      },
      { zman: "shema" },
      {
        src: "The Shema",
        // Le titre est porté par Barékhou, qui l'ouvre trois lignes plus haut.
        halakha: HALAKHA.shemaMatin,
        lines: [
          { seg: 1 },
          { seg: 2 },
          {
            seg: 4,
            rubric: R(
              "La kedoucha de Yotser se dit assis :",
              "The Kedushah of Yotser is said seated:",
              "קדושת יוצר נאמרת מיושב:",
            ),
          },
          { seg: 5 },
          { seg: 6 },
          { seg: 7, tight: true },
          { seg: 8, tight: true },
          { seg: 10, strong: true },
          {
            seg: 11,
            mode: "small",
            strip: [STRIP.bassevoix],
            rubric: RUBRIC.bassevoix,
            tight: true,
          },
          { seg: 12 },
          { seg: 13 },
          { seg: 14 },
          { seg: 15, tight: true },
          { seg: 16 },
          { seg: 17 },
          { seg: 18 },
          {
            seg: 20,
            rubric: R(
              "On se lève à « Tehilot » :",
              "Rise at “Tehilot”:",
              "בתחילת מלת תהלות יקום לעמוד:",
            ),
          },
        ],
      },
      { zman: "amida" },
      ...amida,
      avinouMalkenou("Amida", 74, 105),
      // Le tahanoun ordinaire. Les jours de jeûne public (Tich'a beAv à
      // part), les sli'hot du jeûne prennent sa place : voir selihotTsomBlocks.
      {
        src: "Vidui",
        // « tahanoun », la clé de toujours, et non « tahanoun-ordinaire » qui
        // dit la même chose : les versions publiées ne connaissent pas la
        // seconde et perdraient le tahanoun tout entier (voir condition).
        when: "tahanoun",
        unless: "selihot-tsom",
        plain: true,
        labelText: R("Ta'hanoun (supplications)", "Tachanun (supplications)", "תחנון"),
        halakha: HALAKHA.tahanoun,
        lines: [
          { seg: 1 },
          { seg: 2 },
          { seg: 3 },
          { seg: 4 },
          { seg: 6, rubric: RUBRIC.assis },
          { seg: 7 },
          { seg: 8 },
          { seg: 9 },
        ],
      },
      {
        src: "Vidui",
        when: "tahanoun-lundi-jeudi",
        plain: true,
        labelText: R(
          "Supplications du lundi et du jeudi",
          "Monday and Thursday supplications",
          "תחנונים לשני וחמישי",
        ),
        lines: [
          {
            seg: 14,
            rubric: R("On ajoute :", "Add:", "מוסיפים:"),
          },
          { seg: 15 },
          { seg: 16 },
          { seg: 17 },
          { seg: 18 },
          { seg: 19 },
          { seg: 20 },
          { seg: 21 },
          { seg: 22 },
          { seg: 23 },
          { seg: 24 },
          { seg: 25 },
          { seg: 26 },
          { seg: 27 },
          { seg: 28 },
          { seg: 29 },
          { seg: 30 },
          { seg: 31 },
          { seg: 32 },
        ],
      },
      ...selihotTsomBlocks(),
      // Les jours sans tahanoun, « Yehi chem » tient sa place : le passage
      // n'est pas sauté, il change de texte.
      {
        src: "Amida",
        when: "sans-tahanoun",
        plain: true,
        lines: [{ seg: 107 }],
      },
      // Et le demi-Kaddich vient après, quel que soit le jour : après le
      // tahanoun, après les supplications du lundi et du jeudi, ou après
      // « Yehi chem ». Un seul bloc suffit donc, sans condition.
      kaddishHalf("Uva LeSion"),
      // Ce qui se dit avant de prendre le loulav, puis ses brahot, avant le
      // Hallel : c'est là qu'on prend les quatre espèces, et c'est pendant le
      // Hallel qu'on les agite. Le même texte a sa page dans le livre Moadim
      // (build-moadim.mjs) ; il est écrit une seule fois, dans
      // scripts/lib/loulav.mjs.
      {
        when: "loulav",
        plain: true,
        labelText: R("Avant de prendre le loulav", "Before taking the lulav", "קודם נטילת לולב"),
        halakha: HALAKHA_AVANT_LOULAV,
        lines: LIGNES_AVANT_LOULAV,
      },
      {
        when: "loulav",
        plain: true,
        // Le cadran des six côtés, comme à la page du livre Moadim.
        naanouim: true,
        labelText: R("Les brahot du loulav", "The lulav blessings", "ברכות הלולב"),
        halakha: HALAKHA_LOULAV,
        lines: LIGNES_LOULAV,
      },
      {
        src: "RH.Hallel",
        when: "hallel",
        plain: true,
        labelText: R("Hallel", "Hallel", "הלל"),
        halakha: HALAKHA.hallel,
        lines: [
          { seg: 5 },
          { seg: 6 },
          // Lo lanou et Ahavti font la différence entre le Hallel entier et
          // l'abrégé : entier à 'Hanouka et à 'Hol haMoed de Souccot, abrégé
          // à Roch Hodech et à 'Hol haMoed de Pessah. Les deux formes sont
          // dans le fichier, le jour choisit.
          {
            // Les deux passages vivent entiers dans un <small> : la source les
            // met en retrait puisqu'on les saute la plupart du temps.
            seg: 8,
            mode: "small",
            when: "hallel-complet",
            rubric: R(
              "On dit le Hallel en entier :",
              "The whole Hallel is said:",
              "גומרים את ההלל:",
            ),
          },
          { seg: 9, when: "hallel-complet", tight: true },
          {
            seg: 9,
            when: "hallel-abrege",
            rubric: R("On saute « לֹא לָנוּ » :", "Skip “Lo lanu”:", "מדלגים « לֹא לָנוּ »:"),
          },
          { seg: 11, mode: "small", when: "hallel-complet" },
          { seg: 12, when: "hallel-complet", tight: true },
          {
            seg: 12,
            when: "hallel-abrege",
            rubric: R("On saute « אָהַבְתִּי » :", "Skip “Ahavti”:", "מדלגים « אָהַבְתִּי »:"),
          },
          { seg: 13 },
          // Le premier « Hodou » : c'est là que le loulav s'agite, un côté
          // par mot. La didascalie n'entre dans le paragraphe que les jours
          // où on le porte ; le verset y reste sans condition.
          { parts: [{ rubric: RUBRIC_NAANOUIM_HODOU, when: "loulav" }, { seg: 14 }] },
          { seg: 15, tight: true },
          { seg: 16, tight: true },
          { seg: 17, tight: true },
          { seg: 18 },
          // « Ana Hachem hochia na » : une syllabe par côté, puis on se
          // tourne vers la droite et l'on recommence. La consigne ferme le
          // paragraphe d'avant plutôt que d'ouvrir le sien, qui porte deux
          // fois le verset : elle vaut pour les deux.
          {
            parts: [{ seg: 19, mode: "full" }, { rubric: RUBRIC_NAANOUIM_ANA, when: "loulav" }],
          },
          // La source écrit déjà chaque verset deux fois : c'est ce que dit
          // chacun (le 'hazan le dit, l'assemblée le redit, deux fois chacun).
          // Un « × 2 » par-dessus le ferait lire quatre fois.
          { seg: 20 },
          { seg: 21, tight: true },
          // Le « Hodou » de la fin, où l'on agite une dernière fois : la
          // didascalie se glisse devant lui, au milieu du paragraphe, et une
          // seule fois, bien que le verset se redise.
          {
            parts: [
              { seg: 22, mode: "full", until: "הודו ליהוה כי־טוב" },
              { rubric: RUBRIC_NAANOUIM_HODOU_FIN, when: "loulav" },
              { seg: 22, mode: "full", from: "הודו ליהוה כי־טוב" },
            ],
          },
          // « Yehalelou'ha », la bénédiction qui ferme le Hallel. Elle ne se
          // dit que les jours où on le dit en entier : la source l'écrit en
          // toutes lettres au-dessus d'elle (« בימים שאין גומרים את ההלל אין
          // אומרים »), et c'est à 'Hanouka et à 'Hol haMoed de Souccot qu'on
          // le termine.
          {
            // La source la met tout entière en retrait, puisqu'on la saute
            // la plupart du temps : c'est le petit corps qu'on prend ici.
            seg: 24,
            mode: "small",
            when: "hallel-complet",
            rubric: R(
              "Le Hallel dit en entier, on le ferme par cette bénédiction :",
              "When the whole Hallel is said, it closes with this blessing:",
              "בימים שגומרים את ההלל חותמים:",
            ),
          },
        ],
      },
      // Le Hallel fini, le 'hazan dit le Kaddich Titkabal : « que soient
      // reçues nos prières ». Roch Hodech ne dit pas la bénédiction finale
      // « Yehalelou'ha » (le Hallel y est abrégé), mais le Kaddich, lui, se
      // dit entier.
      kaddishTitkabal("RH.Hallel", { seg: 26, when: "rosh-chodesh" }),
      // Les Hochanot, entre le Hallel et le Kaddich Titkabal : on sort le
      // séfer Torah, on le pose sur la téva et l'on en fait le tour, loulav
      // en main. Leur texte, une page par jour, vit dans le livre Moadim
      // (build-moadim.mjs) : il pèse près de 300 Ko, qui n'ont rien à faire
      // dans l'office de tous les jours. Le bloc en donne le premier verset,
      // commun à tous les jours, et dit où lire la suite. La clé « loulav »
      // est celle des jours où l'office de semaine les dit : 'Hol haMoed de
      // Souccot, hors Chabbat, où l'on ne fait pas le tour.
      {
        when: "loulav",
        plain: true,
        labelText: R("Les Hochanot", "The Hoshanot", "הושענות"),
        halakha: R(
          "On sort un séfer Torah et on le pose sur la téva. Loulav en main, on en fait le tour en disant les Hochanot du jour : une fois chaque jour, sept fois à Hochana Rabba, et deux fois le dimanche qui suit un Chabbat, où l'on n'a pas fait le tour. Leur texte est dans le livre Moadim, sous Souccot, une page par jour.",
          "A Torah scroll is taken out and placed on the teva. Lulav in hand, one circles it while saying the Hoshanot of the day: once each day, seven times on Hoshana Rabba, and twice on the Sunday after a Shabbat, when no circuit was made. Their text is in the Moadim book, under Sukkot, one page for each day.",
          "מוציאים ספר תורה ומניחים אותו על התיבה, ומקיפים את התיבה עם הלולב ואומרים ההושענות של אותו היום: פעם אחת בכל יום, שבע פעמים בהושענא רבה, ושתי הקפות ביום ראשון שלאחר השבת. ההושענות בספר המועדים, בסוכות.",
        ),
        lines: [
          { he: "אֶרְחַץ בְּנִקָּיוֹן כַּפָּי, וַאֲסוֹבְבָה אֶת־מִזְבַּחֲךָ יְהֹוָה:" },
          { he: "הוֹשַׁעֲנָא. הוֹשַׁעֲנָא:", tight: true },
        ],
      },
      // À 'Hol haMoed de même, le Titkabal entier : la source ne fait
      // exception que pour 'Hanouka. Deux blocs plutôt qu'une condition à
      // deux clés, les deux jours s'excluant (voir
      // docs/compatibilite-textes.md).
      kaddishTitkabal("RH.Hallel", { seg: 26, when: "hol-hamoed" }),
      // À 'Hanouka la source ne veut qu'un demi-Kaddich : la lecture de la
      // Torah vient juste après, et le Titkabal attendra Ouva letsion.
      // À Roch Hodech Tévet, qui tombe dans 'Hanouka, c'est l'ordre de Roch
      // Hodech qui vaut : le Titkabal au-dessus, puis sa lecture, avec le
      // nassi du jour en quatrième montée (voir plus bas). Les versions
      // publiées ignorent `unless` et gardent l'ancien affichage.
      kaddishHalf("RH.Hallel", { seg: 26, when: "hanouka", unless: "rosh-chodesh" }),
      // La lecture de la Torah de 'Hanouka : trois montées dans la paracha
      // Nasso, le passage du nassi du jour. Un bloc par jour, un seul
      // s'affiche.
      {
        src: "Hanouka.Shaharit",
        when: "hanouka",
        unless: "rosh-chodesh",
        plain: true,
        labelText: R("Lecture de la Torah", "Torah reading", "קריאת התורה"),
        lines: [
          {
            seg: 2,
            mode: "full",
            rubric: R("L'ordre du jour :", "The order of the day:", "דיני שחרית לחנוכה:"),
            muted: true,
          },
        ],
      },
      {
        src: "Hanouka.Shaharit",
        when: "hanouka-1",
        plain: true,
        lines: [
          { seg: 5, until: "ויהי ביום כלות", rubric: R("Cohen :", "Kohen:", "כהן:") },
          { he: VESSAMOU, tight: true },
          { seg: 5, from: "ויהי ביום כלות", until: HANOUKA_1_LEVI, tight: true },
          {
            seg: 5,
            from: HANOUKA_1_LEVI,
            until: HANOUKA_1_ISRAEL,
            rubric: R("Lévi :", "Levi:", "לוי:"),
          },
          { seg: 5, from: HANOUKA_1_ISRAEL, rubric: R("Israël :", "Yisrael:", "ישראל:") },
        ],
      },
      {
        src: "Hanouka.Shaharit",
        when: "hanouka-2",
        unless: "rosh-chodesh",
        plain: true,
        lines: [{ seg: 8, mode: "full" }],
      },
      {
        src: "Hanouka.Shaharit",
        when: "hanouka-3",
        unless: "rosh-chodesh",
        plain: true,
        lines: [{ seg: 10, mode: "full" }],
      },
      {
        src: "Hanouka.Shaharit",
        when: "hanouka-4",
        unless: "rosh-chodesh",
        plain: true,
        lines: [{ seg: 12, mode: "full" }],
      },
      {
        src: "Hanouka.Shaharit",
        when: "hanouka-5",
        unless: "rosh-chodesh",
        plain: true,
        lines: [{ seg: 14, mode: "full" }],
      },
      {
        src: "Hanouka.Shaharit",
        when: "hanouka-6",
        unless: "rosh-chodesh",
        plain: true,
        lines: [{ seg: 16, mode: "full" }],
      },
      {
        src: "Hanouka.Shaharit",
        when: "hanouka-7",
        unless: "rosh-chodesh",
        plain: true,
        lines: [{ seg: 18, mode: "full" }],
      },
      {
        src: "Hanouka.Shaharit",
        when: "hanouka-8",
        unless: "rosh-chodesh",
        plain: true,
        lines: [{ seg: 21, mode: "full" }],
      },
      // Pourim : trois montées dans « Vayavo Amalek », après le demi-Kaddich
      // qui suit la 'Amida.
      {
        src: "Pourim.Jour",
        when: "pourim",
        plain: true,
        labelText: R("Lecture de la Torah", "Torah reading", "קריאת התורה"),
        lines: [
          {
            seg: 1,
            mode: "full",
            muted: true,
            rubric: R("L'ordre du jour :", "The order of the day:", "סדר יום פורים:"),
          },
          ...POURIM_MONTEES.map((montee) => ({
            seg: 2,
            from: montee.from,
            until: montee.until,
            rubric: R(`${montee.fr} :`, `${montee.en}:`, `${montee.he}:`),
          })),
        ],
      },
      {
        src: "RH.Hallel",
        when: "rosh-chodesh",
        plain: true,
        labelText: R("Lecture de la Torah", "Torah reading", "קריאת התורה"),
        lines: [
          {
            seg: 35,
            rubric: R("On dit d'abord :", "First, say:", "תחילה אומרים:"),
          },
          {
            seg: 37,
            rubric: R(
              "On ouvre le hékhal et l'on dit :",
              "The ark is opened and one says:",
              "פותחים ההיכל ואומרים:",
            ),
          },
          {
            seg: 39,
            unless: "hanouka",
            rubric: R(
              "On lit quatre montées dans la paracha des moussafim (Bamidbar 28) :",
              "Four aliyot are read from the portion of the musaf offerings (Numbers 28):",
              "מוציאים ספר תורה וקוראים ארבעה עולים (במדבר כח):",
            ),
          },
        ],
      },
      // Roch Hodech Tévet, dans 'Hanouka : trois montées de Roch Hodech
      // (Bamidbar 28, 1 à 5, 6 à 10, 11 à 15), sans la reprise du verset 3
      // qui ne sert qu'à en faire quatre, puis le nassi du jour de 'Hanouka
      // en quatrième montée (Choul'han Aroukh, Ora'h 'Hayim 684, 3). Une clé
      // nouvelle pour du contenu nouveau : les versions publiées n'affichent
      // rien de plus qu'avant (voir docs/compatibilite-textes.md).
      {
        src: "RH.Hallel",
        when: "rosh-chodesh-hanouka",
        plain: true,
        lines: [
          {
            seg: 39,
            until: "ואמרת להם",
            rubric: R(
              "À Roch Hodech Tévet, on lit trois montées dans la paracha des moussafim (Bamidbar 28), puis une quatrième dans celle de 'Hanouka. Cohen :",
              "On Rosh Chodesh Tevet, three aliyot are read from the portion of the musaf offerings (Numbers 28), then a fourth from the Hanukkah reading. Kohen:",
              "בראש חודש טבת קוראים שלושה עולים בפרשת המוספים (במדבר כח), והרביעי בקריאת חנוכה. כהן:",
            ),
          },
          { seg: 39, from: "ואמרת להם", until: "ואמרת להם", tight: true },
          { seg: 39, from: "את־הכבש אחד", until: "עלת תמיד העשיה", tight: true },
          {
            seg: 39,
            from: "עלת תמיד העשיה",
            until: "ובראשי חדשיכם",
            rubric: R("Lévi :", "Levi:", "לוי:"),
          },
          { seg: 39, from: "ובראשי חדשיכם", rubric: R("Israël :", "Yisrael:", "ישראל:") },
        ],
      },
      {
        src: "Hanouka.Shaharit",
        when: "rosh-chodesh-hanouka",
        plain: true,
        lines: [
          {
            seg: 16,
            mode: "full",
            when: "hanouka-6",
            rubric: R("Quatrième montée, 'Hanouka :", "Fourth aliyah, Hanukkah:", "רביעי, חנוכה:"),
          },
          {
            seg: 18,
            mode: "full",
            when: "hanouka-7",
            rubric: R("Quatrième montée, 'Hanouka :", "Fourth aliyah, Hanukkah:", "רביעי, חנוכה:"),
          },
        ],
      },
      // La lecture close, le dernier appelé dit le demi-Kaddich, avant qu'on
      // ne rapporte le séfer Torah.
      kaddishHalf("RH.Hallel", {
        seg: 41,
        when: "rosh-chodesh",
        labelText: R(
          "Demi-Kaddich (le dernier appelé)",
          "Half Kaddish (the last one called up)",
          "חצי קדיש (העולה האחרון)",
        ),
        rubric: R("Le dernier appelé dit :", "The last one called up says:", "העולה האחרון אומר:"),
      }),
      // La lecture de la Torah de 'Hol haMoed. Le siddour de la source ne
      // porte pas ses passages : il n'a que celui de Roch Hodech (Bamidbar
      // 28), ceux de 'Hanouka et celui de Pourim. Le bloc donne donc ce qui
      // l'entoure, et la halakha dit ce qui se lit. Quatre montées, comme à
      // Roch Hodech.
      {
        src: "RH.Hallel",
        when: "hol-hamoed",
        plain: true,
        labelText: R("Lecture de la Torah", "Torah reading", "קריאת התורה"),
        halakha: [
          R(
            "On sort un séfer Torah et l'on y lit quatre montées. À 'Hol haMoed de Souccot, les korbanot du jour (Bamidbar 29) ; à 'Hol haMoed de Pessah, le passage propre à chaque jour.",
            "A Torah scroll is taken out and four aliyot are read from it. On Chol HaMoed Sukkot, the offerings of the day (Numbers 29); on Chol HaMoed Pesach, the passage proper to each day.",
            "מוציאים ספר תורה וקוראים ארבעה עולים. בחול המועד סוכות בקרבנות היום (במדבר כט), ובחול המועד פסח בפרשה של כל יום ויום.",
          ),
          // À Souccot, le séfer est déjà sorti pour les Hochanot : les dinim
          // du sidour (page 674) disent « Brikh chmeh » près de lui.
          {
            ...R(
              "À Souccot, le séfer Torah est déjà sur la téva depuis les Hochanot : on n'ouvre pas le hékhal, on dit « Brikh chmeh » près du séfer.",
              "On Sukkot the Torah scroll is already on the teva since the Hoshanot: the ark is not opened, and “Brich shmeh” is said beside the scroll.",
              'ובחוה"מ סוכות שמוציאים רק ס"ת אחד, יאמר בריך שמיה אחר ההושענות ליד הס"ת שבתיבה.',
            ),
            when: "loulav",
          },
        ],
        lines: [
          {
            seg: 35,
            rubric: R("On dit d'abord :", "First, say:", "תחילה אומרים:"),
          },
          {
            seg: 37,
            rubric: R(
              "On ouvre le hékhal et l'on dit :",
              "The ark is opened and one says:",
              "פותחים ההיכל ואומרים:",
            ),
          },
        ],
      },
      // Les korbanot du jour, à 'Hol haMoed de Souccot. Un bloc par jour,
      // comme à 'Hanouka ; dans chacun, la répartition d'Erets Israël et
      // celle de la diaspora, que le sidour donne l'une après l'autre :
      // quatre appelés sur le passage du jour en Terre d'Israël ; en diaspora,
      // où l'on doute encore de la date, le cohen lit la veille, le lévi et le
      // troisième le jour, et le quatrième les deux. Le deuxième jour n'est
      // 'Hol haMoed qu'en Terre d'Israël : il n'a que sa répartition.
      ...[2, 3, 4, 5, 6, 7].map((jour) => ({
        when: `souccot-${jour}`,
        plain: true,
        lines: [
          {
            he: korbanotSouccot(jour),
            when: "eretz-israel",
            rubric: R(
              "En Erets Israël, les quatre appelés lisent chacun ce passage :",
              "In Eretz Israel, each of the four called up reads this passage:",
              "בארץ ישראל עולים ארבעה אנשים, וכל אחד קורא:",
            ),
          },
          ...(jour === 2
            ? []
            : [
                {
                  he: korbanotSouccot(jour - 1),
                  when: "houts-laarets",
                  rubric: R(
                    "Hors d'Israël, le cohen lit :",
                    "Outside Israel, the kohen reads:",
                    'ובחו"ל, הכהן קורא:',
                  ),
                },
                {
                  he: korbanotSouccot(jour),
                  when: "houts-laarets",
                  rubric: R(
                    "Le lévi lit, et le troisième appelé relit après lui :",
                    "The levi reads, and the third one called up reads it again:",
                    "הלוי קורא, והשלישי חוזר:",
                  ),
                },
                {
                  he: `${korbanotSouccot(jour - 1)} ${korbanotSouccot(jour)}`,
                  when: "houts-laarets",
                  rubric: R(
                    "Le quatrième appelé lit les deux :",
                    "The fourth one called up reads both:",
                    "הרביעי קורא שניהם:",
                  ),
                },
              ]),
        ],
      })),
      kaddishHalf("RH.Hallel", {
        seg: 41,
        when: "hol-hamoed",
        labelText: R(
          "Demi-Kaddich (le dernier appelé)",
          "Half Kaddish (the last one called up)",
          "חצי קדיש (העולה האחרון)",
        ),
        rubric: R("Le dernier appelé dit :", "The last one called up says:", "העולה האחרון אומר:"),
      }),
      // La sortie du séfer Torah : le lundi et le jeudi ordinaires, et les
      // jours de jeûne public. Deux blocs plutôt qu'une alternative dans la
      // condition : les deux jours s'excluent, et une condition à deux clés
      // n'est pas lue par les versions publiées (voir condition).
      sortieSeferTorah({
        when: "torah-semaine",
        tahanoun: "tahanoun",
        sansTahanoun: "sans-tahanoun",
        halakha: HALAKHA.torahSemaine,
      }),
      sortieSeferTorah({
        when: "taanit",
        tahanoun: "tahanoun",
        sansTahanoun: "sans-tahanoun",
        halakha: { ...HALAKHA.vayehal, when: "selihot-tsom" },
      }),
      {
        when: "torah-semaine",
        plain: true,
        torahWeekly: true,
      },
      // Les jeûnes publics : « Vaye'hal Moché », trois montées, le matin
      // comme l'après-midi. Sauf le matin de Tich'a beAv, qui lit « Ki tolid
      // banim » (Devarim 4, 25 à 40) : la source ne le porte pas, il vient du
      // fichier de la paracha Vaét'hanan que l'application sert déjà.
      vayehalBlock("selihot-tsom"),
      {
        when: "tisha-beav",
        plain: true,
        lines: [
          {
            he: KI_TOLID_BANIM,
            rubric: R(
              "Le matin de Tich'a beAv, on lit « Ki tolid banim » (Devarim 4, 25 à 40), en trois montées, puis la haftara « Assof assifem » (Yirmiya 8, 13 à 9, 23) :",
              "On the morning of Tisha b'Av, “Ki tolid banim” (Deuteronomy 4:25-40) is read in three aliyot, then the haftarah “Asof asifem” (Jeremiah 8:13-9:23):",
              "בשחרית של תשעה באב קוראים « כי תוליד בנים » (דברים ד, כה-מ) בשלושה עולים, ומפטירים « אסוף אסיפם » (ירמיה ח, יג - ט, כג):",
            ),
          },
        ],
      },
      benedictionApresLecture("torah-semaine"),
      benedictionApresLecture("taanit"),
      kaddishHalf("Uva LeSion", {
        when: "torah-semaine",
        labelText: R(
          "Demi-Kaddich (le dernier appelé)",
          "Half Kaddish (the last one called up)",
          "חצי קדיש (העולה האחרון)",
        ),
        rubric: R("Le dernier appelé dit :", "The last one called up says:", "העולה האחרון אומר:"),
      }),
      kaddishHalf("Uva LeSion", {
        when: "taanit",
        labelText: R(
          "Demi-Kaddich (le dernier appelé)",
          "Half Kaddish (the last one called up)",
          "חצי קדיש (העולה האחרון)",
        ),
        rubric: R("Le dernier appelé dit :", "The last one called up says:", "העולה האחרון אומר:"),
      }),
      {
        src: "Ashrei",
        labelText: R("Achré", "Ashrei", "אשרי"),
        lines: [{ seg: 1 }, { seg: 2 }, { seg: 3 }],
      },
      {
        src: "Ashrei",
        when: "tahanoun",
        plain: true,
        lines: [{ seg: 5 }],
      },
      {
        src: "Uva LeSion",
        halakha: R(
          "Dans la kedoucha de Ouva letsion, les versets se disent à voix haute, leur targoum (araméen) à voix basse.",
          "In the Kedushah of Uva letzion, the verses are said aloud and their Aramaic Targum in an undertone.",
          "בקדושת ובא לציון אומרים את הפסוקים בקול רם ואת התרגום בלחש.",
        ),
        lines: [
          { seg: 1, until: "וקרא זה אל־זה" },
          {
            seg: 1,
            from: "וקרא זה אל־זה",
            until: "ומקבלין דין מן דין",
            rubric: RUBRIC.hautevoix,
            tight: true,
          },
          {
            seg: 1,
            from: "ומקבלין דין מן דין",
            until: "ותשאני רוח",
            rubric: RUBRIC.bassevoix,
            tight: true,
          },
          {
            seg: 1,
            from: "ותשאני רוח",
            until: "ונטלתני רוחא",
            rubric: RUBRIC.hautevoix,
            tight: true,
          },
          {
            seg: 1,
            from: "ונטלתני רוחא",
            until: "יהוה ׀ ימלך",
            rubric: RUBRIC.bassevoix,
            tight: true,
          },
          {
            seg: 1,
            from: "יהוה ׀ ימלך",
            until: "יהוה מלכותיה קאים",
            rubric: RUBRIC.hautevoix,
            tight: true,
          },
          {
            seg: 1,
            from: "יהוה מלכותיה קאים",
            until: "יהוה אלהי אברהם",
            rubric: RUBRIC.bassevoix,
            tight: true,
          },
          { seg: 1, from: "יהוה אלהי אברהם", tight: true },
          { seg: 2 },
        ],
      },
      kaddishTitkabal("Uva LeSion"),
      {
        src: "Uva LeSion",
        when: "sefer-torah",
        plain: true,
        lines: [
          {
            seg: 9,
            mode: "small",
            rubric: R(
              "Quand on rapporte le séfer Torah :",
              "As the Torah scroll is returned:",
              "כשמחזירים ספר תורה:",
            ),
          },
        ],
      },
      {
        src: "Beit Yaakov",
        when: "tahanoun",
        plain: true,
        lines: [{ seg: 2 }],
      },
      {
        src: "Beit Yaakov",
        lines: [{ seg: 3 }, { seg: 4 }],
      },
      ...chirJours,
      ...chirDates,
      chirAvel,
      {
        lines: [{ he: HOSHIENU }],
      },
      kaddishYeheChelama("Song of the Day", 28),
      {
        src: "RH.Mussaf",
        when: "rosh-chodesh",
        plain: true,
        kotel: true,
        labelText: R("Moussaf", "Musaf", "מוסף"),
        halakha: R(
          "On garde dans Moussaf la mention de la saison (morid hatal en été, machiv haroua'h oumorid haguéchem en hiver).",
          "The seasonal mention is kept in Musaf (morid hatal in summer, mashiv haruach umorid hageshem in winter).",
          "מזכירים במוסף את העונה (מוריד הטל בקיץ, משיב הרוח ומוריד הגשם בחורף).",
        ),
        lines: [
          { seg: 2 },
          { seg: 3 },
          // Guevourot d'un seul tenant, la mention de la saison à sa place,
          // comme dans la 'Amida de semaine.
          {
            parts: [
              { seg: 4 },
              { he: "מוֹרִיד הַטָּל.", when: "ete" },
              { he: "מַשִּׁיב הָרֽוּחַ וּמוֹרִיד הַגֶּֽשֶׁם.", when: "hiver" },
              { seg: 6 },
            ],
          },
        ],
      },
      {
        src: "RH.Mussaf",
        when: "rosh-chodesh",
        fold: "hazan",
        labelText: R(
          "Kedoucha de Moussaf (Keter)",
          "Kedushah of Musaf (Keter)",
          "כתר (קדושת מוסף)",
        ),
        lines: [
          {
            seg: 7,
            mode: "small",
            rubric: R("Pendant la répétition :", "During the repetition:", "בחזרה:"),
          },
        ],
      },
      {
        src: "RH.Mussaf",
        when: "rosh-chodesh",
        plain: true,
        lines: [
          { seg: 8 },
          { seg: 9 },
          { seg: 10 },
          { seg: 11 },
          { seg: 12 },
          { seg: 13 },
          { seg: 15 },
          { seg: 20 },
          { seg: 34 },
          { seg: 35 },
          { seg: 36 },
          { seg: 38, tight: true },
          { seg: 39 },
        ],
      },
      // Le Moussaf de 'Hol haMoed. Les jours intermédiaires ont leur Moussaf
      // comme les jours de fête, et c'est la même 'Amida : la source la donne
      // une fois pour les trois régalim, avec ses variantes en petit corps
      // (« בשבת », « ביו"ט מוסיף »). On prend donc le segment sans ses petits
      // corps, et il reste exactement ce qui se dit un jour de 'Hol haMoed ;
      // la fête, elle, se nomme, et deux fragments s'en chargent.
      {
        src: "Regalim.Mussaf",
        when: "hol-hamoed",
        plain: true,
        kotel: true,
        labelText: R("Moussaf", "Musaf", "מוסף"),
        halakha: R(
          "On garde dans Moussaf la mention de la saison (morid hatal en été, machiv haroua'h oumorid haguéchem en hiver).",
          "The seasonal mention is kept in Musaf (morid hatal in summer, mashiv haruach umorid hageshem in winter).",
          "מזכירים במוסף את העונה (מוריד הטל בקיץ, משיב הרוח ומוריד הגשם בחורף).",
        ),
        lines: [
          { seg: 1 },
          { seg: 2 },
          // Guevourot d'un seul tenant, la mention de la saison à sa place,
          // comme dans la 'Amida de semaine et dans le Moussaf de Roch
          // Hodech : la source met les deux mentions dans un même segment,
          // chacune derrière sa consigne.
          {
            parts: [
              { seg: 3 },
              { he: "מוֹרִיד הַטָּל.", when: "ete" },
              { he: "מַשִּׁיב הָרֽוּחַ וּמוֹרִיד הַגֶּֽשֶׁם.", when: "hiver" },
              { seg: 5 },
            ],
          },
        ],
      },
      // Le Keter de 'Hol haMoed, que la source distingue de celui de Yom Tov
      // et de Chabbat : « וְעַמְּךָ יִשְׂרָאֵל » là où les jours de fête disent
      // « עִם עַמְּךָ יִשְׂרָאֵל ». C'est le segment 9, non le 7.
      {
        src: "Regalim.Mussaf",
        when: "hol-hamoed",
        fold: "hazan",
        labelText: R(
          "Kedoucha de Moussaf (Keter)",
          "Kedushah of Musaf (Keter)",
          "כתר (קדושת מוסף)",
        ),
        lines: [
          {
            seg: 9,
            mode: "small",
            rubric: R("Pendant la répétition :", "During the repetition:", "בחזרה:"),
          },
        ],
      },
      {
        src: "Regalim.Mussaf",
        when: "hol-hamoed",
        plain: true,
        lines: [
          { seg: 10 },
          { seg: 11 },
          // La fête nommée, deux fois : dans « Vatitèn lanou », puis dans
          // « Ètt moussaf ». Le début et la fin de chaque paragraphe se
          // disent tous les jours de 'Hol haMoed ; seul le nom change, et il
          // porte sa clé. Un paragraphe garde ainsi de l'hébreu sans
          // condition (voir docs/compatibilite-textes.md).
          {
            parts: [
              { seg: 12 },
              { seg: 16, when: "sukkot" },
              { seg: 14, when: "pesach" },
              { seg: 18 },
            ],
          },
          { seg: 19 },
          { seg: 20 },
          {
            parts: [
              { seg: 21 },
              { seg: 24, when: "sukkot" },
              { seg: 22, when: "pesach" },
              { seg: 26 },
            ],
          },
          { seg: 27 },
          { seg: 28 },
          { seg: 31 },
          { seg: 32 },
          { seg: 34 },
        ],
      },
      // Modim dérabanan, ce que l'assemblée dit pendant que le 'hazan dit
      // Modim : la source le donne en petit corps, sa consigne collée au
      // texte, comme dans la 'Amida de semaine.
      {
        src: "Regalim.Mussaf",
        when: "hol-hamoed",
        fold: "hazan",
        labelText: R("Modim dérabanan", "Modim derabanan", "מודים דרבנן"),
        lines: [
          {
            seg: 35,
            mode: "small",
            strip: [
              "מודים דרבנן",
              'בחזרת הש"ץ כשהחזן אומר מודים, הקהל אומרים:',
              "בחזרת הש״ץ כשהחזן אומר מודים, הקהל אומרים:",
            ],
            rubric: R(
              "Pendant la répétition, quand le 'hazan dit Modim, l'assemblée dit :",
              "During the repetition, as the chazan says Modim, the congregation says:",
              "בחזרת הש״ץ, כשהחזן אומר מודים, הקהל אומרים:",
            ),
          },
        ],
      },
      {
        src: "Regalim.Mussaf",
        when: "hol-hamoed",
        plain: true,
        lines: [{ seg: 36 }],
      },
      // Birkat kohanim, dans la répétition, entre « Vé'al koulam » et Sim
      // chalom : les cohanim la disent à Moussaf, et sans eux le 'hazan dit
      // « Élohénou… barkhénou ». Mêmes repères que dans la 'Amida de semaine.
      birkatKohanimBlock(
        "Regalim.Mussaf",
        { bracha: 40, versets: [42, 43, 44], hazan: 46, versetsHazan: [47, 48, 49] },
        { when: "hol-hamoed" },
      ),
      {
        src: "Regalim.Mussaf",
        when: "hol-hamoed",
        plain: true,
        lines: [
          { seg: 50 },
          { seg: 51, tight: true },
          { seg: 52 },
          { seg: 54, tight: true },
          { seg: 55 },
          { seg: 56 },
        ],
      },
      // La fin de l'office de 'Hol haMoed, dans l'ordre que la source donne
      // après la répétition (« בחול המועד אחרי החזרה אומרים יהי שם, ואחריו
      // אומר הש"ץ קדיש תתקבל ואומרים המזמור השייך לאותו יום טוב, וקדיש יהא
      // שלמא וקוה עד הסוף ») : « Yehi chem », le Kaddich Titkabal qui ferme
      // Moussaf, le psaume de la fête, le Kaddich yehé chelama, puis Kavé.
      {
        src: "Amida",
        when: "hol-hamoed",
        plain: true,
        lines: [{ seg: 107 }],
      },
      kaddishTitkabal("RH.Hallel", { seg: 26, when: "hol-hamoed" }),
      // Le psaume de la fête : le 42 à Souccot, le 107 à Pessah. Un bloc par
      // fête, chacun sous sa clé, la ligne seule portant la condition.
      {
        src: "Regalim.ChirSouccot",
        when: "hol-hamoed",
        plain: true,
        lines: [
          {
            seg: 1,
            when: "sukkot",
            rubric: R("Le psaume de Souccot :", "The psalm of Sukkot:", "מזמור לסוכות:"),
          },
        ],
      },
      {
        src: "Regalim.ChirPessah",
        when: "hol-hamoed",
        plain: true,
        lines: [
          {
            seg: 1,
            when: "pesach",
            rubric: R("Le psaume de Pessa'h :", "The psalm of Pesach:", "מזמור לפסח:"),
          },
        ],
      },
      { ...kaddishYeheChelama("Song of the Day", 28), when: "hol-hamoed" },
      {
        src: "RH.Barchi Nafshi",
        when: "rosh-chodesh",
        plain: true,
        // Une ligne dans le fil : pas de titre, le menu n'a rien à y jeter.
        lines: [{ seg: 2 }],
      },
      {
        src: "Kaveh",
        labelText: R("Kavé · Ein kélohénou", "Kaveh · Ein keloheinu", "קוה · אין כאלהינו"),
        lines: [
          { seg: 1 },
          { seg: 2 },
          // Le pitoum haketoret se redit ici : même parchemin.
          { seg: 4, klaf: "ketoret" },
          { seg: 5 },
          { seg: 6 },
          { seg: 7 },
          { seg: 8 },
          { seg: 9 },
          { seg: 10 },
          { seg: 11 },
        ],
      },
      kaddishAlIsrael("Kaveh", 13),
      // Le Barkhou de la fin de l'office : le 'hazan appelle, l'assemblée
      // répond, il reprend. Replié comme les autres passages du 'hazan, pour
      // qui prie seul. Même titre qu'à Arvit, où le même passage se dit.
      {
        src: "Kaveh",
        fold: "hazan",
        labelText: R("Barkhou (le 'hazan)", "Barechu (the chazan)", "ברכו (החזן)"),
        lines: [
          { seg: 16, rubric: RUBRIC.hazan },
          { seg: 17, rubric: RUBRIC.kahal, tight: true },
          { seg: 18, rubric: RUBRIC.hazanReprend, tight: true },
        ],
      },
      {
        src: "Alenu",
        labelText: R("'Alénou léchabéa'h", "Aleinu", "עלינו לשבח"),
        lines: [
          { seg: 1 },
          { seg: 2 },
          { seg: 3, mode: "small", tight: true },
          { seg: 4, tight: true },
        ],
      },
      {
        src: "Alenu",
        when: "ledavid",
        plain: true,
        // Une ligne dans le fil : pas de titre, le menu n'a rien à y jeter.
        lines: [{ seg: 5 }],
      },
    ],
  };
}

/**
 * Le vidouy de la veille de Kippour, dans la 'Amida de Min'ha.
 *
 * C'est le seul jour de l'année où la confession entre dans la 'Amida de tous
 * les jours : on se confesse déjà à Min'ha, avant le repas qui précède le
 * jeûne, de peur qu'un accident au cours du repas n'en laisse plus le temps
 * (Yoma 87b, Choul'han 'Aroukh Ora'h 'Haïm 607, 1). Il s'ouvre après le
 * premier « Yihyou lératson » et se ferme sur « Élohaï netsor ».
 *
 * Le siddour de l'export ne le porte pas : ses segments viennent du mahzor de
 * Kippour du même rite, section « Mincha for Yom Kippur Eve » (voir
 * amidaKippour, qui en vérifie les repères). Ses trois listes tiennent chacune
 * en un seul segment, une ligne par <br> : `splitBr` les déplie.
 *
 * Quatre blocs plutôt qu'un : le titre ouvre le premier, la note de Tunis
 * accompagne la liste qu'elle vise, et le menu de lecture n'a qu'une entrée à
 * y prendre. Tous `plain` : la couleur du thème dit « l'ajout du jour » sur
 * une ligne, elle serait illisible sur cinquante.
 */
function vidouyKippour() {
  const when = "erev-kippour";
  const src = "YK.Amida";
  return [
    {
      src,
      when,
      plain: true,
      labelText: R("Vidouy (confession)", "Vidui (confession)", "וידוי"),
      halakha: [
        R(
          "La veille de Kippour, on se confesse déjà à Min'ha, avant le repas qui précède le jeûne\u00a0: de peur qu'un accident au cours du repas n'en laisse plus le temps.",
          "On the eve of Kippur, the confession is already said at Mincha, before the meal that precedes the fast: lest a mishap during the meal leave no time for it.",
          "בערב כיפור מתוודים כבר במנחה, קודם הסעודה המפסקת, שמא יארע דבר בסעודה ולא יוכל להתוודות.",
        ),
      ],
      lines: [
        { seg: 23 },
        { seg: 24 },
        { seg: 25 },
        {
          seg: 26,
          splitBr: true,
          rubric: R(
            "Les aveux, dans l'ordre de l'alphabet\u00a0:",
            "The confessions, in the order of the alphabet:",
            "על סדר א״ב:",
          ),
        },
      ],
    },
    {
      src,
      when,
      plain: true,
      halakha: [
        R(
          "À Tunis, on ne disait pas cette seconde liste.",
          "In Tunis, this second list was not said.",
          "בתוניס לא היו אומרים רשימה זו.",
        ),
      ],
      lines: [
        {
          seg: 27,
          splitBr: true,
          // En gris, comme tout ce qui ne se dit pas partout : la note dit que
          // Tunis ne la disait pas, la couleur montre jusqu'où elle va.
          muted: true,
          rubric: R(
            "Puis à rebours, du tav à l'alef\u00a0:",
            "Then in reverse, from tav to alef:",
            "על סדר תשר״ק:",
          ),
        },
      ],
    },
    {
      src,
      when,
      plain: true,
      lines: [
        {
          seg: 28,
          splitBr: true,
          rubric: R(
            "Les fautes, selon ce qu'elles coûtaient au Temple\u00a0:",
            "The sins, by what they once cost in the Temple:",
            "ועל החטאים, לפי מה שהיו חייבים עליהם:",
          ),
        },
      ],
    },
    {
      src,
      when,
      plain: true,
      lines: [{ seg: 29 }, { seg: 30 }],
    },
  ];
}

function minhaRecipe() {
  const amida = amidaBlocks(
    "Amida",
    {
      avot: 2,
      gevurot: 3,
      mekhalkel: 5,
      kedushaText: 7,
      ataKadosh: 8,
      honen: 9,
      hashivenu: 10,
      selah: 11,
      reeh: 12,
      refaenu: 16,
      barkhenu: 18,
      barekhAlenu: 20,
      teka: 21,
      hashiva: 22,
      laminim: 23,
      tsadikim: 24,
      tishkon: 25,
      nahem: 26,
      tishkonHatima: 28,
      tsemah: 29,
      shemaKolenu: 30,
      kiAta: 33,
      retse: 34,
      yv: 36,
      yvRH: 37,
      yvPessah: 38,
      yvSouccot: 39,
      yvSuite: 40,
      veata: 41,
      modim: 43,
      modimDerabanan: 44,
      alHanissim: 46,
      hanouka: 47,
      pourim: 48,
      vealKoulam: 49,
      anenouHazan: 14,
      anenouYahid: 31,
      simShalom: 63,
      yihyu1: 64,
      elohaiNetsor: 65,
      lemaan: 66,
      yihyu2: 67,
      taanitYahid: 68,
      osse: 70,
      yehiRatson: 71,
    },
    {
      // La veille de Kippour, le vidouy entre dans la 'Amida, entre les deux
      // « Yihyou lératson » (voir vidouyKippour).
      vidouy: vidouyKippour(),
      // À Min'ha, les trois versets ne tiennent qu'en un segment de la source,
      // d'où le même index trois fois : ce sont leurs repères qui les séparent.
      kohanim: birkatKohanimBlock(
        "Amida",
        {
          bracha: 54,
          versets: [56, 56, 56],
          hazan: 59,
          versetsHazan: [60, 61, 62],
        },
        {
          when: "taanit",
          halakha: R(
            "Un jour de jeûne public, quand on prie Min'ha ketana dans la demi-heure qui précède le coucher du soleil.",
            "On a public fast, when Mincha ketana is prayed within the half hour before sunset.",
            "בתענית ציבור כשמתפללים מנחה קטנה תוך חצי שעה סמוך לשקיעה.",
          ),
        },
      ),
    },
  );

  return {
    title: "מנחה של חול (Min'ha)",
    blocks: [
      { zman: "minha" },
      chemaKoliBlock(),
      {
        src: "Offerings",
        labelText: R("Korbanot et Achré", "Offerings and Ashrei", "קרבנות ואשרי"),
        halakha: [
          {
            ...R(
              "À Tich'a beAv, le talit et les téfilines, qu'on n'a pas mis le matin, se mettent à Min'ha avec leurs bénédictions.",
              "On Tisha b'Av, the talit and tefillin, not worn in the morning, are put on at Mincha with their blessings.",
              "בתשעה באב מתעטפים בטלית ומניחים תפילין במנחה, בברכותיהם, שלא הניחום בשחרית.",
            ),
            when: "tisha-beav",
          },
        ],
        lines: [
          { seg: 2 },
          { seg: 3 },
          // D'ici s'ouvre le parchemin du pitoum haketoret.
          { seg: 4, klaf: "ketoret" },
          { seg: 5 },
          { seg: 6 },
          { seg: 7 },
          { seg: 8 },
          { seg: 9 },
          { seg: 10 },
          { seg: 11 },
          { seg: 12 },
          { seg: 13 },
        ],
      },
      kaddishHalf("Kaddish"),
      // Un jour de jeûne public, la Torah se lit aussi à Min'ha : la même
      // sortie du séfer que le matin (« Yehi Adonaï » plutôt qu'« El erekh
      // apayim » quand la Min'ha est sans tahanoun : veille de Pourim, veille
      // de Chabbat), le même « Vaye'hal Moché » en trois montées, sans Kaddich
      // après la lecture ; puis la haftara du jeûne de Guedalia, le psaume en
      // rangeant le séfer, Yehalelou, et le demi-Kaddich qui ouvre la 'Amida.
      sortieSeferTorah({
        when: "taanit",
        tahanoun: "tahanoun-minha",
        sansTahanoun: "sans-tahanoun-minha",
        halakha: [{ ...HALAKHA.vayehal, when: "selihot-tsom" }],
      }),
      vayehalBlock("taanit"),
      benedictionApresLecture("taanit"),
      ...haftaraBlocks(),
      ...psaumesSeferBlocks(),
      {
        src: "Uva LeSion",
        when: "taanit",
        plain: true,
        lines: [
          {
            seg: 9,
            mode: "small",
            rubric: R(
              "Quand on rapporte le séfer Torah :",
              "As the Torah scroll is returned:",
              "כשמחזירים ספר תורה:",
            ),
          },
        ],
      },
      kaddishHalf("Kaddish", { when: "taanit" }),
      ...amida,
      avinouMalkenou("Amida", 73, 104),
      {
        src: "Vidui",
        when: "tahanoun-minha",
        plain: true,
        labelText: R("Ta'hanoun (supplications)", "Tachanun (supplications)", "תחנון"),
        halakha: HALAKHA.tahanoun,
        lines: [
          { seg: 1 },
          { seg: 2 },
          { seg: 3 },
          { seg: 4 },
          { seg: 6, rubric: RUBRIC.assis },
          { seg: 7 },
          { seg: 8 },
          { seg: 9 },
        ],
      },
      // Comme à Cha'harit : les jours sans tahanoun, « Yehi chem » tient sa
      // place, et le Kaddich Titkabal suit dans les deux cas.
      {
        src: "Amida",
        when: "sans-tahanoun-minha",
        plain: true,
        lines: [{ seg: 106 }],
      },
      kaddishTitkabal("Kaddish"),
      // Entre le Kaddich Titkabal et 'Alénou : le psaume 67 (Lamnatséa'h
      // binguinot), sauf la veille de Chabbat, où la consigne de la source
      // le remplace par le psaume 93 (Adonaï malakh).
      {
        src: "Vidui",
        when: "lamnatseah-minha",
        // La veille de Kippour, deux autres psaumes prennent sa place.
        unless: "erev-kippour",
        plain: true,
        // Une ligne dans le fil : pas de titre, le menu n'a rien à y jeter.
        // Le même psaume 67 que le matin : même parchemin en forme de menora.
        lines: [{ seg: 16, strip: ["(תהלים סז)"], klaf: "menora" }],
      },
      // La veille de Kippour, le psaume 85 (« Tu as pardonné la faute de ton
      // peuple ») et le psaume 130 (« Des profondeurs je t'ai appelé »)
      // tiennent la place du Lamnatséa'h. Sauf le vendredi, où le psaume 93
      // de la veille de Chabbat la tient déjà (bloc jour-5) : quand Kippour
      // tombe un Chabbat, sa veille est un vendredi.
      {
        when: "erev-kippour",
        unless: "jour-5",
        lines: [
          {
            he: psaume(85),
            rubric: R(
              "La veille de Kippour, on dit à la place du Lamnatséa'h\u00a0:",
              "On the eve of Kippur, say in place of the Lamnatzeach:",
              "בערב כיפור אומרים במקום למנצח:",
            ),
          },
          { he: psaume(130) },
        ],
      },
      {
        src: "Vidui",
        when: "jour-5",
        plain: true,
        // Une ligne dans le fil : pas de titre, le menu n'a rien à y jeter.
        lines: [{ seg: 18, mode: "small" }],
      },
      // Les jours de jeûne public, le psaume 102, « prière du pauvre quand il
      // défaille », s'ajoute avant le Kaddich : un ajout du jour, à la
      // couleur du thème. Sauf la veille de Pourim, où le jeûne d'Esther dit
      // le psaume 22 à sa place, et le vendredi, où le psaume 93 (bloc jour-5)
      // tient déjà la place du Lamnatséa'h. Tich'a beAv le dit aussi, seul
      // de ce que les quatre jeûnes ajoutent à Min'ha.
      {
        src: "Vidui",
        // Les quatre jeûnes, puis Tich'a beAv : deux blocs pour deux jours
        // qui s'excluent (voir condition).
        when: "tsom-minha",
        // Une ligne dans le fil : pas de titre, le menu n'a rien à y jeter.
        lines: [
          {
            seg: 20,
            mode: "small",
            rubric: R("Un jour de jeûne, on ajoute :", "On a fast day, add:", "בתענית מוסיפים:"),
          },
        ],
      },
      {
        src: "Vidui",
        when: "tisha-beav",
        // Une ligne dans le fil : pas de titre, le menu n'a rien à y jeter.
        lines: [
          {
            seg: 20,
            mode: "small",
            rubric: R("Un jour de jeûne, on ajoute :", "On a fast day, add:", "בתענית מוסיפים:"),
          },
        ],
      },
      {
        when: "tsom-esther-veille",
        lines: [
          {
            he: psaume(22),
            rubric: R(
              "Au jeûne d'Esther tenu la veille de Pourim, on dit à la place du psaume 102 :",
              "On the Fast of Esther held on the eve of Purim, say instead of Psalm 102:",
              "בתענית אסתר בערב פורים אומרים במקום מזמור קב:",
            ),
          },
        ],
      },
      kaddishYeheChelama("Vidui", 22),
      {
        src: "Alenu",
        labelText: R("'Alénou léchabéa'h", "Aleinu", "עלינו לשבח"),
        lines: [{ seg: 1 }, { seg: 2 }, { seg: 3, mode: "small", tight: true }],
      },
      {
        src: "Ledavid",
        when: "ledavid",
        plain: true,
        // Une ligne dans le fil : pas de titre, le menu n'a rien à y jeter.
        lines: [{ seg: 5 }],
      },
    ],
  };
}

function arvitRecipe() {
  // Le compte du 'Omer, quarante-neuf soirs de la deuxième nuit de Pessah au
  // 5 Sivan. La source range chaque jour en trois segments qui se suivent :
  // sa date hébraïque, le compte lui-même, puis la sefira du jour. La
  // bénédiction est reprise dans chaque soir, parce qu'elle finit sur
  // « hayom » et que le compte l'achève : les deux ne font qu'une phrase.
  //
  // Le compte de ce soir est ce que le jour change : il se lit à la couleur
  // du thème ; la bénédiction, la même chaque soir, garde celle du texte.
  const omerJours = Array.from({ length: 49 }, (_, i) => ({
    src: "Omer",
    when: `omer-${i + 1}`,
    plain: true,
    lines: [
      { seg: 3 },
      { parts: [{ seg: 5 + 3 * i, when: `omer-${i + 1}`, accent: true }], tight: true },
      {
        seg: 6 + 3 * i,
        muted: true,
        rubric: R("La sefira du jour :", "The sefirah of the day:", "ספירת היום:"),
      },
    ],
  }));

  const amida = amidaBlocks(
    "Amidah",
    {
      avot: 2,
      gevurot: 3,
      mekhalkel: 5,
      ataKadosh: 6,
      honen: 7,
      ataHonantanu: 9,
      vehonenu: 10,
      hashivenu: 11,
      selah: 12,
      reeh: 13,
      refaenu: 14,
      barkhenu: 16,
      barekhAlenu: 18,
      teka: 19,
      hashiva: 20,
      laminim: 21,
      tsadikim: 22,
      tishkon: 23,
      tsemah: 24,
      shemaKolenu: 25,
      kiAta: 28,
      retse: 29,
      yv: 31,
      yvRH: 32,
      yvPessah: 33,
      yvSouccot: 34,
      yvSuite: 35,
      veata: 36,
      modim: 38,
      alHanissim: 40,
      hanouka: 41,
      pourim: 42,
      vealKoulam: 43,
      simShalom: 44,
      yihyu1: 45,
      elohaiNetsor: 46,
      lemaan: 47,
      yihyu2: 48,
      osse: 49,
      yehiRatson: 50,
    },
    { soir: true },
  );

  return {
    title: "ערבית של חול (Arvit)",
    blocks: [
      { zman: "arvit" },
      // À Arvit, Lédavid ouvre l'office toute l'année, dans un encadré : il
      // se déplie de lui-même en sa saison, et le reste du temps il reste là,
      // replié, sans couper l'entrée dans la prière du soir.
      {
        src: "Ledavid",
        fold: "ledavid",
        labelText: R("Lédavid", "LeDavid", "לדוד ה' אורי"),
        lines: [{ seg: 5 }],
      },
      {
        src: "Barchu",
        when: "rosh-chodesh",
        plain: true,
        // Une ligne dans le fil : pas de titre, le menu n'a rien à y jeter.
        lines: [
          {
            seg: 2,
            mode: "small",
            rubric: R("Certains disent :", "Some say:", "בליל ראש חודש יש הנוהגים לומר:"),
          },
        ],
      },
      {
        src: "Barchu",
        // Une ligne dans le fil : pas de titre, le menu n'a rien à y jeter.
        lines: [{ seg: 4 }],
      },
      kaddishHalf("Kaddish"),
      {
        src: "Barchu",
        lines: [
          { seg: 7 },
          {
            seg: 8,
            mode: "full",
            strip: ["ואומר החזן:"],
            rubric: RUBRIC.hazan,
          },
          {
            seg: 9,
            mode: "full",
            strip: ["ועונים הקהל:"],
            rubric: RUBRIC.kahal,
            tight: true,
          },
          {
            seg: 10,
            mode: "full",
            strip: ["ואומר החזן:"],
            rubric: RUBRIC.hazanReprend,
            tight: true,
          },
        ],
      },
      {
        src: "The Shema",
        labelText: R(
          "Chéma et ses bénédictions",
          "The Shema and its blessings",
          "קריאת שמע וברכותיה",
        ),
        halakha: R(
          "Le Chéma du soir se dit après la sortie des étoiles. On couvre les yeux de la main droite pour le premier verset, dit avec concentration.",
          "The evening Shema is said after nightfall. Cover your eyes with the right hand for the first verse, said with full concentration.",
          "קריאת שמע של ערבית נאמרת אחר צאת הכוכבים. יכסה עיניו ביד ימין בפסוק הראשון, ויאמרנו בכוונה.",
        ),
        lines: [
          { seg: 1 },
          { seg: 2 },
          { seg: 4, strong: true },
          {
            seg: 5,
            mode: "small",
            strip: [STRIP.bassevoix],
            rubric: RUBRIC.bassevoix,
            tight: true,
          },
          { seg: 6 },
          { seg: 7 },
          { seg: 8 },
          { seg: 9 },
          { seg: 10 },
        ],
      },
      kaddishHalf("Kaddish"),
      ...amida,
      {
        src: "Amidah",
        when: "jour-0",
        plain: true,
        labelText: R("À la sortie de Chabbat", "At the close of Shabbat", "מוצאי שבת"),
        lines: [
          { seg: 56, mode: "small", muted: true, rubric: RUBRIC.certains },
          { seg: 57, mode: "small" },
          { seg: 58, mode: "small" },
          { seg: 59, mode: "small" },
          { seg: 60, mode: "small" },
        ],
      },
      kaddishTitkabal("Kaddish"),
      {
        src: "Amidah",
        // Une ligne dans le fil : pas de titre, le menu n'a rien à y jeter.
        lines: [{ seg: 51 }, { seg: 66 }],
      },
      kaddishYeheChelama("Amidah", 68),
      // Le Barkhou de clôture, pour qui a manqué celui de l'ouverture.
      {
        src: "Amidah",
        fold: "hazan",
        labelText: R("Barkhou (le 'hazan)", "Barechu (the chazan)", "ברכו (החזן)"),
        lines: [
          { seg: 70, rubric: RUBRIC.hazan },
          { seg: 71, rubric: RUBRIC.kahal, tight: true },
          { seg: 72, rubric: RUBRIC.hazanReprend, tight: true },
        ],
      },
      {
        src: "Alenu",
        labelText: R("'Alénou léchabéa'h", "Aleinu", "עלינו לשבח"),
        lines: [{ seg: 1 }, { seg: 2 }, { seg: 3, mode: "small", tight: true }],
      },
      // Le 'Omer se compte l'office fini, debout, la nuit tombée.
      {
        src: "Omer",
        when: "omer",
        labelText: R("Sefirat ha'omer", "Counting of the Omer", "ספירת העומר"),
        halakha: R(
          "Le compte se dit debout, après la tombée de la nuit. Qui a oublié un soir compte le lendemain dans la journée, sans bénédiction, et reprend le soir suivant avec la bénédiction ; qui a sauté un jour entier compte les soirs suivants sans bénédiction.",
          "The Omer is counted standing, after nightfall. Whoever forgets one evening counts during the following day without a blessing and resumes with the blessing that night; whoever misses a whole day counts the remaining evenings without a blessing.",
          "סופרים מעומד אחר צאת הכוכבים. מי ששכח בלילה סופר ביום בלי ברכה וחוזר לברך בלילה שאחריו; מי שדילג יום שלם סופר בלי ברכה.",
        ),
        lines: [
          {
            seg: 1,
            mode: "small",
            muted: true,
            rubric: R(
              "Certains disent d'abord le léchem yi'houd :",
              "Some first say the leshem yichud:",
              "יש אומרים תחילה לשם יחוד:",
            ),
          },
          { seg: 2, until: "שמים", rubric: RUBRIC.hazan },
          { seg: 2, from: "שמים", rubric: RUBRIC.kahal, tight: true },
        ],
      },
      ...omerJours,
      {
        src: "Omer",
        when: "omer",
        plain: true,
        lines: [
          { seg: 151 },
          // Le psaume 67, en forme de menora sur le parchemin.
          { seg: 152, klaf: "menora" },
          { seg: 153 },
          { seg: 154, tight: true },
          { seg: 155, tight: true },
          { seg: 156, tight: true },
          { seg: 157, tight: true },
          { seg: 158, tight: true },
          { seg: 159, tight: true },
          { seg: 160, mode: "full", strip: ["ואומר בלחש:"], rubric: RUBRIC.bassevoix },
        ],
      },
    ],
  };
}

/**
 * Le Kaddich, comme texte à lui : à l'office, chacune de ses formes vient à
 * sa place, repliée dans le fil de l'office ; ici les quatre se lisent
 * d'affilée, en entier, avec ce qui les distingue les unes des autres. C'est
 * le texte qu'on ouvre quand on a un Kaddich à dire et qu'on n'est pas en
 * train de suivre un office.
 *
 * La source les donne là où elles se disent : le demi-Kaddich et le Kaddich
 * Titkabal dans « Uva LeSion », le « yehé chelama » après le psaume du jour,
 * le « 'al Israël » après l'offrande des parfums du matin. Rien n'est replié
 * ni conditionné : la page les porte toutes, tout le temps.
 */
function kaddichRecipe() {
  return {
    title: "קדיש (Kaddich)",
    blocks: [
      {
        src: "Kaddish",
        labelText: R("Demi-Kaddich", "Half Kaddish", "חצי קדיש"),
        halakha: R(
          "Le demi-Kaddich ferme un moment de l'office et ouvre le suivant : il s'arrête après « léélla min kol birkhata », sans Titkabal ni « ossé chalom ». Comme tout Kaddich, il demande dix hommes et se dit debout.",
          "The half Kaddish closes one moment of the service and opens the next: it stops after “leela min kol birkhata”, without Titkabbal or “oseh shalom”. Like every Kaddish, it needs ten men and is said standing.",
          "חצי קדיש נאמר בין חלקי התפילה, ומסתיים ב״לעלא מן כל ברכתא״, בלי תתקבל ובלי עושה שלום. ככל קדיש, נאמר בעשרה ובעמידה.",
        ),
        lines: [{ seg: 4, splitAmen: true }],
      },
      {
        src: "Kaddish",
        labelText: R("Kaddich Titkabal", "Kaddish Titkabbal", "קדיש תתקבל"),
        halakha: R(
          "Le Kaddich Titkabal suit la 'Amida : on y demande que les prières d'Israël soient reçues. Il se termine par « ossé chalom », en reculant de trois pas.",
          "The Kaddish Titkabbal follows the Amidah: it asks that the prayers of Israel be received. It ends with “oseh shalom”, stepping back three steps.",
          "קדיש תתקבל נאמר אחר העמידה, ובו מבקשים שתתקבל תפילתן של ישראל. מסיימים בעושה שלום, ופוסעים שלוש פסיעות לאחור.",
        ),
        lines: [
          { seg: 4, splitAmen: true },
          { seg: 5, tight: true, splitAmen: true },
          { seg: 6, tight: true, splitAmen: true },
          {
            seg: 7,
            strip: ["יפסע שלש פסיעות לאחור"],
            rubric: R(
              "Il recule de trois pas et dit :",
              "He steps back three steps and says:",
              "יפסע שלוש פסיעות לאחור ויאמר:",
            ),
            tight: true,
            splitAmen: true,
          },
        ],
      },
      {
        src: "YeheChelama",
        labelText: R("Kaddich yehé chelama", "Kaddish Yehe Shelama", "קדיש יהא שלמא"),
        halakha: R(
          "Le Kaddich « yehé chelama » se dit après des psaumes ou une lecture : c'est celui de l'endeuillé, dit pour l'élévation de l'âme d'un défunt.",
          "The Kaddish “Yehe Shelama” is said after psalms or a reading: it is the mourner's Kaddish, said for the elevation of a departed soul.",
          "קדיש ״יהא שלמא״ נאמר אחר מזמורים או אחר קריאה, והוא הקדיש שאומר האבל לעילוי נשמת הנפטר.",
        ),
        lines: [
          { seg: 28, splitAmen: true },
          { seg: 29, tight: true, splitAmen: true },
        ],
      },
      {
        src: "AlIsrael",
        labelText: R("Kaddich 'al Israël", "Kaddish al Yisrael", "קדיש על ישראל"),
        halakha: R(
          "Le Kaddich « 'al Israël », le Kaddich dérabanan, se dit après un passage d'étude : il ajoute une prière pour ceux qui étudient la Torah, ici et partout.",
          "The Kaddish “al Yisrael”, the Kaddish deRabbanan, is said after a passage of study: it adds a prayer for those who study Torah, here and everywhere.",
          "קדיש ״על ישראל״, הוא קדיש דרבנן, נאמר אחר לימוד תורה, ומוסיף בקשה על העוסקים בתורה כאן ובכל מקום.",
        ),
        lines: [
          { seg: 32, splitAmen: true },
          { seg: 33, tight: true, splitAmen: true },
          { seg: 34, tight: true, splitAmen: true },
        ],
      },
    ],
  };
}

// ---------- Construction ----------

console.log("Téléchargement du Siddur Edot HaMizrach (export Sefaria)…");
const text = await fetchSiddur();
console.log("Téléchargement du Mahzor Kippour Edot HaMizrach (export Sefaria)…");
const machzorKippour = await fetchMerged(MACHZOR_YOM_KIPPUR_URL);

/**
 * La 'Amida de la Min'ha de la veille de Kippour, dans le mahzor : la section
 * que le siddour n'a pas, et d'où vient le vidouy (voir vidouyKippour).
 *
 * Ses segments sont désignés par leur rang, comme partout ici ; mais ils
 * viennent d'un second livre, qui ne bouge pas avec le premier. On vérifie
 * donc qu'ils sont bien ceux qu'on croit avant de bâtir : un repère déplacé
 * fait échouer la construction, plutôt que d'écrire un vidouy amputé que rien
 * ne signalerait.
 */
function amidaKippour() {
  const segs = machzorKippour["Mincha for Yom Kippur Eve"]?.["Amidah"] ?? [];
  const REPERES = [
    [23, "אנא"],
    [24, "נאמר לפניך יושב מרום"],
    [25, "שתמחל לנו"],
    [26, "על סדר א״ב"],
    [27, "על סדר תשר״ק"],
    [28, "על חטאים שאנחנו חיבים עליהם"],
    [29, "עד שלא נוצרתי"],
    [30, "שלא אחטא עוד"],
  ];
  for (const [i, repere] of REPERES) {
    if (!stripMarks(segText(segs[i], "full")).includes(repere)) {
      throw new Error(`Mahzor de Kippour : le segment ${i} ne porte plus « ${repere} »`);
    }
  }
  return segs;
}

/**
 * Les sections sources d'un office, aplaties par la recette (clé `src`). Le
 * texte du Kaddich se sert aux mêmes sources : elles sont toutes de Cha'harit.
 */
function sourcesFor(office) {
  const ws = text["Weekday Shacharit"];
  const rh = text["Rosh Hodesh"];
  const pp = text["Preparatory Prayers"];
  if (office === "chaharit") {
    return {
      "PP.Modeh Ani": pp["Modeh Ani"],
      "PP.Morning Blessings": pp["Morning Blessings"],
      "PP.Torah Blessings": pp["Torah Blessings"],
      Talit: ws["Order of Talit"],
      Tefillin: ws["Order of Tefillin"],
      "Morning Prayer": ws["Morning Prayer"],
      "Incense Offering": ws["Incense Offering"],
      Hodu: ws["Hodu"],
      "Pesukei D'Zimra": ws["Pesukei D'Zimra"],
      "The Shema": ws["The Shema"],
      Amida: ws["Amida"],
      Vidui: ws["Vidui"],
      "Torah Reading": ws["Torah Reading"],
      Ashrei: ws["Ashrei"],
      "Uva LeSion": ws["Uva LeSion"],
      "Beit Yaakov": ws["Beit Yaakov"],
      "Song of the Day": ws["Song of the Day"],
      Kaveh: ws["Kaveh"],
      Alenu: ws["Alenu"],
      "RH.Hallel": rh["Hallel"],
      "Hanouka.Shaharit": text["Hanukkah"]["Shacharit"],
      "Pourim.Jour": text["Purim"]["Purim Day"],
      "Taanit.Torah": text["Fast Days and Mourning"]["Torah Reading for Fast Days"],
      "Tsom.Guedalia": text["Fast Days and Mourning"]["Fast of Gedalya"],
      "Tsom.Tevet": text["Fast Days and Mourning"]["Tenth of Tevet"],
      "Tsom.Esther": text["Fast Days and Mourning"]["Fast of Esther"],
      "Tsom.Tamouz": text["Fast Days and Mourning"]["Seventeenth of Tammuz"],
      "RH.Mussaf": rh["Mussaf"],
      "RH.Barchi Nafshi": rh["Barchi Nafshi"],
      // La 'Amida de Moussaf des trois régalim : une seule dans la source,
      // avec ses variantes en petit corps. 'Hol haMoed y prend ce qui reste
      // une fois ces variantes retirées.
      "Regalim.Mussaf": text["Prayers for Three Festivals"]["Mussaf"],
      // Le psaume de chaque fête, dit à 'Hol haMoed après Moussaf.
      "Regalim.ChirSouccot": text["Prayers for Three Festivals"]["Song for Sukkot"],
      "Regalim.ChirPessah": text["Prayers for Three Festivals"]["Song for Passover"],
    };
  }
  // Le Kaddich (segments 4 à 7 de « Uva LeSion ») est le même aux trois
  // offices, et Lédavid (segment 5 de « Alenu ») se dit aux trois, d'Eloul à
  // Chemini 'Atséret : Min'ha et Arvit les reçoivent de Cha'harit, leurs
  // propres sections ne les portant pas.
  if (office === "minha") {
    const wm = text["Weekday Mincha"];
    return {
      Offerings: wm["Offerings"],
      Amida: wm["Amida"],
      Vidui: wm["Vidui"],
      Alenu: wm["Alenu"],
      Kaddish: ws["Uva LeSion"],
      "Uva LeSion": ws["Uva LeSion"],
      Ledavid: ws["Alenu"],
      "Torah Reading": ws["Torah Reading"],
      "Taanit.Torah": text["Fast Days and Mourning"]["Torah Reading for Fast Days"],
      Haftara: text["Shabbat Shacharit"]["Haftarah"],
      // La veille de Kippour : le vidouy de la 'Amida, que seul le mahzor
      // porte.
      "YK.Amida": amidaKippour(),
    };
  }
  // Le texte du Kaddich, à part : ses quatre formes viennent des trois
  // endroits de Cha'harit où la source les porte en entier.
  if (office === "kaddich") {
    return {
      Kaddish: ws["Uva LeSion"],
      YeheChelama: ws["Song of the Day"],
      AlIsrael: ws["Incense Offering"],
    };
  }
  const wa = text["Weekday Arvit"];
  return {
    Omer: text["Counting of the Omer"],
    Barchu: wa["Barchu"],
    "The Shema": wa["The Shema"],
    Amidah: wa["Amidah"],
    Alenu: wa["Alenu"],
    Kaddish: ws["Uva LeSion"],
    Ledavid: ws["Alenu"],
  };
}

const RECIPES = {
  chaharit: chaharitRecipe(),
  minha: minhaRecipe(),
  arvit: arvitRecipe(),
  kaddich: kaddichRecipe(),
};

for (const [name, recipe] of Object.entries(RECIPES)) {
  const sections = sourcesFor(name);
  const blocks = recipe.blocks.map((spec) => buildBlock(spec, sections));
  const out = { title: recipe.title, blocks };
  const path = resolve(OUT, `${name}.json`);
  writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
  const lineCount = blocks.reduce((sum, b) => sum + (b.lines?.length ?? 0), 0);
  console.log(`  ${name}.json : ${blocks.length} blocs, ${lineCount} paragraphes`);
}
console.log("Terminé.");
