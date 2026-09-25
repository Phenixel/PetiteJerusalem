/**
 * Construit les textes des fêtes (public/texts/tefila/*) à partir du Mahzor de
 * Roch Hachana du rite Edot HaMizrach de l'export public Sefaria, comme
 * build-brahot.mjs le fait des bénédictions à partir du siddour du même rite.
 *
 * Lancer avec : node scripts/build-moadim.mjs
 *
 * Trois textes pour l'heure. L'Atarat nedarim, qu'on dit la veille de Roch
 * Hachana et la veille de Kippour devant dix hommes, ou trois à défaut : le
 * siddour de l'export ne le porte pas ; le mahzor, si, sous « Annulment of
 * Vows and Curses ». Les brahot du loulav, que ni l'un ni l'autre ne
 * portent : leur texte vit dans scripts/lib/loulav.mjs, d'où la Cha'harit le
 * prend aussi. Et le séder de la nuit de Souccot, que la source ne porte pas
 * davantage : il vit dans scripts/lib/leil-souccot.mjs, transcrit d'un sidour
 * imprimé. Les autres textes de fête du livre Moadim (les Sli'hot,
 * l'allumage de Hanouka) viennent, eux, d'ailleurs : voir scripts/lib et
 * build-brahot.mjs.
 *
 * La recette reste explicite, segment par segment, et le moteur qui la lit est
 * celui des brahot (scripts/lib/tefila-recipe.mjs) : la source alterne des
 * consignes en hébreu et le texte lui-même, et chaque consigne retenue devient
 * une didascalie dans les trois langues (son hébreu vient de la source, le
 * français et l'anglais sont écrits ici). Ce qui n'est pas retenu ne se perd
 * pas en silence : un repère absent fait échouer la construction.
 *
 * Licence des textes : la formule est celle des siddourim séfarades imprimés
 * depuis le XVIIIe siècle (l'Atarat kelalot de la fin est du Hida) ; l'export
 * Sefaria en sert la saisie.
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { fetchMerged, fetchSiddur, MACHZOR_ROSH_HASHANA_URL } from "./lib/sefaria-siddur.mjs";
import { writeRecipes } from "./lib/tefila-recipe.mjs";
import {
  HALAKHA_AVANT_LOULAV,
  HALAKHA_LOULAV,
  LIGNES_AVANT_LOULAV,
  LIGNES_LOULAV,
} from "./lib/loulav.mjs";
import {
  AVINOU,
  DINIM,
  EL_MALE,
  KAVANOT_NUITS,
  LECHEM_YIHOUD,
  LEIOUL_NUITS,
  LEKHA,
  NUITS,
  OULOU,
  RASHEI_TEVOT,
  RUBRIC_AJOUT,
  RUBRIC_ASSIS,
  RUBRIC_CHAQUE_NUIT,
  RUBRIC_ENTREE,
  RUBRIC_FIN,
  RUBRIC_KAVANOT,
  RUBRIC_SEUIL,
  TIVOU,
  VEHOUKHAN,
  VERSETS_AJOUT,
  VERSETS_NUITS,
} from "./lib/leil-souccot.mjs";
import { DINIM_HOCHANOT } from "./lib/hochanot/dinim.mjs";
import JOUR_1 from "./lib/hochanot/jour-1.mjs";
import JOUR_2 from "./lib/hochanot/jour-2.mjs";
import JOUR_3 from "./lib/hochanot/jour-3.mjs";
import JOUR_4 from "./lib/hochanot/jour-4.mjs";
import JOUR_5 from "./lib/hochanot/jour-5.mjs";
import JOUR_6 from "./lib/hochanot/jour-6.mjs";
import HOCHANA_RABBA_1 from "./lib/hochanot/hochana-rabba-1.mjs";
import HOCHANA_RABBA_2 from "./lib/hochanot/hochana-rabba-2.mjs";
import HOCHANA_RABBA_3 from "./lib/hochanot/hochana-rabba-3.mjs";
import CHABBAT from "./lib/hochanot/chabbat.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/texts/tefila");

// ---------- Les recettes ----------

/**
 * L'Atarat nedarim : segments de « Annulment of Vows and Curses ».
 *
 * Le mahzor met deux rites à la suite, et on les garde dans son ordre :
 * l'annulation des malédictions selon l'usage de Jérusalem d'abord, celle des
 * vœux ensuite, puis les deux déclarations (modaa) qui valent pour l'année qui
 * vient et l'annulation des malédictions du Hida pour finir. Les deux voix
 * alternent tout du long, ceux qui demandent et ceux qui délient : ce sont les
 * didascalies qui disent à qui c'est le tour, comme dans la source.
 */
