import { useI18n } from "vue-i18n";
import type { TextStudyJsonEntry } from "../models/models";
import { isNativeApp } from "./useNativeApp";
import { useToast } from "./useToast";
import {
  bookForEntry,
  downloadBook,
  downloadingPaths,
  isBookDownloaded,
  removeBook,
} from "../services/offlineLibraryService";
import { analyticsService } from "../services/analyticsService";

/**
 * Le téléchargement d'un livre pour le lire sans connexion (app native), tel
 * que le proposent la carte d'un texte dans la bibliothèque, le menu de
 * lecture et la tête des Sli'hot.
 *
 * Deux copies avaient divergé : le lecteur n'écrivait ni le début ni l'échec
 * du téléchargement, seule la réussite comptait, et le taux de réussite hors
 * ligne y était donc mécaniquement de 100 %. Une seule fonction, les quatre
 * événements partout.
 */

/**
 * L'état d'un livre à l'écran : "none" quand il n'y a rien à télécharger
 * (web, ou entrée sans livre), "idle" quand il ne l'est pas encore.
 */
export type BookState = "none" | "downloading" | "downloaded" | "idle";

/** L'état d'une entrée, lu sur l'index des téléchargements (réactif). */
export function bookStateOf(entry: TextStudyJsonEntry): BookState {
  if (!isNativeApp) return "none";
  const book = bookForEntry(entry);
  if (!book) return "none";
  if (downloadingPaths.has(book.path)) return "downloading";
  return isBookDownloaded(book) ? "downloaded" : "idle";
}

export function useBookDownload() {
  const { t } = useI18n();
  const toast = useToast();

  /** Télécharge le livre de l'entrée, ou le retire s'il l'est déjà. */
  async function toggleDownload(entry: TextStudyJsonEntry): Promise<void> {
    const book = bookForEntry(entry);
    if (!book) return;
    if (isBookDownloaded(book)) {
      try {
        await removeBook(book);
        analyticsService.capture("offline_download_deleted", { scope: "book", book: book.path });
      } catch {
        toast.error(t("downloads.deleteError"));
      }
      return;
    }
    // Téléchargements déclenchés par l'utilisateur uniquement (la synchro en
    // arrière-plan de la lecture du jour n'est pas suivie).
    analyticsService.capture("offline_download_started", { scope: "book", book: book.path });
    try {
      await downloadBook(book);
      analyticsService.capture("offline_download_completed", { scope: "book", book: book.path });
    } catch (e) {
      analyticsService.capture("offline_download_failed", {
        scope: "book",
        book: book.path,
        // Le premier suspect d'un téléchargement en échec, et il se lit sans
        // rien demander à l'appareil.
        is_online: navigator.onLine,
        error_message: e instanceof Error ? e.message : String(e),
      });
      toast.error(t("downloads.error"));
    }
  }

  return { bookStateOf, toggleDownload };
}
