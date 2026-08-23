/**
 * Les fêtes qui ont leur page (/calendrier/:fete), et leurs slugs.
 *
 * Module volontairement minuscule, comme zmanimCities.ts : il est partagé
 * entre la vue CalendarPage (qui résout la fête de l'URL et l'ouvre) et le
 * prérendu SEO (zmanimSeoPages.ts, qui écrit la page), pour que les slugs ne
 * divergent jamais entre le routeur et les pages générées. Les textes de
 * présentation, eux, ne servent qu'au prérendu et restent là-bas.
 */

export type SeoFestival = {
  /**
   * Le nom hebcal-fr exact de l'entrée du calendrier, marques diacritiques
   * retirées. L'égalité est stricte : sans quoi Pourim attraperait Chouchan
   * Pourim et Pourim Katan.
   */
  name: string;
  /** La graphie française la plus cherchée, celle des titres et des liens. */
  label: string;
  /** Le segment d'URL, sous /calendrier/. */
  slug: string;
  /**
   * Quand le jour est un jeûne sans Yom Tov : « dawn » pour les jeûnes courts
   * (de l'aube à la sortie des étoiles), « eve » pour le 9 Av, qui commence
   * la veille au soir. Absent pour les fêtes.
   */
  fast?: "dawn" | "eve";
};

export const SEO_FESTIVALS: SeoFestival[] = [
  { name: "Roch Hachanah", label: "Roch Hachana", slug: "roch-hachana" },
  { name: "Tzom Guedalyah", label: "Jeûne de Guedalia", slug: "jeune-guedalia", fast: "dawn" },
  { name: "Yom Kippour", label: "Yom Kippour", slug: "yom-kippour" },
  { name: "Soukkot", label: "Souccot", slug: "souccot" },
  { name: "Chemini Atzéret · Simhat Torah", label: "Simhat Torah", slug: "simhat-torah" },
  { name: "Hanoukah", label: "Hanouka", slug: "hanouka" },
  { name: "Assarah beTévet", label: "10 Tevet", slug: "10-tevet", fast: "dawn" },
  { name: "Tou biChvat", label: "Tou Bichvat", slug: "tou-bichvat" },
  { name: "Ta'anit Esther", label: "Jeûne d'Esther", slug: "jeune-esther", fast: "dawn" },
  { name: "Pourim", label: "Pourim", slug: "pourim" },
  { name: "Pessah", label: "Pessah", slug: "pessah" },
  { name: "Lag ba'Omer", label: "Lag Baomer", slug: "lag-baomer" },
  { name: "Chavou'ot", label: "Chavouot", slug: "chavouot" },
  { name: "Tzom Tammouz", label: "17 Tamouz", slug: "17-tamouz", fast: "dawn" },
  { name: "Tich'ah beAv", label: "9 Av", slug: "ticha-beav", fast: "eve" },
];

/** La fête qui porte ce slug, ou null. */
export const findFestivalBySlug = (slug: string): SeoFestival | null =>
  SEO_FESTIVALS.find((festival) => festival.slug === slug) ?? null;
