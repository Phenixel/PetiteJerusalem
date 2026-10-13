/**
 * Les textes de la page du Sidour, et l'ordre où elle les range.
 *
 * Trois corpus du catalogue (Sidour, Brahot, Moadim) n'en font plus qu'un pour
 * le lecteur : ce qu'on dit. La page les pose en une seule liste, sans les
 * livres qui les séparaient, mais pas sans repères : de légers intertitres par
 * usage (les offices, le soir, les brahot, les occasions, les étapes de la
 * vie), puis les fêtes en bas. Le temps d'une fête, ses textes remontent en
 * tête de la liste.
 *
 * Les adresses ne changent pas (/bibliotheque/<corpus>/<texte>) : elles sont
 * publiées, et une version installée de l'app les lit encore.
 *
 * Ce module ne tire que le catalogue : le prérendu en fait le corps statique
 * de /sidour, la page en fait sa liste. Le moment (l'office en cours, la fête)
 * se calcule ailleurs (services/sidourMoment), avec le moteur des horaires.
 */
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { corpusOf, hubPath, latinName, slugOf } from "./etudeTexts";
import { MOADIM_BOOK_BY_THEME } from "./moadimNow";

/** Un groupe d'usage de la liste. */
export type SidourGroupId = "offices" | "soir" | "brahot" | "occasions" | "vie";

/**
 * Une fête qui a ses textes dans Moadim, nommée comme son thème (voir
 * holidayThemes et content/moadimNow).
 */
export type FeastId = "tichri" | "souccot" | "hanouka";

export interface SidourText {
  /** « corpus/slug » : la clé d'un texte sur cette page. */
  key: string;
  entry: TextStudyJsonEntry;
  path: string;
  /** Le nom latin du catalogue (« Birkat Hamazon »). */
  latin: string;
  /** Le nom hébreu du catalogue (« ברכת המזון »). */
  hebrew: string;
}

export interface SidourSection {
  /**
   * `group` : un groupe d'usage ; `feast-now` : la fête en cours, remontée en
   * tête ; `feasts` : les textes des fêtes de l'année, en bas.
   */
  kind: "group" | "feast-now" | "feasts";
  id: SidourGroupId | FeastId | "fetes";
  /** Clé i18n de l'intertitre. */
  labelKey: string;
  items: SidourText[];
}

/**
 * Où va chaque texte. Un texte ajouté au catalogue sans y être rangé ici
 * tombe dans les occasions, et sidourGroups.test.ts le signale.
 */
const GROUPS: { id: SidourGroupId; labelKey: string; keys: string[] }[] = [
  {
    id: "offices",
    labelKey: "sidour.groups.offices",
    keys: ["sidour/chaharit", "sidour/minha", "sidour/arvit", "sidour/kaddich"],
  },
  {
    id: "soir",
    labelKey: "sidour.groups.soir",
    keys: ["sidour/chema-al-hamita", "sidour/tikoun-hatsot"],
  },
  {
    id: "brahot",
    labelKey: "sidour.groups.brahot",
    keys: [
      "brahot/birkat-hamazon",
      "brahot/brakha-aharona",
      "brahot/birkot-hanehenin",
      "brahot/acher-yatsar",
      "brahot/brahot-chonot",
    ],
  },
  {
    id: "occasions",
    labelKey: "sidour.groups.occasions",
    keys: [
      "sidour/havdala",
      "brahot/birkat-halevana",
      "brahot/tefilat-haderekh",
      "brahot/birkat-hailanot",
      "brahot/hafrashat-halla",
      "brahot/teroumot-oumaasrot",
    ],
  },
  {
    id: "vie",
    labelKey: "sidour.groups.vie",
    keys: ["brahot/brit-mila", "brahot/cheva-brahot", "brahot/hachkava"],
  },
];

/** L'intertitre d'une fête remontée en tête. */
export const FEAST_LABEL_KEYS: Record<FeastId, string> = {
  tichri: "sidour.feasts.tichri",
  souccot: "sidour.feasts.souccot",
  hanouka: "sidour.feasts.hanouka",
};

/** Les intertitres en français, pour le corps prérendu de /sidour. */
export const SIDOUR_LABELS_FR: Record<SidourGroupId | "fetes", string> = {
  offices: "Les offices",
  soir: "Le soir",
  brahot: "Brahot",
  occasions: "Occasions",
  vie: "Les étapes de la vie",
  fetes: "Les fêtes",
};

const LITURGY = new Set(["sidour", "brahot", "moadim"]);

/** Le nom hébreu d'une entrée : « ברכת המזון (Birkat Hamazon) » → « ברכת המזון ». */
function hebrewName(entry: TextStudyJsonEntry): string {
  return entry.name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function toText(entry: TextStudyJsonEntry): SidourText {
  return {
    key: `${corpusOf(entry)}/${slugOf(entry)}`,
    entry,
    path: hubPath(entry),
    latin: latinName(entry),
    hebrew: hebrewName(entry),
  };
}

/** Tous les textes de la page, dans l'ordre du catalogue. */
export const sidourTexts: SidourText[] = (textStudiesJson as TextStudiesJson).textStudies
  .filter((entry) => LITURGY.has(corpusOf(entry)))
  .map(toText);

const byKey = new Map(sidourTexts.map((text) => [text.key, text]));

/** Un texte de la page par sa clé « corpus/slug », s'il existe. */
export function sidourText(key: string): SidourText | null {
  return byKey.get(key) ?? null;
}

/** La fête d'un texte de Moadim, d'après son livre ; null pour les autres. */
export function feastOf(text: SidourText): FeastId | null {
  if (corpusOf(text.entry) !== "moadim") return null;
  const found = (Object.keys(FEAST_LABEL_KEYS) as FeastId[]).find(
    (feast) => MOADIM_BOOK_BY_THEME[feast] === text.entry.livre,
  );
  return found ?? null;
}

/** Les textes qui ne sont rangés dans aucun groupe (hors Moadim). */
export function unplacedTexts(): SidourText[] {
  const placed = new Set(GROUPS.flatMap((group) => group.keys));
  return sidourTexts.filter((text) => corpusOf(text.entry) !== "moadim" && !placed.has(text.key));
}

/**
 * Les sections de la page : la fête en cours d'abord (s'il y en a une), puis
 * les groupes d'usage, puis les textes des autres fêtes.
 */
export function sidourSections(currentFeast: FeastId | null = null): SidourSection[] {
  const sections: SidourSection[] = [];
  const feastTexts = sidourTexts.filter((text) => corpusOf(text.entry) === "moadim");

  const now = currentFeast ? feastTexts.filter((text) => feastOf(text) === currentFeast) : [];
  if (currentFeast && now.length > 0) {
    sections.push({
      kind: "feast-now",
      id: currentFeast,
      labelKey: FEAST_LABEL_KEYS[currentFeast],
      items: now,
    });
  }

  const unplaced = unplacedTexts();
  for (const group of GROUPS) {
    const items = group.keys.map((key) => byKey.get(key)).filter((t): t is SidourText => !!t);
    if (group.id === "occasions") items.push(...unplaced);
    if (items.length > 0)
      sections.push({ kind: "group", id: group.id, labelKey: group.labelKey, items });
  }

  const later = feastTexts.filter((text) => !now.includes(text));
  if (later.length > 0)
    sections.push({ kind: "feasts", id: "fetes", labelKey: "sidour.groups.fetes", items: later });
  return sections;
}
