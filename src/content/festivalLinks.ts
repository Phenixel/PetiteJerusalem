/**
 * Où mener quelqu'un arrivé sur la page d'une fête.
 *
 * Ces pages sont la première source de trafic du site : sur les visiteurs
 * venus d'un moteur sur le calendrier en trente jours, 3 % seulement ont
 * ouvert une seconde page. Rien ne les y menait : le bloc « Autour de X »
 * ne renvoyait qu'au calendrier, aux horaires et aux zmanim, c'est-à-dire
 * trois fois à la même famille de pages, celle qu'ils venaient de lire.
 *
 * Chaque fête mène donc à ce qu'on dit et ce qu'on lit ce jour-là, quand le
 * site le porte : les Sli'hot avant Roch Hachana, l'Atarat nedarim la veille
 * de Kippour, l'allumage de Hanouka, le sidour, la paracha, les Tehilim et
 * leur partage. Aucun lien inventé : chaque cible existe et est prérendue.
 *
 * Module partagé entre le prérendu (zmanimSeoPages.ts, ce que lit un robot)
 * et la vue (CalendarPage.vue, ce que voit un visiteur), comme
 * zmanimFestivals.ts : les deux doivent proposer les mêmes chemins, sinon la
 * page indexée promet autre chose que la page ouverte. Il ne dépend que de
 * la table des sections, et reste donc assez léger pour le chunk de la vue.
 */

import { sectionPath, type SeoLocale } from "./seoLocales";

export type FestivalLink = {
  /** Identifiant stable, celui que porte l'événement de suivi. */
  id: string;
  /** Le chemin, dans la langue de la page quand la cible en a une par langue. */
  path: (locale: SeoLocale) => string;
  /** Le libellé du lien, écrit langue par langue. */
  labels: Record<SeoLocale, string>;
};

/** Une cible de la bibliothèque : un seul document, donc une seule adresse. */
const library = (id: string, path: string, labels: [string, string, string]): FestivalLink => ({
  id,
  path: () => path,
  labels: { fr: labels[0], en: labels[1], he: labels[2] },
});

/** Une section du site, qui a son adresse dans chaque langue. */
const section = (
  id: string,
  key: Parameters<typeof sectionPath>[0],
  labels: [string, string, string],
): FestivalLink => ({
  id,
  path: (locale) => sectionPath(key, locale),
  labels: { fr: labels[0], en: labels[1], he: labels[2] },
});

