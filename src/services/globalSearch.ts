import citiesJson from "../datas/cities.json";
import type { Chiour, Session, TextStudyJsonEntry } from "../models/models";
import type { City } from "./zmanimService";
import { bookName, filterBySearch, latinPart, normalizeSearch } from "./catalogSearch";
import { corpusOf, hubPath, studyEntries, type Corpus } from "../content/etudeTexts";
import { HUB_CITY_NAME, cityName, citySlug } from "../content/zmanimCities";
import { SEO_FESTIVALS } from "../content/zmanimFestivals";
import { SEO_LOCALES, sectionPath, type SeoLocale, type SeoSection } from "../content/seoLocales";

/**
 * La recherche unique : tout ce que le site contient, cherché au même
 * endroit (page /recherche). Chaque source a sa fonction, pure, qui reçoit
 * le terme et ce dans quoi chercher, et rend des résultats de la même forme
 * (SearchHit) : c'est la page qui les range en sections.
 *
 * Deux familles de sources :
 *
 * - **embarquées** (le catalogue des textes, les villes des horaires, les
 *   fêtes du calendrier, les pages de l'app) : des données qui voyagent avec
 *   le bundle, cherchées de façon synchrone, hors ligne comme en ligne ;
 * - **en ligne** (les chaînes de lecture, les chiourim) : la page charge les
 *   listes depuis Firestore et les passe aux fonctions d'ici, qui ne font que
 *   filtrer. Sans réseau, le cache persistant de Firestore sert ce qu'il a.
 *
 * La recherche dans le contenu des textes vit à part (textContentSearch.ts) :
 * elle est asynchrone et lit des fichiers.
 *
 * Aucune dépendance à Vue ni à Firebase : le module se teste à sec.
 */

export type SearchKind = "page" | "text" | "session" | "chiour" | "city" | "festival";

export interface SearchHit {
  kind: SearchKind;
  /** Unique dans sa section : la clé de rendu. */
  id: string;
  title: string;
  /** Une ligne de contexte : le livre d'un texte, l'auteur d'un chiour, le créateur d'une chaîne. */
  subtitle?: string;
  /** Clé i18n d'une pastille (le corpus d'un texte). */
  tagKey?: string;
  /** Le chemin à ouvrir. */
  to: string;
  /** Chaîne de lecture close ou échue : affichée après les autres, et dite telle. */
  finished?: boolean;
}

/** Une fonction de traduction, telle que vue-i18n en donne une : la seule chose qu'on lui demande. */
export type Translate = (key: string) => string;

/** Au-delà, une section n'affiche plus que les premiers et dit combien restent. */
export const SECTION_LIMIT = 10;

/** Les premiers résultats d'une section, et le total qu'ils représentent. */
export function capHits<T>(hits: T[], limit = SECTION_LIMIT): { hits: T[]; total: number } {
  return { hits: hits.slice(0, limit), total: hits.length };
}

/**
 * Les résultats dont le titre COMMENCE par le terme passent devant ceux qui
 * ne font que le contenir : « Berakhot » avant « Birkat Hamazon » quand on
 * tape « ber ». Tri stable : à rang égal, l'ordre d'origine reste.
 */
export function rankByPrefix<T extends { title: string }>(hits: T[], term: string): T[] {
  const needle = normalizeSearch(term);
  if (!needle) return hits;
  const rank = (hit: T) => {
    const title = normalizeSearch(hit.title);
    if (title.startsWith(needle)) return 0;
    if (normalizeSearch(latinPart(hit.title)).startsWith(needle)) return 1;
    return 2;
  };
  return hits
    .map((hit, index) => ({ hit, index, rank: rank(hit) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ hit }) => hit);
}

// ---------------------------------------------------------------------------
// Les pages de l'app
// ---------------------------------------------------------------------------

interface PageEntry {
  id: string;
  /** Clé i18n du titre de la page, tel que le bandeau ou la page le disent. */
  labelKey: string;
  /** Une section traduite (adresse par langue)… */
  section?: SeoSection;
  /** …ou un chemin unique. */
  path?: string;
  /** Ce qu'on tape pour la trouver, dans les trois langues, sans se soucier des accents. */
  keywords: string;
}

/**
 * Les pages qu'on cherche par leur nom, pour y sauter sans passer par le
 * menu : « lecture du jour », « réglages », « calendrier ». Le titre traduit
 * compte aussi comme mot-clé, la liste ci-dessous ajoute les synonymes.
 */
