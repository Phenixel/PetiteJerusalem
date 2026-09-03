/**
 * Les langues du site, vues des URL.
 *
 * Le site s'affiche en français, en anglais et en hébreu, mais jusqu'ici une
 * seule URL servait les trois : la langue était choisie dans le navigateur
 * (localStorage, puis navigator.language). Un moteur de recherche n'avait donc
 * aucun moyen de découvrir les versions anglaise et hébraïque : aucune adresse
 * ne les portait. Le site était trilingue pour ses visiteurs et monolingue
 * pour Google.
 *
 * D'où le schéma standard, posé ici : une URL par langue. Le français reste à
 * la racine (c'est l'historique, et le x-default), l'anglais et l'hébreu
 * prennent un préfixe. Les segments eux-mêmes sont traduits : un anglophone
 * cherche « shabbat times », pas « horaires ».
 *
 *   /horaires/lyon        /en/shabbat-times/lyon      /he/zmanei-shabbat/lyon
 *   /calendrier/pessah    /en/holidays/passover       /he/chagim/pesach
 *
 * Les slugs de villes, eux, ne sont pas traduits : ce sont des noms propres,
 * et un seul slug par ville évite trois catalogues qui divergeraient.
 *
 * Module minuscule et sans dépendance : il est chargé par le routeur, par les
 * vues et par le prérendu.
 */

export type SeoLocale = "fr" | "en" | "he";

/** Les langues servies, français en tête (c'est le repli et le x-default). */
export const SEO_LOCALES: SeoLocale[] = ["fr", "en", "he"];

/** La langue de repli : ses pages vivent à la racine, sans préfixe. */
export const DEFAULT_SEO_LOCALE: SeoLocale = "fr";

/** Le préfixe d'URL d'une langue : rien pour le français, « /en », « /he ». */
const localePrefix = (locale: SeoLocale): string =>
  locale === DEFAULT_SEO_LOCALE ? "" : `/${locale}`;

/** L'attribut `lang` du document. */
export const HTML_LANG: Record<SeoLocale, string> = { fr: "fr", en: "en", he: "he" };

/** Le sens d'écriture : l'hébreu s'écrit de droite à gauche. */
export const HTML_DIR: Record<SeoLocale, "ltr" | "rtl"> = { fr: "ltr", en: "ltr", he: "rtl" };

/** La locale Open Graph, dans la graphie qu'attend Facebook. */
export const OG_LOCALE: Record<SeoLocale, string> = {
  fr: "fr_FR",
  en: "en_US",
  he: "he_IL",
};

/** Le code hreflang : la langue seule suffit, le site ne vise pas un pays. */
export const HREFLANG: Record<SeoLocale, string> = { fr: "fr", en: "en", he: "he" };

/**
 * Les sections qui ont une page dans les trois langues, et leur segment
 * d'URL dans chacune. Le mot cherché est dans l'adresse : c'est ce qui
 * distingue « /en/shabbat-times » d'un « /en/horaires » illisible.
 */
export type SeoSection =
  | "home"
  | "horaires"
  | "calendrier"
  | "zmanim"
  | "paracha"
  | "finirLeChass"
  | "partageTehilim"
  | "confidentialite"
  | "aPropos"
  | "mentionsLegales"
  | "conditions";

export const SECTION_SLUGS: Record<SeoSection, Record<SeoLocale, string>> = {
  home: { fr: "", en: "", he: "" },
  horaires: { fr: "horaires", en: "shabbat-times", he: "zmanei-shabbat" },
  calendrier: { fr: "calendrier", en: "holidays", he: "chagim" },
  zmanim: { fr: "zmanim", en: "zmanim", he: "zmanim" },
  paracha: { fr: "paracha", en: "parasha", he: "parasha" },
  finirLeChass: { fr: "finir-le-chass", en: "finish-the-shas", he: "siyum-hashas" },
  partageTehilim: { fr: "partage-tehilim", en: "share-tehillim", he: "chalukat-tehilim" },
  confidentialite: { fr: "confidentialite", en: "privacy", he: "privacy" },
  aPropos: { fr: "a-propos", en: "about", he: "about" },
  mentionsLegales: { fr: "mentions-legales", en: "legal-notice", he: "legal-notice" },
  conditions: { fr: "conditions-utilisation", en: "terms", he: "terms" },
};

/**
 * Le chemin d'une page : le préfixe de langue, le segment traduit de la
 * section, puis ce qui reste (un slug de ville, une fête). « / » pour
 * l'accueil français, « /en » pour l'accueil anglais.
 */
export function sectionPath(section: SeoSection, locale: SeoLocale, ...rest: string[]): string {
  const parts = [SECTION_SLUGS[section][locale], ...rest].filter(Boolean);
  const path = `${localePrefix(locale)}/${parts.join("/")}`;
  // « /en/ » n'est pas « /en » : on ne laisse pas traîner de barre finale,
  // sous peine de servir deux URL pour la même page.
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/** Le fichier statique d'un chemin : `/en/shabbat-times` → `en/shabbat-times.html`. */
export function fileForPath(path: string): string {
  const trimmed = path.replace(/^\//, "");
  return trimmed ? `${trimmed}.html` : "index.html";
}

/**
 * Les URL sœurs d'une page dans les autres langues, telles que les attend
 * `hreflang`. La table dit, pour chaque langue, le chemin correspondant :
 * une page qui n'existe pas dans une langue n'y figure simplement pas, plutôt
 * que d'annoncer une traduction qui n'existe pas.
 */
export type Alternates = Partial<Record<SeoLocale, string>>;

/** Les chemins d'une même page dans toutes les langues d'une section. */
export function alternatesOf(section: SeoSection, ...rest: string[]): Alternates {
  const alternates: Alternates = {};
  for (const locale of SEO_LOCALES) alternates[locale] = sectionPath(section, locale, ...rest);
  return alternates;
}

/** La langue qu'une URL impose : celle de son préfixe, français sans préfixe. */
export function localeOfPath(path: string): SeoLocale {
  const first = path.split("/").filter(Boolean)[0];
  return SEO_LOCALES.find((locale) => locale !== DEFAULT_SEO_LOCALE && locale === first)
    ? (first as SeoLocale)
    : DEFAULT_SEO_LOCALE;
}

/**
 * La même page dans une autre langue, ou null si le chemin ne correspond à
 * aucune section traduite : sur /bibliotheque, changer de langue ne change pas
 * d'adresse, il n'y en a qu'une.
 */
export function translatePath(path: string, target: SeoLocale): string | null {
  const segments = path.split("/").filter(Boolean);
  const locale = localeOfPath(path);
  if (locale !== DEFAULT_SEO_LOCALE) segments.shift();
  if (!segments.length) return sectionPath("home", target);
  const section = (Object.keys(SECTION_SLUGS) as SeoSection[]).find(
    (key) => key !== "home" && SECTION_SLUGS[key][locale] === segments[0],
  );
  if (!section) return null;
  return sectionPath(section, target, ...segments.slice(1));
}

/**
 * Le chemin appartient-il à cette section, dans n'importe quelle langue ?
 * Sert aux vues, qui servent la même page à trois adresses, et au routeur.
 */
export function isSectionPath(path: string, section: SeoSection): boolean {
  return SEO_LOCALES.some((locale) => {
    const root = sectionPath(section, locale);
    return path === root || path.startsWith(`${root}/`);
  });
}
