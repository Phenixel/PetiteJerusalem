import type { City } from "../services/zmanimService";

/**
 * Les villes des pages « Horaires de Chabbat à … » (/horaires/:ville).
 *
 * Module volontairement minuscule (pas de catalogue, pas de hebcal) : il est
 * partagé entre la vue ZmanimPage (qui résout la ville de l'URL contre le
 * catalogue chargé à la demande) et le prérendu SEO (zmanimSeoPages.ts), pour
 * que les slugs ne divergent jamais entre le routeur et les pages générées.
 *
 * Toutes les villes du catalogue (src/datas/cities.json) ont désormais leur
 * page prérendue, Paris excepté : /horaires est déjà la sienne. La liste
 * n'est donc plus écrite à la main ici, elle se déduit du catalogue au build
 * (voir `seoCities` dans zmanimSeoPages.ts) ; ne restent ici que ce qui ne
 * s'en déduit pas : les slugs, les noms de pays et les villes mises en avant.
 */

/** La ville dont /horaires est la page : elle n'a pas de page à elle. */
export const HUB_CITY_NAME = "Paris";

/**
 * Slug d'URL d'une ville : minuscules, sans accents, tirets.
 * « Boulogne-Billancourt » → « boulogne-billancourt », « Genève » → « geneve »,
 * « Tel Aviv » → « tel-aviv ».
 */
export function citySlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Les villes mises en avant sur le hub /horaires, avant la liste complète :
 * les grandes communautés francophones et les villes d'Israël les plus
 * cherchées par ce public. Noms exacts du catalogue, un test le vérifie.
 */
export const FEATURED_CITY_NAMES: string[] = [
  "Marseille",
  "Lyon",
  "Nice",
  "Strasbourg",
  "Toulouse",
  "Sarcelles",
  "Créteil",
  "Boulogne-Billancourt",
  "Bordeaux",
  "Montpellier",
  "Cannes",
  "Grenoble",
  "Metz",
  "Nancy",
  "Bruxelles",
  "Genève",
  "Montréal",
  "Jérusalem",
  "Tel Aviv",
  "Netanya",
  "Ashdod",
];

/**
 * Les pays du catalogue, en français, pour grouper l'annuaire des villes.
 *
 * `where` porte la locution complète (« en France », « au Maroc », « aux
 * Pays-Bas », « à Monaco ») : la préposition ne se déduit pas du nom, et un
 * titre « Horaires de Chabbat en Maroc » se voit tout de suite.
 */
export const COUNTRIES: Record<string, { name: string; where: string }> = {
  FR: { name: "France", where: "en France" },
  IL: { name: "Israël", where: "en Israël" },
  BE: { name: "Belgique", where: "en Belgique" },
  CH: { name: "Suisse", where: "en Suisse" },
  CA: { name: "Canada", where: "au Canada" },
  MA: { name: "Maroc", where: "au Maroc" },
  TN: { name: "Tunisie", where: "en Tunisie" },
  DZ: { name: "Algérie", where: "en Algérie" },
  LU: { name: "Luxembourg", where: "au Luxembourg" },
  MC: { name: "Monaco", where: "à Monaco" },
  GB: { name: "Royaume-Uni", where: "au Royaume-Uni" },
  US: { name: "États-Unis", where: "aux États-Unis" },
  AR: { name: "Argentine", where: "en Argentine" },
  AT: { name: "Autriche", where: "en Autriche" },
  AU: { name: "Australie", where: "en Australie" },
  BR: { name: "Brésil", where: "au Brésil" },
  CL: { name: "Chili", where: "au Chili" },
  CO: { name: "Colombie", where: "en Colombie" },
  CZ: { name: "République tchèque", where: "en République tchèque" },
  DE: { name: "Allemagne", where: "en Allemagne" },
  DK: { name: "Danemark", where: "au Danemark" },
  ES: { name: "Espagne", where: "en Espagne" },
  FI: { name: "Finlande", where: "en Finlande" },
  GR: { name: "Grèce", where: "en Grèce" },
  HK: { name: "Hong Kong", where: "à Hong Kong" },
  HU: { name: "Hongrie", where: "en Hongrie" },
  IE: { name: "Irlande", where: "en Irlande" },
  IN: { name: "Inde", where: "en Inde" },
  IT: { name: "Italie", where: "en Italie" },
  JP: { name: "Japon", where: "au Japon" },
  MX: { name: "Mexique", where: "au Mexique" },
  NL: { name: "Pays-Bas", where: "aux Pays-Bas" },
  NO: { name: "Norvège", where: "en Norvège" },
  PA: { name: "Panama", where: "au Panama" },
  PE: { name: "Pérou", where: "au Pérou" },
  PL: { name: "Pologne", where: "en Pologne" },
  PT: { name: "Portugal", where: "au Portugal" },
  RO: { name: "Roumanie", where: "en Roumanie" },
  RU: { name: "Russie", where: "en Russie" },
  SE: { name: "Suède", where: "en Suède" },
  SG: { name: "Singapour", where: "à Singapour" },
  TH: { name: "Thaïlande", where: "en Thaïlande" },
  TR: { name: "Turquie", where: "en Turquie" },
  UA: { name: "Ukraine", where: "en Ukraine" },
  UY: { name: "Uruguay", where: "en Uruguay" },
  ZA: { name: "Afrique du Sud", where: "en Afrique du Sud" },
};

/** Les pays mis en tête de l'annuaire : c'est là qu'est le public du site. */
export const COUNTRY_ORDER: string[] = ["FR", "IL", "BE", "CH", "CA", "MA", "TN", "DZ", "LU", "MC"];

/** Le nom français d'un pays, ou son code quand il manque à la table. */
export const countryName = (code: string): string => COUNTRIES[code]?.name ?? code;

/** « en France », « au Maroc » : le pays précédé de sa préposition. */
export const inCountry = (code: string): string => COUNTRIES[code]?.where ?? code;

/** La ville du catalogue qui porte ce slug, ou null. */
export function findCityBySlug(cities: City[], slug: string): City | null {
  return cities.find((city) => citySlug(city.name) === slug) ?? null;
}
