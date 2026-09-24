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
import { HALAKHA_LOULAV, LIGNES_LOULAV } from "./lib/loulav.mjs";
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
 * L'ordre est celui du sidour : la bénédiction sur la prise, puis, la
 * première fois de l'année, le Chéhé'héyanou, et les six côtés pour finir.
 */
const netilatLoulav = {
  file: "netilat-loulav",
  title: "נטילת לולב (Netilat Loulav)",
  src: () => [],
  blocks: [
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
/**
 * Les segments du kiddouch des soirs de fête : la section « קידוש לליל שלש
 * רגלים » que la source range à la suite du Moussaf des régalim, et le « Yom
 * hachichi » du kiddouch de Chabbat, auquel elle renvoie sans le redonner
 * (« בשבת אומרים כל הקידוש עד סוף יום הששי »). Les autres blocs du séder ne
 * prennent rien à la source : leurs lignes sont écrites en clair.
 */
function segmentsKiddouch(siddur) {
  return {
    ...siddur["Prayers for Three Festivals"]["Mussaf"],
    yomHachichi: siddur["Shabbat Evening"]["Kiddush"][8],
  };
}

const leilSouccot = {
  file: "seder-leil-souccot",
  title: "סדר ליל סוכות (Seder Leil Souccot)",
  src: (t) => segmentsKiddouch(t.siddur),
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
    // Le kiddouch des soirs de Yom Tov, dans la soucca. Il vient de la source,
    // qui le donne une fois pour les trois fêtes : on n'en garde que ce qui
    // sert à Souccot. Les ajouts du Chabbat y sont entre parenthèses, comme
    // dans le sidour imprimé, et la havdala du soir qui suit un Chabbat vient
    // à sa place, entre le kiddouch et les deux bénédictions de la fête.
    {
      label: "Le kiddouch",
      halakha: {
        fr: "Le kiddouch des soirs de Yom Tov se dit dans la soucca : le premier soir, et le second hors d'Israël.",
        en: "The kiddush of the Yom Tov evenings is said in the sukkah: on the first evening, and outside Israel on the second too.",
        he: "קידוש של ליל יום טוב אומרים בסוכה: בליל ראשון, ובחוץ לארץ גם בליל שני.",
      },
      lines: [
        {
          seg: "yomHachichi",
          rubric: {
            fr: "Le Chabbat, on commence par « Yom hachichi » :",
            en: "On Shabbat, begin with “Yom hashishi”:",
          },
          rubricSeg: 218,
        },
        {
          seg: 219,
          rubric: {
            fr: "Puis, chaque soir de fête :",
            en: "Then, every festival evening:",
            he: "ואחר כך אומרים:",
          },
        },
        {
          seg: 220,
          rubric: {
            fr: "Celui qui fait le kiddouch dit « Savri maranan », et l'on répond « Le'hayim » :",
            en: "The one making kiddush says “Savri maranan”, and all answer “Lechayim”:",
            he: "ואומר המקדש סברי מרנן, ועונים לחיים:",
          },
        },
        { seg: 221 },
        {
          seg: 222,
          rubric: {
            fr: "Les mots entre parenthèses ne se disent que le Chabbat :",
            en: "The words in parentheses are said on Shabbat only:",
            he: "המילים שבסוגריים נאמרות בשבת בלבד:",
          },
        },
        { seg: 224, tight: true },
        { seg: 226, tight: true },
        {
          seg: 228,
          rubric: {
            fr: "Le soir qui suit un Chabbat, on ajoute la havdala :",
            en: "On the evening that follows a Shabbat, add the havdalah:",
          },
          rubricSeg: 227,
        },
        { seg: 229, tight: true },
        {
          seg: 231,
          rubric: {
            fr: "Le premier soir, « Lechev basoukka » puis Chéhé'héyanou. Le second soir, Chéhé'héyanou d'abord, puis « Lechev basoukka » :",
            en: "On the first evening, “Leshev basukkah” and then Shehecheyanu. On the second evening, Shehecheyanu first, then “Leshev basukkah”:",
          },
          rubricSeg: 230,
        },
        { seg: 232, tight: true },
      ],
    },
  ],
};

const RECIPES = [ataratNedarim, netilatLoulav, leilSouccot];

console.log("Téléchargement du Mahzor Roch Hachana et du Siddur Edot HaMizrach (export Sefaria)…");
const [mahzor, siddur] = await Promise.all([
  fetchMerged(MACHZOR_ROSH_HASHANA_URL),
  fetchSiddur(),
]);

writeRecipes(RECIPES, { mahzor, siddur }, OUT);
console.log("Terminé.");