const ataratNedarim = {
  file: "atarat-nedarim",
  title: "התרת נדרים (Atarat Nedarim)",
  src: (t) => t.mahzor["Annulment of Vows and Curses"],
  blocks: [
    {
      label: "L'annulation des malédictions",
      halakha: {
        fr: "À Jérusalem, l'usage est de dire l'annulation des malédictions dans cette formule. Ceux qui la demandent se tiennent devant dix hommes craignant le Ciel, ou trois à défaut, et se repentent de leurs mauvaises actions.",
        en: "In Jerusalem the custom is to say the annulment of curses in this wording. Those who ask for it stand before ten God-fearing men, or three failing that, and repent of their evil deeds.",
      },
      halakhaSeg: 0,
      lines: [
        { seg: 1 },
        {
          seg: 3,
          rubric: { fr: "Ceux qui délient répondent :", en: "Those who annul answer:" },
          rubricSeg: 2,
        },
        { seg: 4 },
        { seg: 5 },
        { seg: 6 },
      ],
    },
    {
      label: "La déclaration pour l'avenir",
      lines: [
        {
          seg: 8,
          rubric: {
            fr: "Ceux qui demandent font ensuite cette déclaration :",
            en: "Those who ask then make this declaration:",
          },
          rubricSeg: 7,
        },
        { seg: 9 },
        { seg: 10 },
        {
          seg: 12,
          rubric: {
            fr: "Ceux qui délient acceptent la déclaration, en ces termes :",
            en: "Those who annul accept the declaration, in these words:",
          },
          rubricSeg: 11,
        },
      ],
    },
    {
      label: "L'annulation des vœux",
      halakha: {
        fr: "Certains la font le 19 Av, quarante jours avant Roch Hachana, et la veille de Roch Hodech Eloul, quarante jours avant Kippour ; puis la veille de Roch Hachana et la veille de Kippour. On se tient devant dix hommes craignant le Ciel, assis, ou devant trois à défaut de dix.",
        en: "Some perform it on 19 Av, forty days before Rosh Hashana, and on the eve of Rosh Hodesh Elul, forty days before Kippur; then on the eve of Rosh Hashana and on the eve of Kippur. Stand before ten God-fearing men, seated, or before three if there are not ten.",
      },
      halakhaSeg: 13,
      lines: [
        { seg: 14 },
        {
          seg: 16,
          rubric: {
            fr: "Ceux qui délient répondent en ces termes, trois fois :",
            en: "Those who annul answer in these words, three times:",
          },
          rubricSeg: 15,
          repeat: 3,
        },
      ],
    },
    {
      label: "La déclaration pour l'avenir",
      lines: [
        {
          seg: 18,
          rubric: {
            fr: "Ceux qui demandent disent ensuite cette déclaration :",
            en: "Those who ask then say this declaration:",
          },
          rubricSeg: 17,
        },
        {
          seg: 20,
          rubric: { fr: "Ceux qui délient disent :", en: "Those who annul say:" },
          rubricSeg: 19,
        },
        {
          seg: 22,
          rubric: {
            fr: "Certains font aussi cette déclaration, du Hida :",
            en: "Some also make this declaration, from the Hida:",
          },
          rubricSeg: 21,
        },
        {
          seg: 24,
          rubric: { fr: "Ceux qui délient disent :", en: "Those who annul say:" },
          rubricSeg: 23,
        },
      ],
    },
    {
      label: "Yehi ratson",
      lines: [
        {
          seg: 26,
          rubric: {
            fr: "Ceux qui demandent disent pour finir :",
            en: "Those who ask say in closing:",
          },
          rubricSeg: 25,
        },
        { seg: 27 },
      ],
    },
    {
      label: "L'annulation des malédictions du Hida",
      lines: [
        {
          seg: 29,
          rubric: {
            fr: "On dit ensuite cette annulation des malédictions du Hida :",
            en: "This annulment of curses from the Hida is then said:",
          },
          rubricSeg: 28,
        },
        {
          seg: 31,
          rubric: { fr: "Ceux qui délient disent :", en: "Those who annul say:" },
          rubricSeg: 30,
        },
        { seg: 32 },
        { seg: 33 },
      ],
    },
  ],
};

