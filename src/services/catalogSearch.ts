/**
 * Recherche dans le catalogue des textes : la seule logique, partagée par la
 * bibliothèque (StudyPage), la composition de la lecture du jour
 * (DailyReading) et le choix des textes d'une chaîne (sessionService, via
 * searchService). Trois copies avaient divergé : l'une cherchait dans le nom
 * latin, les autres non.
 *
 * Un texte se trouve par son nom hébreu, son nom latin, son livre, et ses
 * autres noms (datas/catalogAliases) ; quelle que soit la graphie, et à une
 * faute de frappe près (services/fuzzySearch).
 *
 * Aucune dépendance à Vue : le module se lit aussi depuis les services.
 */
import { BOOK_ALIASES, TEXT_ALIASES } from "../datas/catalogAliases";
import { matchesQuery, searchItems, type SearchField } from "./fuzzySearch";
import { toHebrewNumeral } from "./hebrewNumerals";

/** Un texte tel que la recherche le voit : son nom, et le livre qui le porte. */
export interface SearchableText {
  name: string;
  livre?: string;
}

/** « ברכות (Berakhot) » → « Berakhot » ; un nom sans parenthèses reste tel quel. */
export function latinPart(name: string): string {
  const m = name.match(/\(([^)]+)\)\s*$/);
  return (m ? m[1] : name).trim();
}

/** Le nom d'un livre ou d'un seder tel qu'on l'affiche en titre de groupe. */
export function bookName(livre: string): string {
  return latinPart(livre);
}

/**
 * Les autres noms d'un texte : les siens, ceux de son livre, et pour un
 * Tehilim ceux que tout le monde tape (« Psaume 23 », « תהילים כג »).
 */
export function aliasesOf(text: SearchableText): string[] {
  const latin = latinPart(text.name);
  const aliases = [...(TEXT_ALIASES[latin] ?? [])];
  if (text.livre) {
    aliases.push(...(TEXT_ALIASES[`${latin}|${text.livre}`] ?? []));
    aliases.push(...(BOOK_ALIASES[bookName(text.livre)] ?? []));
  }
  const psalm = latin.match(/^Tehilim (\d+)$/);
  if (psalm) {
    const n = Number(psalm[1]);
    aliases.push(
      `Psaume ${n}`,
      `Psalm ${n}`,
      "Psaumes",
      "Psalms",
      `תהילים ${n}`,
      `תהילים ${toHebrewNumeral(n)}`,
    );
  }
  return aliases;
}

function searchFields(text: SearchableText): SearchField[] {
  return [text.name, text.livre, ...aliasesOf(text)];
}

/** Vrai si le texte répond au terme, fût-ce à une faute près. */
export function matchesSearch(text: SearchableText, term: string): boolean {
  return matchesQuery(term, searchFields(text));
}

/**
 * Les textes qui répondent au terme, dans l'ordre du catalogue ; tous quand
 * il est vide. Les réponses approchantes ne viennent que faute de mieux.
 */
export function filterBySearch<T extends SearchableText>(texts: T[], term: string): T[] {
  return searchItems(texts, term, searchFields, { keepOrder: true });
}

/** Les textes regroupés par livre (ou seder), dans l'ordre du catalogue. */
export function groupByBook<T extends { livre: string }>(texts: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const text of texts) (groups[text.livre] ??= []).push(text);
  return groups;
}
