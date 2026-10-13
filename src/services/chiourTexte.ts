import textStudiesJson from "../datas/textStudies.json";
import type { Chiour, TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import {
  TORAH_LIVRES,
  corpusOf,
  hubPath,
  isMultiSection,
  sectionPath,
} from "../content/etudeTexts";

/**
 * Le lien entre un cours audio et le texte de la bibliothèque qu'il étudie.
 *
 * Un chiour porte deux champs (voir ChiourDoc) : `texteId`, l'identifiant de
 * l'entrée du catalogue (src/datas/textStudies.json), et `texteChapitre`, la
 * division de ce texte quand le cours en suit une. Le chapitre se compte
 * comme la bibliothèque compte :
 *
 * - un texte en plusieurs pages (un traité, une porte de 'Hovot Halévavot,
 *   une lettre du Pélé Yoets) : l'index de la section, celui de son adresse
 *   (/bibliotheque/talmud/berakhot/3) ;
 * - un texte d'une seule page (un livre des Prophètes, une paracha) : le rang
 *   de son bloc, 1 pour le premier (le chapitre, la montée). Le lecteur s'y
 *   rend par `?chapitre=N`.
 *
 * Un identifiant que le catalogue ne connaît pas (un livre ajouté depuis, lu
 * par une version plus ancienne) ne donne pas de lien : le cours s'affiche
 * comme avant.
 */

const entries = (textStudiesJson as TextStudiesJson).textStudies;
const byId = new Map<number, TextStudyJsonEntry>(entries.map((e) => [Number(e.id), e]));

/** L'entrée du catalogue d'un identifiant, ou null s'il est inconnu. */
export function texteOf(id: number | null | undefined): TextStudyJsonEntry | null {
  if (typeof id !== "number") return null;
  return byId.get(id) ?? null;
}

/** Les textes qu'on peut rattacher à un cours : tout le catalogue de lecture. */
export function linkableTextes(): TextStudyJsonEntry[] {
  return entries.filter((e) => Boolean(corpusOf(e)));
}

/** Le nom hébreu d'une entrée : « ברכות (Berakhot) » → « ברכות ». */
export function hebrewName(entry: TextStudyJsonEntry): string {
  return entry.name.replace(/\s*\([^)]*\)\s*$/, "").trim() || entry.name;
}

/** Le nom latin d'une entrée : « ברכות (Berakhot) » → « Berakhot ». */
export function latinTexteName(entry: TextStudyJsonEntry): string {
  return (entry.name.match(/\(([^)]+)\)\s*$/)?.[1] ?? entry.name).trim();
}

const isPeleYoets = (entry: TextStudyJsonEntry) => entry.livre.includes("Pélé Yoets");
const isParasha = (entry: TextStudyJsonEntry) =>
  corpusOf(entry) === "tanakh" && TORAH_LIVRES.has(entry.livre);

/**
 * Le titre d'un texte rattaché, dans l'alphabet du lecteur : de quoi le
 * reconnaître hors de la bibliothèque (« Talmud Berakhot », « Michna Avot »,
 * « Paracha Vayetze », « Chaar Habita'hon »).
 */
export function texteTitle(entry: TextStudyJsonEntry, locale: string): string {
  if (locale === "he") return hebrewName(entry);
  const name = latinTexteName(entry);
  switch (corpusOf(entry)) {
    case "talmud":
      return `Talmud ${name}`;
    case "michna":
      return `Michna ${name}`;
    case "tanakh":
      return isParasha(entry) ? `Paracha ${name}` : name;
    default:
      return name;
  }
}

/**
 * Ce que désigne le chapitre d'un texte, pour l'écrire sans charger le texte :
 * l'introduction d'une porte, le sujet du Pélé Yoets, la montée d'une
 * paracha, sinon un chapitre. La vue le traduit (chiourim.texte.*).
 */
export type ChapitreKind = "introduction" | "topic" | "aliya" | "chapter";

export function chapitreKind(entry: TextStudyJsonEntry, chapitre: number): ChapitreKind {
  if (String(corpusOf(entry)) === "moussar" && chapitre === 0) return "introduction";
  if (isPeleYoets(entry)) return "topic";
  if (!isMultiSection(entry) && isParasha(entry)) return "aliya";
  return "chapter";
}

/** Peut-on préciser un chapitre de ce texte ? Pas d'une tefila, ni d'un psaume seul. */
export function hasChapitres(entry: TextStudyJsonEntry): boolean {
  const corpus = corpusOf(entry);
  if (corpus === "tehilim" || corpus === "sidour" || corpus === "brahot" || corpus === "moadim")
    return false;
  return true;
}

/**
 * L'adresse du texte d'un cours, au chapitre près : la page de la section
 * d'un texte en plusieurs pages, le bloc d'un texte d'une page
 * (`?chapitre=`), le texte entier à défaut.
 */
export function texteRoute(
  entry: TextStudyJsonEntry,
  chapitre: number | null,
): { path: string; query?: Record<string, string> } {
  if (chapitre === null || !hasChapitres(entry)) return { path: hubPath(entry) };
  if (isMultiSection(entry)) return { path: sectionPath(entry, chapitre) };
  return { path: hubPath(entry), query: { chapitre: String(chapitre) } };
}

export interface ChiourTexte {
  entry: TextStudyJsonEntry;
  chapitre: number | null;
}

/** Le texte d'un cours, ou null s'il n'en a pas (ou un que le catalogue ignore). */
export function chiourTexte(chiour: Pick<Chiour, "texteId" | "texteChapitre">): ChiourTexte | null {
  const entry = texteOf(chiour.texteId);
  if (!entry) return null;
  const chapitre =
    typeof chiour.texteChapitre === "number" && hasChapitres(entry) ? chiour.texteChapitre : null;
  return { entry, chapitre };
}

/**
 * Le texte d'une série : celui que partagent ses épisodes, s'ils en ont un.
 * Une série mêle parfois deux livres (un cours d'introduction) : on garde le
 * texte du plus grand nombre, à condition qu'il couvre la moitié de la série.
 */
export function serieTexte(episodes: Chiour[]): TextStudyJsonEntry | null {
  const counts = new Map<number, number>();
  for (const e of episodes) {
    if (texteOf(e.texteId)) counts.set(e.texteId!, (counts.get(e.texteId!) ?? 0) + 1);
  }
  let best: [number, number] | null = null;
  for (const pair of counts) if (!best || pair[1] > best[1]) best = pair;
  if (!best || best[1] * 2 < episodes.length) return null;
  return texteOf(best[0]);
}

/**
 * Les cours d'un texte, ceux du chapitre ouvert d'abord, puis dans l'ordre
 * du texte (chapitre, puis épisode).
 */
export function chiourimOfTexte(
  chiourim: Chiour[],
  texteId: number,
  chapitre: number | null = null,
): Chiour[] {
  const order = (c: Chiour) => [
    chapitre !== null && c.texteChapitre === chapitre ? 0 : 1,
    c.texteChapitre ?? -1,
    c.episode ?? Number.MAX_SAFE_INTEGER,
  ];
  return chiourim
    .filter((c) => c.texteId === texteId)
    .sort((a, b) => {
      const [x, y] = [order(a), order(b)];
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
      return a.name.localeCompare(b.name, "fr");
    });
}