const LINKS: Record<string, FestivalLink> = {
  slihot: library("slihot", "/bibliotheque/moadim/slihot", [
    "Les Sli'hot, en hébreu et en phonétique",
    "The Selichot, in Hebrew and transliteration",
    "הסליחות, בעברית ובתעתיק",
  ]),
  ataratNedarim: library("ataratNedarim", "/bibliotheque/moadim/atarat-nedarim", [
    "L'Atarat nedarim, l'annulation des vœux de la veille",
    "The Hatarat Nedarim, the annulment of vows on the eve",
    "התרת נדרים של הערב שלפני",
  ]),
  netilatLoulav: library("netilatLoulav", "/bibliotheque/moadim/netilat-loulav", [
    "Les brahot du loulav, et le séder qui les précède",
    "The blessings on the lulav, and the seder before them",
    "ברכות הלולב והסדר שלפניהן",
  ]),
  sederLeilSouccot: library("sederLeilSouccot", "/bibliotheque/moadim/seder-leil-souccot", [
    "Le séder du premier soir dans la soucca",
    "The seder of the first evening in the sukkah",
    "סדר ליל סוכות בסוכה",
  ]),
  hochanot: library("hochanot", "/bibliotheque/moadim/hochanot-yom-richon", [
    "Les Hochanot, jour par jour",
    "The Hoshanot, day by day",
    "ההושענות, יום אחר יום",
  ]),
  hochanotRabba: library("hochanotRabba", "/bibliotheque/moadim/hochanot-hochana-rabba", [
    "Les Hochanot de Hochaana Rabba, et ses sept hakafot",
    "The Hoshanot of Hoshana Rabbah, and its seven hakafot",
    "הושענות הושענא רבה ושבע ההקפות",
  ]),
  nerotHanouka: library("nerotHanouka", "/bibliotheque/moadim/nerot-hanouka", [
    "L'allumage de la 'hanoukia et ses bénédictions",
    "Lighting the chanukiah and its blessings",
    "הדלקת נרות חנוכה וברכותיה",
  ]),
  sidour: library("sidour", "/bibliotheque/sidour", [
    "Le sidour : Cha'harit, Min'ha, Arvit",
    "The siddur: Shacharit, Mincha, Arvit",
    "הסידור: שחרית, מנחה, ערבית",
  ]),
  brahot: library("brahot", "/bibliotheque/brahot", [
    "Les brahot, bénédiction par bénédiction",
    "The berachot, blessing by blessing",
    "הברכות, ברכה אחר ברכה",
  ]),
  tanakh: library("tanakh", "/bibliotheque/tanakh", [
    "Le Tanakh : la Torah, les Neviim, les Ketouvim",
    "The Tanakh: Torah, Neviim, Ketuvim",
    "התנ״ך: תורה, נביאים, כתובים",
  ]),
  tehilimBook: library("tehilimBook", "/bibliotheque/tehilim", [
    "Les 150 Tehilim, psaume par psaume",
    "The 150 Tehillim, psalm by psalm",
    "מאה וחמישים תהילים, מזמור אחר מזמור",
  ]),
  tehilimIntentions: library("tehilimIntentions", "/tehilim", [
    "Quels Tehilim lire, selon l'intention",
    "Which Tehillim to read, by intention",
    "אילו תהילים לומר, לפי הכוונה",
  ]),
  partageTehilim: section("partageTehilim", "partageTehilim", [
    "Répartir les Tehilim entre plusieurs personnes",
    "Share the Tehillim between several people",
    "לחלק את התהילים בין כמה אנשים",
  ]),
  paracha: section("paracha", "paracha", [
    "La paracha de la semaine, et son calendrier",
    "This week's parasha, and its calendar",
    "פרשת השבוע והלוח שלה",
  ]),
};

/**
 * Les liens d'une fête, désignée par son slug français (la clé stable de
 * `SEO_FESTIVALS`). Ceux qui vont de soi (le calendrier, les horaires, les
 * zmanim) restent dans la phrase de `festivalAroundHtml` : ils sont les mêmes
 * pour toutes les fêtes, et n'ont pas à être répétés ici.
 */
const BY_FESTIVAL: Record<string, string[]> = {
  "roch-hachana": ["slihot", "ataratNedarim", "sidour", "partageTehilim"],
  "jeune-guedalia": ["slihot", "sidour", "tehilimIntentions"],
  "yom-kippour": ["slihot", "ataratNedarim", "sidour", "tehilimIntentions"],
  souccot: ["sederLeilSouccot", "netilatLoulav", "hochanot", "sidour", "tehilimBook"],
  "hochaana-rabba": ["hochanotRabba", "netilatLoulav", "sidour", "partageTehilim"],
  "chemini-atseret": ["sidour", "paracha", "tehilimBook"],
  "simhat-torah": ["paracha", "tanakh", "sidour"],
  hanouka: ["nerotHanouka", "sidour", "tehilimBook"],
  "10-tevet": ["sidour", "tehilimIntentions", "partageTehilim"],
  "tou-bichvat": ["brahot", "sidour"],
  "jeune-esther": ["sidour", "tehilimIntentions", "partageTehilim"],
  pourim: ["brahot", "sidour", "tehilimBook"],
  pessah: ["sidour", "tehilimBook", "brahot", "paracha"],
  "lag-baomer": ["tehilimBook", "partageTehilim", "sidour"],
  chavouot: ["paracha", "tanakh", "sidour", "partageTehilim"],
  "17-tamouz": ["sidour", "tehilimIntentions", "partageTehilim"],
  "ticha-beav": ["tehilimIntentions", "partageTehilim", "sidour"],
};

/** Les liens à proposer sur la page de cette fête, dans l'ordre. */
export function festivalLinks(frSlug: string): FestivalLink[] {
  return (BY_FESTIVAL[frSlug] ?? []).map((id) => LINKS[id]).filter(Boolean);
}
