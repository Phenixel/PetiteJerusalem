import type { City } from "../services/zmanimService";

/**
 * Les villes des pages « Horaires de Chabbat à … » (/horaires/:ville).
 *
 * Module volontairement minuscule (pas de catalogue, pas de hebcal) : il est
 * partagé entre la vue ZmanimPage (qui résout la ville de l'URL contre le
 * catalogue chargé à la demande) et le prérendu SEO (zmanimSeoPages.ts), pour
 * que les slugs ne divergent jamais entre le routeur et les pages générées.
 */

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
 * Les villes dont la page d'horaires est prérendue et mise en avant : les
 * grandes communautés francophones (France, Belgique, Suisse, Canada) et les
 * villes d'Israël les plus recherchées par le public francophone. Noms exacts
 * du catalogue (src/datas/cities.json), un test le vérifie.
 *
 * Paris n'y est pas : /horaires est déjà sa page (le repli de l'application).
 * Jérusalem non plus : l'usage y est d'allumer 40 minutes avant la chkia,
 * quand l'application calcule partout 18 minutes ; plutôt qu'une page fausse,
 * pas de page.
 */
export const SEO_CITY_NAMES: string[] = [
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
  "Tel Aviv",
  "Netanya",
  "Ashdod",
];

/** La ville du catalogue qui porte ce slug, ou null. */
export function findCityBySlug(cities: City[], slug: string): City | null {
  return cities.find((city) => citySlug(city.name) === slug) ?? null;
}
