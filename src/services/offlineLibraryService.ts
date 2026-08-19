import { computed, reactive } from "vue";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { resolveFilePath } from "./textService";
import {
  downloadFile,
  downloadManifest,
  ensureManifestLoaded,
  isDownloaded,
  isDownloadCurrent,
  removeFile,
} from "./offlineTextStore";
import { isNativeApp } from "../composables/useNativeApp";

/**
 * Vue « bibliothèque » du stockage hors ligne : regroupe le catalogue
 * (`textStudies.json`) en livres téléchargeables, un livre = un fichier
 * JSON sous `/texts/**` (tous les Tehilim partagent par exemple le même
 * fichier). S'appuie sur `offlineTextStore` pour le stockage lui-même.
 */

const TALMUD_CHAPTERS_PATH = "/texts/talmud-chapters.json";

/**
 * Fichiers embarqués dans le binaire natif : ils sont lisibles hors ligne sans
 * rien télécharger. Les corpus volumineux, eux, sont retirés du bundle, voir
 * scripts/prune-native-bundle.mjs, qui doit rester d'accord avec cette liste.
 */
const BUNDLED_PATHS = new Set(["/texts/tehilim.json", TALMUD_CHAPTERS_PATH]);

export interface OfflineBook {
  /** Chemin web du fichier, clé unique du livre. */
  path: string;
  name: string;
  /** Corpus (type) : "Tehilim" | "Mishna" | "Talmud Bavli" | "Tanakh". */
  corpus: string;
  /** Regroupement d'origine (seder, livre). */
  livre: string;
}

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;

function buildBooks(): OfflineBook[] {
  const byPath = new Map<string, OfflineBook>();
  for (const entry of allTexts) {
    let path: string;
    try {
      path = resolveFilePath(entry);
    } catch {
      continue; // Type non supporté par le lecteur.
    }
    if (byPath.has(path)) continue;
    byPath.set(path, {
      path,
      // Les 150 psaumes partagent un seul fichier : un seul « livre » Tehilim.
      name: String(entry.type) === "Tehilim" ? "תהילים (Tehilim)" : entry.name,
      corpus: String(entry.type),
      livre: entry.livre ?? "",
    });
  }
  return [...byPath.values()];
}

export const offlineBooks: OfflineBook[] = buildBooks();

const bookByEntryId = new Map<number | string, OfflineBook | null>();

/** Livre téléchargeable correspondant à une entrée du catalogue (memoïsé). */
export function bookForEntry(entry: TextStudyJsonEntry): OfflineBook | null {
  if (!bookByEntryId.has(entry.id)) {
    let book: OfflineBook | null = null;
    try {
      const path = resolveFilePath(entry);
      book = offlineBooks.find((b) => b.path === path) ?? null;
    } catch {
      // Type non supporté.
    }
    bookByEntryId.set(entry.id, book);
  }
  return bookByEntryId.get(entry.id) ?? null;
}

/** Chemins en cours de téléchargement (spinners de l'UI). */
export const downloadingPaths = reactive(new Set<string>());

export const totalDownloadedSize = computed(() =>
  Object.values(downloadManifest.value.files).reduce((sum, f) => sum + f.size, 0),
);

export function isBookDownloaded(book: OfflineBook): boolean {
  return isDownloaded(book.path);
}

export async function downloadBook(book: OfflineBook): Promise<void> {
  if (downloadingPaths.has(book.path)) return;
  downloadingPaths.add(book.path);
  try {
    // Le lecteur du Talmud a besoin du découpage en chapitres.
    if (book.corpus === "Talmud Bavli" && !isDownloaded(TALMUD_CHAPTERS_PATH)) {
      await downloadFile(TALMUD_CHAPTERS_PATH);
    }
    await downloadFile(book.path);
  } finally {
    downloadingPaths.delete(book.path);
  }
}

export async function removeBook(book: OfflineBook): Promise<void> {
  await removeFile(book.path);
  await removeOrphanTalmudChapters();
}

/**
 * Supprime les copies locales d'un lot de livres (toute la bibliothèque ou un
 * seul corpus). Les textes restent lisibles en ligne : seul l'espace disque
 * est libéré.
 */
export async function removeBooks(books: OfflineBook[]): Promise<void> {
  for (const book of books) {
    await removeFile(book.path);
  }
  await removeOrphanTalmudChapters();
}

/**
 * Le découpage en chapitres du Talmud n'est qu'une dépendance du lecteur,
 * téléchargée avec la première guemara. Sans guemara téléchargée il n'a plus
 * de raison d'occuper de la place (ni d'apparaître dans l'espace utilisé).
 */
async function removeOrphanTalmudChapters(): Promise<void> {
  if (!isDownloaded(TALMUD_CHAPTERS_PATH)) return;
  const hasTalmud = offlineBooks.some((b) => b.corpus === "Talmud Bavli" && isDownloaded(b.path));
  if (!hasTalmud) await removeFile(TALMUD_CHAPTERS_PATH);
}

/**
 * Le livre d'une entrée est-il lisible sans connexion ? (app native : il doit
 * être téléchargé ; sur le web les textes sont servis par le site.)
 */
export function isEntryAvailableOffline(entry: TextStudyJsonEntry): boolean {
  if (!isNativeApp) return true;
  const book = bookForEntry(entry);
  // Type non lisible par le lecteur : rien à télécharger.
  if (!book) return true;
  return BUNDLED_PATHS.has(book.path) || isDownloaded(book.path);
}

/** Livres à télécharger pour que ces entrées soient lisibles hors ligne (sans doublon). */
export function missingBooksForEntries(entries: TextStudyJsonEntry[]): OfflineBook[] {
  if (!isNativeApp) return [];
  const byPath = new Map<string, OfflineBook>();
  for (const entry of entries) {
    const book = bookForEntry(entry);
    if (!book || BUNDLED_PATHS.has(book.path) || isDownloaded(book.path)) continue;
    byPath.set(book.path, book);
  }
  return [...byPath.values()];
}

/**
 * Télécharge une liste de livres, l'un après l'autre (les téléchargements
 * proposés à l'utilisateur : lecture quotidienne, paracha de la semaine).
 * Renvoie les livres qui n'ont pas pu être récupérés, l'appelant décide quoi
 * en dire ; rien n'est perdu, ils restent proposés au prochain passage.
 */
export async function downloadBooks(books: OfflineBook[]): Promise<OfflineBook[]> {
  const failed: OfflineBook[] = [];
  for (const book of books) {
    try {
      await downloadBook(book);
    } catch (error) {
      console.warn(`Téléchargement de ${book.path} impossible:`, error);
      failed.push(book);
    }
  }
  return failed;
}

/**
 * Remet au format courant les livres déjà téléchargés dans une version
 * antérieure des données (ex. paracha d'avant les montées et le targoum).
 * Ne télécharge JAMAIS de nouveau livre : ce qui vit sur l'appareil reste ce
 * que l'utilisateur a accepté d'y mettre (voir la proposition de
 * téléchargement à l'ajout d'un texte, dans la lecture quotidienne).
 */
export async function refreshStaleDownloads(): Promise<void> {
  if (!isNativeApp) return;
  await ensureManifestLoaded();
  // Hors connexion, chaque téléchargement échouerait : on attend le retour du
  // réseau, la page relance la synchro à ce moment-là.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const stale = Object.keys(downloadManifest.value.files)
    .filter((path) => !isDownloadCurrent(path))
    .map((path) => offlineBooks.find((b) => b.path === path))
    .filter((book): book is OfflineBook => Boolean(book));
  await downloadBooks(stale);
}