const PAGES: PageEntry[] = [
  { id: "home", labelKey: "common.home", section: "home", keywords: "accueil home בית" },
  {
    id: "library",
    labelKey: "study.title",
    path: "/bibliotheque",
    keywords: "bibliotheque library textes texts lire read ספרייה ספריה",
  },
  {
    id: "share",
    labelKey: "common.shareReading",
    path: "/share-reading",
    keywords: "partage lectures chaine chaines session sessions share reading שיתוף קריאה",
  },
  {
    id: "chiourim",
    labelKey: "common.chiourim",
    path: "/chiourim",
    keywords: "chiourim chiour cours audio shiur shiurim lessons שיעור שיעורים",
  },
  {
    id: "zmanim",
    labelKey: "zmanim.title",
    section: "horaires",
    keywords: "horaires zmanim chabbat shabbat times heures זמנים שבת",
  },
  {
    id: "calendar",
    labelKey: "calendar.title",
    section: "calendrier",
    keywords: "calendrier fetes holidays calendar חגים לוח שנה",
  },
  {
    id: "daily",
    labelKey: "dailyReading.title",
    path: "/bibliotheque/lecture-du-jour",
    keywords: "lecture du jour quotidienne daily reading קריאה יומית",
  },
  {
    id: "chneiMikra",
    labelKey: "chneiMikra.title",
    path: "/bibliotheque/chnei-mikra",
    keywords: "chnei mikra targoum shnayim shnaim targum שניים מקרא תרגום",
  },
  {
    id: "tehilimDay",
    labelKey: "tehilimDay.title",
    path: "/bibliotheque/tehilim-du-jour",
    keywords: "tehilim du jour psaumes psalms of the day תהילים יומי",
  },
  {
    id: "paracha",
    labelKey: "paracha.title",
    section: "paracha",
    keywords: "paracha parasha parashat semaine week פרשה פרשת השבוע",
  },
  {
    id: "settings",
    labelKey: "profile.guestTitle",
    path: "/profile",
    keywords: "reglages profil settings profile theme langue polices הגדרות פרופיל",
  },
];

/** Les pages dont le titre ou un mot-clé contient le terme. */
export function searchPages(term: string, locale: SeoLocale, t: Translate): SearchHit[] {
  const needle = normalizeSearch(term);
  if (needle.length < 2) return [];
  return PAGES.filter((page) => {
    const haystack = normalizeSearch(`${t(page.labelKey)} ${page.keywords}`);
    return haystack.includes(needle);
  }).map((page) => ({
    kind: "page",
    id: page.id,
    title: t(page.labelKey),
    to: page.section ? sectionPath(page.section, locale) : (page.path ?? "/"),
  }));
}

// ---------------------------------------------------------------------------
// Le catalogue des textes
// ---------------------------------------------------------------------------

const CORPUS_LABEL_KEY: Record<Corpus, string> = {
  tehilim: "study.types.tehilim",
  michna: "study.types.mishna",
  talmud: "study.types.talmud",
  tanakh: "study.types.tanakh",
  sidour: "study.types.sidour",
  slihot: "study.types.slihot",
  brahot: "study.types.brahot",
};

function textHit(entry: TextStudyJsonEntry): SearchHit {
  const book = bookName(entry.livre ?? "");
  return {
    kind: "text",
    id: String(entry.id),
    title: entry.name,
    // Le livre ne se répète pas quand il porte le nom du texte (un livre du
    // Tanakh à une seule entrée, par exemple).
    subtitle: book && book !== latinPart(entry.name) ? book : undefined,
    tagKey: CORPUS_LABEL_KEY[corpusOf(entry)],
    to: hubPath(entry),
  };
}

/** Les textes du catalogue qui répondent au terme (même règle que la bibliothèque), les préfixes d'abord. */
export function searchTexts(term: string, entries: TextStudyJsonEntry[] = studyEntries): SearchHit[] {
  if (normalizeSearch(term) === "") return [];
  return rankByPrefix(filterBySearch(entries, term).map(textHit), term);
}

// ---------------------------------------------------------------------------
// Les chaînes de lecture (partage)
// ---------------------------------------------------------------------------

