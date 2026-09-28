/**
 * Les fêtes qui ont leur page (/calendrier/:fete), leurs slugs et leurs noms,
 * dans les trois langues.
 *
 * Module volontairement minuscule, comme zmanimCities.ts : il est partagé
 * entre la vue CalendarPage (qui résout la fête de l'URL et l'ouvre) et le
 * prérendu SEO (zmanimSeoPages.ts, qui écrit la page), pour que les slugs ne
 * divergent jamais entre le routeur et les pages générées. Les textes de
 * présentation, eux, ne servent qu'au prérendu et restent là-bas.
 *
 * Les slugs sont traduits comme le reste : on cherche « passover dates », pas
 * « pessah dates », et « פסח » plutôt que l'un ou l'autre.
 */

import { SEO_LOCALES, type SeoLocale } from "./seoLocales";

export type SeoFestival = {
  /**
   * Le nom hebcal exact de l'entrée du calendrier dans chaque langue, marques
   * diacritiques du français retirées. L'égalité est stricte : sans quoi
   * Pourim attraperait Chouchan Pourim et Pourim Katan. Un nom par langue,
   * parce que le calendrier est calculé dans la langue de la page.
   */
  names: Record<SeoLocale, string>;
  /** Le segment d'URL, sous /calendrier, /en/holidays ou /he/chagim. */
  slugs: Record<SeoLocale, string>;
  /** Le nom de la fête dans chaque langue, celui des titres et des liens. */
  labels: Record<SeoLocale, string>;
  /**
   * Quand le jour est un jeûne sans Yom Tov : « dawn » pour les jeûnes courts
   * (de l'aube à la sortie des étoiles), « eve » pour le 9 Av, qui commence
   * la veille au soir. Absent pour les fêtes.
   */
  fast?: "dawn" | "eve";
  /**
   * La date hébraïque du jour, pour les fêtes que hebcal ne nomme pas à part.
   *
   * Hochaana Rabba est le septième jour de Souccot : hebcal la rend sous le
   * nom de Souccot, comme les autres jours de 'Hol haMoed, et aucun nom ne
   * permet de la reconnaître. Sa date, elle, ne bouge pas : le 21 Tichri,
   * en Israël comme en diaspora. C'est donc par là qu'on la tient.
   */
  hebrewDate?: { day: number; month: string };
};

const festival = (
  names: [string, string, string],
  slugs: [string, string, string],
  labels: [string, string, string],
  fast?: "dawn" | "eve",
  hebrewDate?: { day: number; month: string },
): SeoFestival => ({
  names: { fr: names[0], en: names[1], he: names[2] },
  slugs: { fr: slugs[0], en: slugs[1], he: slugs[2] },
  labels: { fr: labels[0], en: labels[1], he: labels[2] },
  ...(fast ? { fast } : {}),
  ...(hebrewDate ? { hebrewDate } : {}),
});

