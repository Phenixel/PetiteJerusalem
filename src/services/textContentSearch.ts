import type { TextStudyJsonEntry } from "../models/models";
import {
  loadText as loadTextFromLibrary,
  type SectionHeading,
  type TextContent,
} from "./textService";
import { sectionPath } from "../content/etudeTexts";
import { stripHebrewMarks } from "./catalogSearch";

/**
 * La recherche DANS les textes : un mot ou une expression en hébreu, cherché
 * ligne à ligne (verset, michna, ligne de daf) dans les livres présents sur
 * l'appareil.
 *
 * Pourquoi seulement ceux-là : la bibliothèque pèse près de 40 Mo, on ne la
 * télécharge pas pour une recherche. Ce qui est déjà là (les Tehilim,
 * embarqués, et les livres que l'utilisateur a téléchargés) se lit sans
 * réseau, et se cherche donc sans réseau ; c'est ce qui rend la recherche
 * utile dans l'app en mode avion. Sur le site, les Tehilim sont servis en un
 * seul petit fichier : ils se cherchent toujours, les autres corpus dès qu'on
 * les a téléchargés (voir offlineLibraryService.isEntryOnDevice).
 *
 * Pourquoi l'hébreu : c'est la seule langue des lignes. La phonétique du
 * lecteur est calculée à l'affichage, il n'y a pas de texte latin à chercher.
 *
 * La recherche lit les fichiers un à un, rend la main entre deux livres et
 * s'arrête dès qu'on la lui demande (une nouvelle frappe) : un Talmud
 * entièrement téléchargé se parcourt sans figer l'écran.
 */

export interface PassageHit {
  entry: TextStudyJsonEntry;
  sectionIndex: number;
  sectionLabel: string;
  /** Le titre structuré de la section (chapitre, daf), quand elle en a un : la page l'écrit dans la langue du lecteur. */
  sectionHeading?: SectionHeading;
  /** Index de la ligne dans la section : c'est le `?verset=` du lecteur. */
  line: number;
  /** L'extrait, sans voyelles ni cantillation, coupé aux mots : avant, le mot trouvé, après. */
  before: string;
  match: string;
  after: string;
  /** La page du lecteur, ouverte sur la ligne. */
  to: string;
}

/** Vrai dès que le terme porte une lettre hébraïque : c'est là que les passages se cherchent. */
export function hasHebrewLetters(value: string): boolean {
  return /[א-ת]/.test(value);
}

/**
 * Forme comparable d'une ligne de texte hébreu : sans balises, sans voyelles
 * ni cantillation, les signes de ponctuation massorétique (maqaf, paseq, sof
 * pasouq) rendus par une espace, comme on les tape. Tout ce qui n'est pas une
 * lettre devient une espace, les espaces se réduisent à une.
 */
export function normalizeHebrew(value: string): string {
  return stripHebrewMarks(value.replace(/<[^>]*>/g, ""))
    .replace(/[^א-ת]+/g, " ")
    .trim();
}

/** Longueur minimale d'une recherche dans les textes : deux lettres attrapent tout. */
export const MIN_PASSAGE_TERM = 3;

/**
 * L'extrait autour d'une occurrence : `radius` caractères de chaque côté,
 * élargis au mot entier plutôt que coupés au milieu, avec des points de
 * suspension là où la ligne continue.
 */
export function snippetAround(
  text: string,
  start: number,
  end: number,
  radius = 40,
): { before: string; match: string; after: string } {
  let from = Math.max(0, start - radius);
  if (from > 0) {
    const space = text.indexOf(" ", from);
    if (space !== -1 && space < start) from = space + 1;
  }
  let to = Math.min(text.length, end + radius);
  if (to < text.length) {
    const space = text.lastIndexOf(" ", to);
    if (space > end) to = space;
  }
  return {
    before: (from > 0 ? "…" : "") + text.slice(from, start),
    match: text.slice(start, end),
    after: text.slice(end, to) + (to < text.length ? "…" : ""),
  };
}

export interface PassageSearchOptions {
  /** Comment lire un texte (textService.loadText, sauf en test). */
  loadText?: (entry: TextStudyJsonEntry) => Promise<TextContent>;
  /** Résultats au plus, tous livres confondus. */
  maxHits?: number;
  /** Résultats au plus par texte : dix versets du même psaume n'apprennent rien. */
  maxPerEntry?: number;
  /** Vrai quand la recherche ne sert plus (le terme a changé) : on s'arrête là. */
  isCancelled?: () => boolean;
  /** Appelé après chaque livre qui a donné quelque chose : les résultats s'affichent au fil de l'eau. */
  onHits?: (hits: PassageHit[]) => void;
}

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Cherche le terme dans les lignes des textes donnés, dans l'ordre reçu,
 * et rend les passages trouvés. Un texte illisible (fichier absent) est
 * passé sans bruit : la recherche continue avec les autres.
 */
export async function searchPassages(
  entries: TextStudyJsonEntry[],
  term: string,
  options: PassageSearchOptions = {},
): Promise<PassageHit[]> {
  const needle = normalizeHebrew(term);
  if (needle.length < MIN_PASSAGE_TERM) return [];
  const load = options.loadText ?? loadTextFromLibrary;
  const maxHits = options.maxHits ?? 40;
  const maxPerEntry = options.maxPerEntry ?? 5;
  const cancelled = options.isCancelled ?? (() => false);

  const hits: PassageHit[] = [];
  for (const entry of entries) {
    if (cancelled()) break;
    let content: TextContent;
    try {
      content = await load(entry);
    } catch {
      continue;
    }
    if (cancelled()) break;

    let inEntry = 0;
    for (const section of content.sections) {
      for (let line = 0; line < section.he.length && inEntry < maxPerEntry; line++) {
        const text = normalizeHebrew(section.he[line]);
        const start = text.indexOf(needle);
        if (start === -1) continue;
        hits.push({
          entry,
          sectionIndex: section.index,
          sectionLabel: section.label,
          sectionHeading: section.heading,
          line,
          ...snippetAround(text, start, start + needle.length),
          to: `${sectionPath(entry, section.index)}?verset=${line}`,
        });
        inEntry++;
        if (hits.length >= maxHits) {
          options.onHits?.([...hits]);
          return hits;
        }
      }
      if (inEntry >= maxPerEntry) break;
    }
    if (inEntry > 0) options.onHits?.([...hits]);
    await yieldToUi();
  }
  return hits;
}