/**
 * Les brahot du loulav : la page du livre Moadim. Rien ne vient de la source
 * Sefaria ici, tout est écrit dans scripts/lib/loulav.mjs ; la recette ne
 * fait que l'ordonner, et `src` ne sert donc à rien (aucune ligne ne prend de
 * segment).
 *
 * L'ordre est celui du sidour : ce qui se dit avant de prendre les espèces
 * (Léchem yihoud, Yehi ratson, « Ribon 'alma »), la bénédiction sur la prise,
 * puis, la première fois de l'année, le Chéhé'héyanou, et les six côtés pour
 * finir.
 */
const netilatLoulav = {
  file: "netilat-loulav",
  title: "נטילת לולב (Netilat Loulav)",
  src: () => [],
  blocks: [
    // Avant de prendre les quatre espèces : le Léchem yihoud, la kavana des
    // six côtés, le Yehi ratson et « Ribon 'alma », comme le sidour les
    // donne avant la bénédiction.
    {
      label: "Avant de prendre le loulav",
      halakha: HALAKHA_AVANT_LOULAV,
      lines: LIGNES_AVANT_LOULAV,
    },
    {
      label: "Les brahot du loulav",
      halakha: HALAKHA_LOULAV,
      // Le cadran des six côtés s'ouvre du titre : l'ordre des na'anou'im se
      // retient mieux posé sur une boussole qu'en liste.
      naanouim: true,
      lines: LIGNES_LOULAV,
    },
  ],
};

/**
 * Le séder de la nuit de Souccot : la page du livre Moadim. Comme les brahot
 * du loulav, rien n'en vient de la source Sefaria, qui ne le porte pas ; tout
 * est dans scripts/lib/leil-souccot.mjs, transcrit du sidour imprimé, et la
 * recette ne fait que l'ordonner.
 *
 * L'ordre est celui du sidour : au seuil, le Léchem yihoud et la kavana de la
 * nuit ; en entrant, l'invitation aux ouchpizin, l'hôte de la nuit en tête ;
 * assis, son verset, les versets que certains ajoutent, et le verset de David
 * pour finir. Les sept nuits sont écrites l'une sous l'autre, chacune sous sa
 * didascalie, comme l'allumage de Hanouka donne ses huit soirs : le livre se
 * lit aussi bien la veille que le soir même.
 *
 * Les dinim de l'habitation dans la soucca accompagnent le bloc où l'on
 * s'assoit : c'est là qu'ils s'appliquent, et le sidour les donne à la suite
 * du séder, sous le titre « דיני ישיבה בסוכה ».
 */
const leilSouccot = {
  file: "seder-leil-souccot",
  title: "סדר ליל סוכות (Seder Leil Souccot)",
  src: () => [],
  blocks: [
    {
      label: "Au seuil de la soucca",
      lines: [
        { he: LECHEM_YIHOUD[0], rubric: RUBRIC_SEUIL },
        { he: LECHEM_YIHOUD[1], tight: true },
        ...KAVANOT_NUITS.map((he, i) => ({ he, rubric: i === 0 ? RUBRIC_KAVANOT : NUITS[i] })),
        { he: VEHOUKHAN[0], rubric: RUBRIC_CHAQUE_NUIT },
        { he: VEHOUKHAN[1], tight: true },
        { he: AVINOU },
        ...RASHEI_TEVOT.map(({ he, rubric }) => ({ he, rubric })),
        { he: EL_MALE },
      ],
    },
    {
      label: "Les ouchpizin",
      lines: [
        { he: OULOU, rubric: RUBRIC_ENTREE },
        ...LEIOUL_NUITS.map((he, i) => ({ he, rubric: NUITS[i] })),
        { he: TIVOU, rubric: RUBRIC_CHAQUE_NUIT },
      ],
    },
    {
      label: "Assis dans la soucca",
      halakha: DINIM,
      lines: [
        ...VERSETS_NUITS.flatMap((nuit, i) =>
          nuit.map((verset, rang) => ({
            ...verset,
            ...(rang === 0 ? { rubric: i === 0 ? RUBRIC_ASSIS : NUITS[i] } : { tight: true }),
          })),
        ),
        ...VERSETS_AJOUT.map((he, i) => ({ he, rubric: i === 0 ? RUBRIC_AJOUT : NUITS[i] })),
        { he: LEKHA, rubric: RUBRIC_FIN },
      ],
    },
  ],
};

