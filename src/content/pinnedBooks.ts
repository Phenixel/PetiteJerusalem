import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { corpusOf, hubPath } from "./etudeTexts";
import { hebrewName, latinTexteName, texteTitle } from "../services/chiourTexte";
import { filterBySearch } from "../services/catalogSearch";
import { normalizeText } from "../services/fuzzySearch";
import { PINNABLE_SECTIONS, type PinRef } from "../composables/useHomePinned";

/**
 * The books pinned to the home page (useHomePinned), as the shelf draws them
 * and the edit mode lists them: the catalog is read here, in the chunks of
 * HomePinnedBooks and HomePinnedEditor, loaded on demand.
 */
export interface PinnedBook {
  ref: PinRef;
  /** The corpus, whose binding the volume takes (config/bindings.ts). */
  corpus: string;
  to: string;
  /** The title on the cover: short (« Chaharit », « Berakhot »). */
  cover: string;
  /** The full title, in lists (« Talmud Berakhot »). */
  title: string;
}

type Translate = (key: string) => string;

const texts = (textStudiesJson as TextStudiesJson).textStudies;
const byId = new Map(texts.map((entry) => [String(entry.id), entry]));

function ofText(entry: TextStudyJsonEntry, locale: string): PinnedBook {
  return {
    ref: `text:${entry.id}`,
    corpus: corpusOf(entry),
    to: hubPath(entry),
    cover: locale === "he" ? hebrewName(entry) : latinTexteName(entry),
    title: texteTitle(entry, locale),
  };
}

/** A pinned reference, or null when this version does not know it. */
export function resolvePin(ref: PinRef, t: Translate, locale: string): PinnedBook | null {
  const [kind, id] = ref.split(":");
  if (kind === "text") {
    const entry = byId.get(id ?? "");
    return entry ? ofText(entry, locale) : null;
  }
  const section = PINNABLE_SECTIONS.find((one) => one.corpus === id);
  if (!section) return null;
  const label = t(section.labelKey);
  return { ref, corpus: section.corpus, to: section.to, cover: label, title: label };
}

/**
 * What answers a search, for pinning: the whole sections whose name holds
 * the term, then the texts of the whole catalog, the Sidour's included.
 */
export function searchPinnable(
  term: string,
  t: Translate,
  locale: string,
  limit = 8,
): PinnedBook[] {
  const folded = normalizeText(term).trim();
  if (folded.length < 2) return [];
  const sections = PINNABLE_SECTIONS.filter((section) =>
    normalizeText(t(section.labelKey)).includes(folded),
  ).map((section) => resolvePin(`book:${section.corpus}`, t, locale)!);
  const found = filterBySearch(texts, term).map((entry) => ofText(entry, locale));
  return [...sections, ...found].slice(0, limit);
}
