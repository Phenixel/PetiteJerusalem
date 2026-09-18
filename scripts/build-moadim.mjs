/**
 * Construit les textes des fêtes (public/texts/tefila/*) à partir du Mahzor de
 * Roch Hachana du rite Edot HaMizrach de l'export public Sefaria, comme
 * build-brahot.mjs le fait des bénédictions à partir du siddour du même rite.
 *
 * Lancer avec : node scripts/build-moadim.mjs
 *
 * Pour l'heure, un seul texte : l'Atarat nedarim, qu'on dit la veille de Roch
 * Hachana et la veille de Kippour devant dix hommes, ou trois à défaut. Le
 * siddour de l'export ne le porte pas ; le mahzor, si, sous « Annulment of
 * Vows and Curses ». Les autres textes de fête du livre Moadim (les Sli'hot,
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
import { fetchMerged, MACHZOR_ROSH_HASHANA_URL } from "./lib/sefaria-siddur.mjs";
import { writeRecipes } from "./lib/tefila-recipe.mjs";

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
  src: (t) => t["Annulment of Vows and Curses"],
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

const RECIPES = [ataratNedarim];

console.log("Téléchargement du Mahzor Roch Hachana Edot HaMizrach (export Sefaria)…");
const text = await fetchMerged(MACHZOR_ROSH_HASHANA_URL);

writeRecipes(RECIPES, text, OUT);
console.log("Terminé.");
