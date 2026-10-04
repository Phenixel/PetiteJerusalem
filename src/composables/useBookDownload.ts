import { useI18n } from "vue-i18n";
import type { TextStudyJsonEntry } from "../models/models";
import { isNativeApp } from "./useNativeApp";
import { useToast } from "./useToast";
import {
  bookForEntry,
  downloadBook,
  downloadingPaths,
  isBookBundled,
  isBookDownloaded,
  removeBook,
  type OfflineBook,
} from "../services/offlineLibraryService";
import { analyticsService } from "../services/analyticsService";
import { isStoragePermissionDenied } from "../services/offlineTextStore";

/**
 * Le message d'un téléchargement en échec. Sous Android 10 et moins, un refus
 * de la permission de stockage disait « Vérifiez votre connexion », qui
 * envoyait chercher ailleurs : il a son message, qui dit où l'autoriser.
 */
export function downloadErrorKey(error: unknown): "downloads.permissionDenied" | "downloads.error" {
  return isStoragePermissionDenied(error) ? "downloads.permissionDenied" : "downloads.error";
}

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
 * (web, entrée sans livre, ou livre embarqué dans l'app comme les Tehilim et
 * le Sidour), "idle" quand il ne l'est pas encore.
 */
export type BookState = "none" | "downloading" | "downloaded" | "idle";

/** L'état d'une entrée, lu sur l'index des téléchargements (réactif). */
export function bookStateOf(entry: TextStudyJsonEntry): BookState {
  if (!isNativeApp) return "none";
  const book = bookForEntry(entry);
  if (!book || isBookBundled(book)) return "none";
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
      toast.error(t(downloadErrorKey(e)));
    }
  }

  /**
   * « Tout télécharger » : les livres d'un onglet de la bibliothèque (ou
   * toute la bibliothèque depuis l'accueil), l'un après l'autre.
   *
   * Un échec n'abandonne que le livre en cause. Avant, il abandonnait le lot
   * entier, en supposant l'appareil hors connexion ; l'Error tracking a
   * montré le contraire (un « Tout télécharger » coupé au 182e livre le
   * 2 octobre 2026, `is_online` vrai, sur un simple « Error during file
   * transfer »), et un transfert raté en chemin coûtait toute la fin de la
   * bibliothèque. Hors connexion, on s'arrête toujours : les suivants
   * échoueraient tous. En ligne, on continue et l'on dit à la fin ce qui
   * manque, comme le font déjà l'introduction (OnboardingOfflinePicker) et
   * `downloadBooks`.
   */
  async function downloadAll(books: OfflineBook[], tab: string): Promise<void> {
    const pending = books.filter((book) => !isBookDownloaded(book));
    analyticsService.capture("offline_download_started", {
      scope: "all",
      tab,
      books_count: pending.length,
    });
    let downloaded = 0;
    let failed = 0;
    for (const book of pending) {
      try {
        await downloadBook(book);
        downloaded++;
      } catch (e) {
        failed++;
        // Sortie négative du lot : `offline_download_started` restait sans
        // suite, exactement comme un utilisateur qui quitte la page. Ces deux
        // cas ne se distinguaient pas, alors qu'un « Tout télécharger » coupé
        // en route est le pire moment pour perdre quelqu'un.
        const online = navigator.onLine;
        analyticsService.capture("offline_download_failed", {
          scope: "all",
          tab,
          book: book.path,
          // Le rang dit si le lot a échoué d'emblée ou s'est interrompu près
          // du but : les deux n'appellent pas la même correction.
          books_done: downloaded,
          is_online: online,
          error_message: e instanceof Error ? e.message : String(e),
        });
        if (!online) {
          toast.error(t("downloads.error"));
          return;
        }
      }
    }
    analyticsService.capture("offline_download_completed", {
      scope: "all",
      tab,
      books_count: downloaded,
      // Ce qui manque à la fin : `books_count` seul ne disait pas si le lot
      // est complet (voir docs/tracking-plan.md).
      books_failed: failed,
    });
    if (failed > 0) toast.error(t("downloads.error"));
  }

  return { bookStateOf, toggleDownload, downloadAll };
}
