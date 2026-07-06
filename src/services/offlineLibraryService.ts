import { computed, reactive } from "vue";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { resolveFilePath } from "./textService";
import {
  downloadFile,
  downloadManifest,
  ensureManifestLoaded,
  isDownloaded,
  removeFile,
} from "./offlineTextStore";
import { isNativeApp } from "../composables/useNativeApp";

/**
 * Vue « bibliothèque » du stockage hors ligne : regroupe le catalogue
 * (`textStudies.json`) en livres téléchargeables — un livre = un fichier
 * JSON sous `/texts/**` (tous les Tehilim partagent par exemple le même
 * fichier). S'appuie sur `offlineTextStore` pour le stockage lui-même.
 */

const TALMUD_CHAPTERS_PATH = "/texts/talmud-chapters.json";

export interface OfflineBook {
  /** Chemin web du fichier — clé unique du livre. */
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

/** Chemins en cours de téléchargement (spinners de l'UI). */
export const downloadingPaths = reactive(new Set<string>());

export const totalDownloadedSize = computed(() =>
  Object.values(downloadManifest.value.files).reduce((sum, f) => sum + f.size, 0),
);

export function bookDownloadedSize(book: OfflineBook): number | null {
  return downloadManifest.value.files[book.path]?.size ?? null;
}

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
}

/**
 * Télécharge en arrière-plan les livres de la liste de lecture quotidienne
 * (app native uniquement) : la lecture du jour est ainsi toujours disponible
 * hors ligne, sans action de l'utilisateur.
 */
export async function syncDailyReadingDownloads(dailyReadingIds: number[]): Promise<void> {
  if (!isNativeApp) return;
  await ensureManifestLoaded();

  const wanted = new Set<string>();
  for (const id of dailyReadingIds) {
    const entry = allTexts.find((t: TextStudyJsonEntry) => Number(t.id) === id);
    if (!entry) continue;
    try {
      wanted.add(resolveFilePath(entry));
    } catch {
      // Type non supporté.
    }
  }

  for (const path of wanted) {
    if (isDownloaded(path)) continue;
    const book = offlineBooks.find((b) => b.path === path);
    if (!book) continue;
    try {
      await downloadBook(book);
    } catch (error) {
      // Hors connexion ou serveur indisponible : on retentera au prochain passage.
      console.warn(`Téléchargement de ${path} impossible pour l'instant:`, error);
    }
  }
}