/**
 * Les Hochanot : une page par jour de Souccot, puis Hochana Rabba et le
 * Chabbat. Aucune source numérique du rite ne les porte ; elles sont
 * transcrites du sidour imprimé, page à page, et relues contre les photos,
 * dans un module par jour (scripts/lib/hochanot). La recette ne fait que les
 * ordonner.
 *
 * Chaque jour a sa page plutôt qu'un seul texte à sept conditions : le livre
 * se lit n'importe quel jour, et c'est celle du jour qu'on ouvre, à la
 * synagogue, le loulav en main. C'est aussi pourquoi les dinim que le sidour
 * imprime une fois, en tête du premier jour, ouvrent chaque page.
 *
 * Hochana Rabba tient en trois modules, coupés aux pages du sidour : une
 * hakafa commencée dans l'un s'achève dans le suivant, sous le même titre
 * suivi de « (fin) » ou « (suite) ». `raccorder` en refait un seul bloc, et
 * recoud le verset que la coupure de page a tranché en deux.
 */
function raccorder(blocs) {
  // Les titres se comparent sans égard aux espaces : un module écrit
  // « hakafa : David » avec une espace insécable, un autre avec une espace
  // ordinaire, et c'est bien la même hakafa.
  const titre = (label) => (label ?? "").replace(/\s+/g, " ").trim();
  const out = [];
  for (const bloc of blocs) {
    const suite = /\s\((fin|suite)\)$/.exec(bloc.label ?? "");
    const avant = out.at(-1);
    if (!suite || !avant || titre(avant.label) !== titre(bloc.label.slice(0, suite.index))) {
      out.push({ ...bloc, lines: [...bloc.lines] });
      continue;
    }
    const [premiere, ...reste] = bloc.lines;
    const derniere = avant.lines.at(-1);
    // Une ligne qui ne finit ni par « : » ni par « . » est coupée au milieu :
    // la suite en est la première ligne du module suivant.
    if (!/[:.]$/.test(derniere.he.trim())) {
      avant.lines[avant.lines.length - 1] = { ...derniere, he: `${derniere.he} ${premiere.he}` };
    } else {
      avant.lines.push(premiere);
    }
    avant.lines.push(...reste);
  }
  return out;
}

/** Les dinim en tête de la page, avant la halakha propre au premier bloc. */
function avecDinim([premier, ...reste]) {
  const propres = premier.halakha ? [premier.halakha].flat() : [];
  return [{ ...premier, halakha: [...DINIM_HOCHANOT, ...propres] }, ...reste];
}

const HOCHANOT = [
  ["hochanot-yom-richon", "הושענות ליום ראשון (Hochanot Yom Richon)", [JOUR_1]],
  ["hochanot-yom-cheni", "הושענות ליום שני (Hochanot Yom Cheni)", [JOUR_2]],
  ["hochanot-yom-chelichi", "הושענות ליום שלישי (Hochanot Yom Chelichi)", [JOUR_3]],
  ["hochanot-yom-revii", "הושענות ליום רביעי (Hochanot Yom Revi'i)", [JOUR_4]],
  ["hochanot-yom-hamichi", "הושענות ליום חמישי (Hochanot Yom 'Hamichi)", [JOUR_5]],
  ["hochanot-yom-chichi", "הושענות ליום ששי (Hochanot Yom Chichi)", [JOUR_6]],
  [
    "hochanot-hochana-rabba",
    "הושענות להושענא רבא (Hochanot Hochana Rabba)",
    [HOCHANA_RABBA_1, HOCHANA_RABBA_2, HOCHANA_RABBA_3],
  ],
].map(([file, title, modules]) => ({
  file,
  title,
  src: () => [],
  blocks: avecDinim(raccorder(modules.flatMap((module) => module.blocks))),
}));

/**
 * Les Hochanot du Chabbat : on ne les dit pas selon l'usage du sidour, qui
 * les imprime pour celui de Tunis. Leur première halakha le dit ; les dinim
 * des autres jours n'y ont rien à faire.
 */
const hochanotChabbat = {
  file: "hochanot-chabbat",
  title: "הושענות ליום שבת (Hochanot Chabbat)",
  src: () => [],
  blocks: CHABBAT.blocks,
};

const RECIPES = [ataratNedarim, netilatLoulav, leilSouccot, ...HOCHANOT, hochanotChabbat];

console.log("Téléchargement du Mahzor Roch Hachana et du Siddur Edot HaMizrach (export Sefaria)…");
const [mahzor, siddur] = await Promise.all([
  fetchMerged(MACHZOR_ROSH_HASHANA_URL),
  fetchSiddur(),
]);

writeRecipes(RECIPES, { mahzor, siddur }, OUT);
console.log("Terminé.");
