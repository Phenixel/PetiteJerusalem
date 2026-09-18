/**
 * Le moteur des recettes de tefila : ce qui transforme une recette (« ce
 * segment de la source, ce morceau retiré, cette didascalie ») en un bloc du
 * fichier servi sous public/texts/tefila.
 *
 * Deux scripts s'en servent : build-brahot.mjs (les bénédictions et les rites
 * qui les entourent) et build-moadim.mjs (les textes des fêtes). Ils lisent
 * deux livres différents de l'export Sefaria, de même facture : les consignes
 * de lecture y vivent dans des <small> au milieu du texte.
 *
 * La recette reste explicite, segment par segment : ce qui n'est pas retenu ne
 * se perd pas en silence, un repère absent fait échouer la construction.
 */

import { writeFileSync } from "fs";
import { resolve } from "path";
import {
  bareMap,
  cleanFinal,
  HEBREW_MARKS,
  segText,
  sliceBetween,
  stripMarks,
} from "./sefaria-siddur.mjs";

// ---------- Le petit corps de la source ----------

/**
 * Dans ces sources, le petit corps sert à deux choses : les consignes de lecture
 * et les références d'un côté, des passages qui se disent de l'autre (le Léchem
 * yihoud, les versets de protection du voyageur, la forme féminine d'un mot,
 * ce qu'ajoute celui qui rentre le jour même). Les premières ne sont pas
 * vocalisées, les seconds le sont : c'est ce qui les sépare ici.
 *
 * Les consignes partent donc, le texte reste, à la place où la source le met.
 * Celles qui restent collées au fil du texte, faute de balise, se retirent une
 * à une dans les recettes (`strip`, `from`, `until`).
 */
const NIKOUD = /[\u05B0-\u05BC\u05BE\u05C1\u05C2\u05C7]/;

function dropInstructionSmalls(raw) {
  let s = String(raw ?? "");
  let prev;
  do {
    prev = s;
    // Du plus intérieur vers l'extérieur : ce qui se dit est mis de côté sous
    // une balise que le nettoyage final retire, pour ne pas le reprendre.
    s = s.replace(/<small>((?:(?!<\/?small>)[\s\S])*)<\/small>/g, (_, inner) =>
      NIKOUD.test(inner) ? `<garde>${inner}</garde>` : " ",
    );
  } while (s !== prev);
  return s;
}

/**
 * Retire un passage du texte, repéré sans ses signes : la vocalisation d'une
 * même consigne varie d'un endroit à l'autre de la source (l'ordre du dagech et
 * de la voyelle, notamment), et un repère écrit à la main ne la retrouverait
 * pas au caractère près. Un repère absent laisse le texte tel quel : la même
 * consigne ne se glisse pas dans toutes les formules d'un même texte, et ce
 * qui resterait d'une consigne est attrapé par `assertSansConsigne`.
 */
function removeMarker(text, marker) {
  const cible = stripMarks(marker);
  let out = text;
  // Toutes les occurrences : la source répète la même consigne à chaque
  // formule d'un même paragraphe.
  for (;;) {
    const { map, bare } = bareMap(out);
    const j = bare.indexOf(cible);
    if (j < 0) return out;
    const debut = map[j];
    const fin = j + cible.length < map.length ? map[j + cible.length] : out.length;
    out = `${out.slice(0, debut)} ${out.slice(fin)}`;
  }
}

/**
 * Ce qui se lit est vocalisé, les consignes ne le sont pas : une suite de mots
 * hébreux sans une seule voyelle au milieu du texte, c'est une consigne restée
 * là. La construction s'arrête plutôt que de livrer un texte où le lecteur
 * lirait « il dira » au milieu d'une bénédiction.
 */