export interface SessionSearchOptions {
  /** Créateurs bloqués par le visiteur (modération) : leurs chaînes ne paraissent pas. */
  blockedCreatorIds?: Iterable<string>;
  /** Close ou échue : voir sessionService.isSessionFinished. */
  isFinished?: (session: Session) => boolean;
}

/**
 * Les chaînes dont le nom, le créateur ou la description contient le terme,
 * hors chaînes masquées par la modération. Celles en cours passent devant les
 * terminées.
 */
export function searchSessions(
  sessions: Session[],
  term: string,
  options: SessionSearchOptions = {},
): SearchHit[] {
  const needle = normalizeSearch(term);
  if (!needle) return [];
  const blocked = new Set(options.blockedCreatorIds ?? []);
  const isFinished = options.isFinished ?? (() => false);
  const hits = sessions
    .filter((session) => session.hidden !== true && !blocked.has(session.personId))
    .filter((session) =>
      [session.name, session.creatorName, session.description].some((value) =>
        normalizeSearch(value ?? "").includes(needle),
      ),
    )
    .map<SearchHit>((session) => ({
      kind: "session",
      id: session.id,
      title: session.name,
      subtitle: session.creatorName || undefined,
      to: `/share-reading/session/${session.slug ?? session.id}`,
      finished: isFinished(session),
    }));
  return [...hits.filter((hit) => !hit.finished), ...hits.filter((hit) => hit.finished)];
}

// ---------------------------------------------------------------------------
// Les chiourim
// ---------------------------------------------------------------------------

/** Les chiourim dont le titre, l'auteur, la description ou une catégorie contient le terme. */
export function searchChiourim(chiourim: Chiour[], term: string): SearchHit[] {
  const needle = normalizeSearch(term);
  if (!needle) return [];
  const hits = chiourim
    .filter((chiour) =>
      [chiour.name, chiour.auteur ?? "", chiour.description, ...chiour.categories].some((value) =>
        normalizeSearch(value).includes(needle),
      ),
    )
    .map<SearchHit>((chiour) => ({
      kind: "chiour",
      id: chiour.slug,
      title: chiour.name,
      subtitle: chiour.auteur ?? undefined,
      to: `/chiourim/${chiour.slug}`,
    }));
  return rankByPrefix(hits, term);
}

// ---------------------------------------------------------------------------
// Les villes (horaires)
// ---------------------------------------------------------------------------

const cities = citiesJson as City[];

/**
 * Les villes dont le nom commence par le terme, puis celles qui le
 * contiennent (même ordre que le sélecteur de la page des horaires), dans la
 * langue de l'espace où l'on est. Deux lettres au moins : « a » rendrait la
 * moitié du catalogue.
 */
export function searchCities(term: string, locale: SeoLocale, limit = 8): SearchHit[] {
  const needle = normalizeSearch(term);
  if (needle.length < 2) return [];
  const starts: City[] = [];
  const contains: City[] = [];
  for (const city of cities) {
    const names = [city.name, cityName(city.name, locale)].map(normalizeSearch);
    if (names.some((name) => name.startsWith(needle))) starts.push(city);
    else if (names.some((name) => name.includes(needle))) contains.push(city);
  }
  return [...starts, ...contains].slice(0, limit).map((city) => ({
    kind: "city",
    id: `${city.name}-${city.country}`,
    title: cityName(city.name, locale),
    subtitle: city.country,
    to:
      city.name === HUB_CITY_NAME
        ? sectionPath("horaires", locale)
        : sectionPath("horaires", locale, citySlug(city.name)),
  }));
}

// ---------------------------------------------------------------------------
// Les fêtes (calendrier)
// ---------------------------------------------------------------------------

/**
 * Les fêtes dont le nom, dans l'une des trois langues, contient le terme :
 * « pessah », « passover » et « פסח » mènent à la même page, celle de
 * l'espace de langue où l'on est.
 */
export function searchFestivals(term: string, locale: SeoLocale): SearchHit[] {
  const needle = normalizeSearch(term);
  if (needle.length < 2) return [];
  return SEO_FESTIVALS.filter((festival) =>
    SEO_LOCALES.some(
      (lang) =>
        normalizeSearch(festival.labels[lang]).includes(needle) ||
        normalizeSearch(festival.names[lang]).includes(needle),
    ),
  ).map((festival) => ({
    kind: "festival",
    id: festival.slugs.fr,
    title: festival.labels[locale],
    to: sectionPath("calendrier", locale, festival.slugs[locale]),
  }));
}
