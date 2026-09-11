/**
 * Recherche dans le catalogue des textes : la seule logique, partagée par la
 * bibliothèque (StudyPage), la composition de la lecture du jour
 * (DailyReading) et le choix des textes d'une chaîne (sessionService, via
 * searchService). Trois copies avaient divergé : l'une cherchait dans le nom
 * latin, les autres non.
 *
 * Aucune dépendance à Vue : le module se lit aussi depuis les services.
 */

/** Un texte tel que la recherche le voit : son nom, et le livre qui le porte. */
export interface SearchableText {
  name: string;
  livre?: string;
}

/**
 * Les signes de l'hébreu qui ne sont pas des lettres : voyelles (niqqud),
 * cantillation (te'amim), méteg, rafé, points du chin et du sin. On les
 * retire avant de comparer : on tape « ברכות » sans voyelles, alors que le
 * texte les porte.
 */
const HEBREW_MARKS = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g;

/** La chaîne sans ses signes hébraïques (voir HEBREW_MARKS). */
export function stripHebrewMarks(value: string): string {
  return value.replace(HEBREW_MARKS, "");
}

/**
 * Forme comparable d'une chaîne : minuscules, sans accents, sans voyelles ni
 * cantillation hébraïques, une seule graphie d'apostrophe. « Min’ha »,
 * « Sli'hot », « berechit » et « בְּרֵאשִׁית » se trouvent ainsi quelle que
 * soit la touche tapée.
 */
export function normalizeSearch(value: string): string {
  return stripHebrewMarks(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‘’ʼ`]/g, "'")
    .toLowerCase()
    .trim();
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

/** Vrai si le texte répond au terme : par son nom hébreu, latin, ou son livre. */
export function matchesSearch(text: SearchableText, term: string): boolean {
  const needle = normalizeSearch(term);
  if (needle === "") return true;
  const haystacks = [text.name, latinPart(text.name), text.livre ?? ""];
  return haystacks.some((value) => normalizeSearch(value).includes(needle));
}

/** Les textes qui répondent au terme ; tous quand il est vide. */
export function filterBySearch<T extends SearchableText>(texts: T[], term: string): T[] {
  if (normalizeSearch(term) === "") return texts;
  return texts.filter((text) => matchesSearch(text, term));
}

/** Les textes regroupés par livre (ou seder), dans l'ordre du catalogue. */
export function groupByBook<T extends { livre: string }>(texts: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const text of texts) (groups[text.livre] ??= []).push(text);
  return groups;
}