function assertSansConsigne(text, spec) {
  // Le Nom s'écrit parfois sans voyelles au milieu d'un texte vocalisé : ce
  // n'est pas une consigne.
  const sansNoms = text.replace(/יהוה|אלהינו|אלהים|אלהי|אדני/g, " ");
  for (const suite of sansNoms.match(/[\u05D0-\u05EA"'\u05F3\u05F4\s]{10,}/g) ?? []) {
    if (!HEBREW_MARKS.test(suite) && suite.trim().length >= 10) {
      throw new Error(`Consigne restée dans le texte (segment ${spec.seg}) : « ${suite.trim()} »`);
    }
  }
}

// ---------- Recette → fichier ----------

/**
 * Une ligne : `seg` prend un segment de la source, `he` écrit l'hébreu en
 * clair. `from`/`until` découpent le segment entre deux repères (une consigne
 * restée collée au texte), `strip` retire un morceau, `rubricSeg` prend
 * l'hébreu d'une didascalie dans la source, `rubric` porte son français et son
 * anglais.
 *
 * Du segment, on garde tout ce qui se dit et rien des consignes (voir
 * dropInstructionSmalls) ; celles qui restent collées au texte se retirent par
 * `from`, `until` ou `strip`.
 */
function buildLine(spec, segs) {
  let text =
    spec.he !== undefined ? cleanFinal(spec.he) : cleanFinal(dropInstructionSmalls(segs[spec.seg]));
  // Les espaces sont ramenées à une avant tout retrait : les consignes de la
  // source portent parfois un retour à la ligne au milieu, et le repère
  // écrit ici ne les retrouverait pas.
  text = text.replace(/\s+/g, " ");
  for (const cut of spec.strip ?? []) text = removeMarker(text, cut);
  if (spec.from || spec.until) text = sliceBetween(text, spec);
  text = text
    .replace(/\s+/g, " ")
    .replace(/\s+([.,:;])/g, "$1")
    // Une consigne retirée laisse parfois une parenthèse qui bâille.
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
  if (!text) throw new Error(`Ligne vide : ${JSON.stringify(spec)}`);
  assertSansConsigne(text, spec);
  const line = {};
  const rubric = rubricOf(spec, segs);
  if (rubric) line.rubric = rubric;
  line.he = text;
  if (spec.repeat) line.repeat = spec.repeat;
  if (spec.muted) line.muted = true;
  if (spec.tight) line.tight = true;
  if (spec.lead) line.lead = true;
  // La condition d'une ligne : `when` le jour où elle se dit, `unless` le jour
  // qui la retire. Les deux ne s'échangent pas, voir docs/compatibilite-textes.md.
  if (spec.when) line.when = spec.when;
  if (spec.unless) line.unless = spec.unless;
  return line;
}

/**
 * La didascalie d'une ligne ou d'un bloc : hébreu de la source, reste écrit ici.
 *
 * Sa condition la suit : une halakha qui ne vaut qu'après hatsot ne s'affiche
 * qu'après hatsot (voir Halakha dans textService), et elle se perdrait si on
 * ne recopiait que les trois langues.
 */
function rubricOf(spec, segs, key = "rubric") {
  const written = spec[key];
  const segKey = `${key}Seg`;
  if (!written) return null;
  if (written.he) return written;
  // Les consignes de la source vivent le plus souvent dans un <small> : c'est
  // tout le segment qu'on prend, balises retirées.
  const he = segText(segs[spec[segKey]], "full");
  if (!he) throw new Error(`Didascalie introuvable : segment ${spec[segKey]}`);
  const rubric = { fr: written.fr, en: written.en, he };
  if (written.when) rubric.when = written.when;
  if (written.unless) rubric.unless = written.unless;
  return rubric;
}

export function buildBlock(spec, segs) {
  const block = {};
  if (spec.label) block.label = spec.label;
  if (spec.labelText) block.labelText = spec.labelText;
  const halakha = rubricOf(spec, segs, "halakha");
  if (halakha) block.halakha = halakha;
  if (spec.variants) block.variants = true;
  if (spec.plain) block.plain = true;
  block.lines = spec.lines.map((line) => buildLine(line, segs));
  return block;
}

/**
 * Écrit un fichier par recette sous `outDir`, et dit ce qu'il a écrit : c'est
 * la seule trace qu'un texte a bougé, les fichiers étant relus par le test
 * des textes de tefila et non par un humain.
 */
export function writeRecipes(recipes, text, outDir) {
  for (const recipe of recipes) {
    const segs = recipe.src(text);
    const blocks = recipe.blocks.map((spec) => buildBlock(spec, segs));
    const out = { title: recipe.title, blocks };
    writeFileSync(resolve(outDir, `${recipe.file}.json`), JSON.stringify(out, null, 2) + "\n");
    const lineCount = blocks.reduce((sum, b) => sum + b.lines.length, 0);
    console.log(`  ${recipe.file}.json : ${blocks.length} blocs, ${lineCount} paragraphes`);
  }
}