export const SEO_FESTIVALS: SeoFestival[] = [
  festival(
    ["Roch Hachanah", "Rosh Hashana", "רֹאשׁ הַשָּׁנָה"],
    ["roch-hachana", "rosh-hashanah", "rosh-hashana"],
    ["Roch Hachana", "Rosh Hashanah", "ראש השנה"],
  ),
  festival(
    ["Tzom Guedalyah", "Tzom Gedaliah", "צוֹם גְּדַלְיָה"],
    ["jeune-guedalia", "fast-of-gedaliah", "tzom-gedalya"],
    ["Jeûne de Guedalia", "Fast of Gedaliah", "צום גדליה"],
    "dawn",
  ),
  festival(
    ["Yom Kippour", "Yom Kippur", "יוֹם כִּפּוּר"],
    ["yom-kippour", "yom-kippur", "yom-kippur"],
    ["Yom Kippour", "Yom Kippur", "יום כיפור"],
  ),
  festival(
    ["Soukkot", "Sukkot", "סֻכּוֹת"],
    ["souccot", "sukkot", "sukkot"],
    ["Souccot", "Sukkot", "סוכות"],
  ),
  // Hochaana Rabba n'a pas de nom à elle chez hebcal (c'est le septième jour
  // de Souccot) : sa date la désigne. « Quand tombe Hochaana Rabba » est une
  // vraie question, la nuit se veille et l'office est long ; la page manquait.
  festival(
    ["Hochaana Rabba", "Hoshana Rabbah", "הוֹשַׁעְנָא רַבָּה"],
    ["hochaana-rabba", "hoshana-rabbah", "hoshana-raba"],
    ["Hochaana Rabba", "Hoshana Rabbah", "הושענא רבה"],
    undefined,
    { day: 21, month: "Tishrei" },
  ),
  // Chemini Atséret vivait fondue dans la page de Simhat Torah : en diaspora
  // ce sont deux jours distincts, et « chemini atseret date » ne trouvait
  // rien. En Israël, les deux tombent le même jour, et les deux pages le
  // disent.
  festival(
    ["Chemini Atzéret", "Shmini Atzeret", "שְׁמִינִי עֲצֶרֶת"],
    ["chemini-atseret", "shmini-atzeret", "shmini-atzeret"],
    ["Chemini Atséret", "Shmini Atzeret", "שמיני עצרת"],
  ),
  // Le français et l'anglais ne nomment que Simhat Torah : Chemini Atséret a
  // sa page, et la fête tombe le lendemain en diaspora. L'hébreu garde les
  // deux noms parce qu'en Israël hebcal n'émet que Chemini Atséret : sans le
  // premier nom, la page hébraïque n'aurait plus de jour à dater.
  festival(
    ["Simhat Torah", "Simchat Torah", "שְׁמִינִי עֲצֶרֶת · שִׂמְחַת תּוֹרָה"],
    ["simhat-torah", "simchat-torah", "simchat-tora"],
    ["Simhat Torah", "Simchat Torah", "שמחת תורה"],
  ),
  festival(
    ["Hanoukah", "Chanukah", "חֲנוּכָּה"],
    ["hanouka", "hanukkah", "chanuka"],
    ["Hanouka", "Hanukkah", "חנוכה"],
  ),
  festival(
    ["Assarah beTévet", "Asara B'Tevet", "עֲשָׂרָה בְּטֵבֵת"],
    ["10-tevet", "tenth-of-tevet", "asara-betevet"],
    ["10 Tevet", "Tenth of Tevet", "עשרה בטבת"],
    "dawn",
  ),
  festival(
    ["Tou biChvat", "Tu BiShvat", "ט״וּ בִּשְׁבָט"],
    ["tou-bichvat", "tu-bishvat", "tu-bishvat"],
    ["Tou Bichvat", "Tu Bishvat", "ט״ו בשבט"],
  ),
  festival(
    ["Ta'anit Esther", "Ta'anit Esther", "תַּעֲנִית אֶסְתֵּר"],
    ["jeune-esther", "fast-of-esther", "taanit-ester"],
    ["Jeûne d'Esther", "Fast of Esther", "תענית אסתר"],
    "dawn",
  ),
  festival(
    ["Pourim", "Purim", "פּוּרִים"],
    ["pourim", "purim", "purim"],
    ["Pourim", "Purim", "פורים"],
  ),
  festival(
    ["Pessah", "Pesach", "פֶּסַח"],
    ["pessah", "passover", "pesach"],
    ["Pessah", "Passover", "פסח"],
  ),
  festival(
    ["Lag ba'Omer", "Lag BaOmer", "ל״ג בָּעוֹמֶר"],
    ["lag-baomer", "lag-baomer", "lag-baomer"],
    ["Lag Baomer", "Lag BaOmer", "ל״ג בעומר"],
  ),
  festival(
    ["Chavou'ot", "Shavuot", "שָׁבוּעוֹת"],
    ["chavouot", "shavuot", "shavuot"],
    ["Chavouot", "Shavuot", "שבועות"],
  ),
  festival(
    ["Tzom Tammouz", "Tzom Tammuz", "צוֹם י״ז בְּתַמּוּז"],
    ["17-tamouz", "seventeenth-of-tammuz", "shiva-asar-betamuz"],
    ["17 Tamouz", "Seventeenth of Tammuz", "שבעה עשר בתמוז"],
    "dawn",
  ),
  festival(
    ["Tich'ah beAv", "Tish'a B'Av", "תִּשְׁעָה בְּאָב"],
    ["ticha-beav", "tisha-bav", "tisha-beav"],
    ["9 Av", "Tisha B'Av", "תשעה באב"],
    "eve",
  ),
];

/**
 * La fête qui porte ce slug, dans n'importe laquelle des langues.
 *
 * On cherche dans toutes plutôt que dans celle de l'URL : quelques slugs sont
 * communs (purim, sukkot), et un lien ancien ou recopié d'une autre langue
 * doit ouvrir la bonne fête plutôt que retomber sur le calendrier.
 */
export function findFestivalBySlug(slug: string): SeoFestival | null {
  return (
    SEO_FESTIVALS.find((festival) =>
      SEO_LOCALES.some((locale) => festival.slugs[locale] === slug),
    ) ?? null
  );
}
