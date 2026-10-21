/**
 * The share images of the site (Open Graph, 1200×630): the banner a link
 * shows on WhatsApp, Facebook or X, drawn by the designer, one per section
 * and per language.
 *
 * A page does not choose its banner: its path does. Every page of a section
 * (the Shabbat times hub and each city, the calendar and each holiday, the
 * library and each text) shares the section's banner, in the page's language.
 * A section the designer has not drawn in a language falls back on the
 * general banner of that language, never on another language: a Hebrew page
 * shared with a French image would look like a mistake.
 *
 * The files live in `public/og/` (web only: the native bundle drops them,
 * see scripts/prune-native-bundle.mjs).
 *
 * Small and dependency free like `seoLocales.ts`: loaded by the prerender.
 */
import { SITE_URL } from "../config/site";
import { isSectionPath, localeOfPath, type SeoLocale } from "./seoLocales";

export type OgBanner = "site" | "partageLectures" | "bibliotheque" | "horaires" | "fetes";

/**
 * The text of each banner, in each language it exists in. It becomes the
 * image's `og:image:alt`: what the banner says, for whoever cannot see it.
 */
const BANNERS: Record<OgBanner, { file: string; alt: Partial<Record<SeoLocale, string>> }> = {
  site: {
    file: "site",
    alt: {
      fr: "Petite Jérusalem : étudier la Torah, ensemble. Lire, écouter, partager, où que l'on soit.",
      en: "Petite Jerusalem: learning Torah, together. Read, listen, share, wherever you are.",
      he: "פטיט ירושלים: ללמוד תורה, יחד. לקרוא, להאזין, לחלוק, מכל מקום.",
    },
  },
  partageLectures: {
    file: "partage-lectures",
    alt: {
      fr: "Petite Jérusalem, partage de lectures : un texte, plusieurs lecteurs, un seul siyoum.",
    },
  },
  bibliotheque: {
    file: "bibliotheque",
    alt: {
      fr: "Petite Jérusalem, bibliothèque : hébreu et phonétique, ligne à ligne, pour lire même sans parler hébreu.",
    },
  },
  horaires: {
    file: "horaires",
    alt: {
      fr: "Petite Jérusalem, horaires de Chabbat : l'allumage et la sortie de Chabbat, pour votre ville.",
      en: "Petite Jerusalem, Shabbat times: candle lighting and Shabbat end, for your city.",
      he: "פטיט ירושלים: הדלקת נרות וצאת השבת, לפי העיר שלך.",
    },
  },
  fetes: {
    file: "fetes",
    alt: {
      fr: "Petite Jérusalem, calendrier des fêtes : toutes les fêtes juives, avec leurs dates, année après année.",
      en: "Petite Jerusalem, Jewish holidays: every Jewish holiday, with its dates, year after year.",
      he: "פטיט ירושלים, לוח החגים: כל חגי ישראל, עם התאריכים, שנה אחר שנה.",
    },
  },
};

/** Sections drawn in French only: the reading pages, outside the localized sections. */
const FRENCH_PREFIXES: [string, OgBanner][] = [
  ["/share-reading", "partageLectures"],
  ["/bibliotheque", "bibliotheque"],
  ["/tehilim", "bibliotheque"],
  ["/sidour", "bibliotheque"],
];

const startsWithPath = (path: string, root: string): boolean =>
  path === root || path.startsWith(`${root}/`);

/** The banner of a path, before its language is taken into account. */
export function ogBannerOfPath(path: string): OgBanner {
  if (isSectionPath(path, "horaires")) return "horaires";
  if (isSectionPath(path, "calendrier")) return "fetes";
  // Finishing the Shas and sharing Tehilim are the reading sharing, told to
  // someone who searched for it.
  if (isSectionPath(path, "finirLeChass") || isSectionPath(path, "partageTehilim")) {
    return "partageLectures";
  }
  return FRENCH_PREFIXES.find(([root]) => startsWithPath(path, root))?.[1] ?? "site";
}

/** The share image of a page: its URL and its alt text, in the page's language. */
export function ogImageOf(
  path: string,
  locale: SeoLocale = localeOfPath(path),
): { url: string; alt: string } {
  const wanted = BANNERS[ogBannerOfPath(path)];
  const banner = wanted.alt[locale] ? wanted : BANNERS.site;
  return {
    url: `${SITE_URL}/og/${banner.file}-${locale}.png`,
    alt: banner.alt[locale] ?? (BANNERS.site.alt.fr as string),
  };
}

/** Every banner file, to check that none is missing from `public/og/`. */
export function ogBannerFiles(): string[] {
  return Object.values(BANNERS).flatMap(({ file, alt }) =>
    Object.keys(alt).map((locale) => `${file}-${locale}.png`),
  );
}
