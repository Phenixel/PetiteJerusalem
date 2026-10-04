import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";

/**
 * « Tout télécharger » : un livre qui échoue ne coûte plus toute la fin de la
 * bibliothèque.
 *
 * La boucle sortait au premier échec, en supposant l'appareil hors connexion.
 * L'Error tracking a montré le contraire : le 2 octobre 2026, un lot coupé au
 * 182e livre sur un « Error during file transfer », `is_online` vrai, et tout
 * ce qui restait a été perdu pour un transfert raté.
 *
 * On garde la sortie immédiate hors connexion (les suivants échoueraient
 * tous), et `offline_download_completed` porte `books_failed`, sans quoi
 * `books_count` ne dirait pas si le lot est complet.
 */

const { capture, downloaded, downloadBook, error } = vi.hoisted(() => {
  const downloaded = new Set<string>();
  return {
    capture: vi.fn(),
    downloaded,
    error: vi.fn(),
    downloadBook: vi.fn(async (book: { path: string }) => {
      downloaded.add(book.path);
    }),
  };
});
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture } }));
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true, appPlatform: "android" }));
vi.mock("../composables/useToast", () => ({
  useToast: () => ({ error, success: vi.fn(), info: vi.fn() }),
}));
vi.mock("../services/offlineLibraryService", () => ({
  bookForEntry: () => null,
  isBookBundled: () => false,
  isBookDownloaded: (book: { path: string }) => downloaded.has(book.path),
  downloadingPaths: new Set<string>(),
  downloadBook,
  removeBook: vi.fn(),
}));

import { useBookDownload } from "../composables/useBookDownload";
import type { OfflineBook } from "../services/offlineLibraryService";

/** Trois livres d'un même corpus, dont aucun n'est encore sur l'appareil. */
const BOOKS = ["berakhot", "chabbat", "erouvin"].map(
  (slug) => ({ path: `/texts/talmud/${slug}.json`, corpus: "Talmud Bavli" }) as OfflineBook,
);

/** Monte un composant pour obtenir le composable dans un contexte d'app. */
function setup() {
  let api!: ReturnType<typeof useBookDownload>;
  const app = createApp(
    defineComponent({
      setup() {
        api = useBookDownload();
        return () => h("div");
      },
    }),
  );
  app.use(createI18n({ legacy: false, locale: "fr", messages: { fr } }));
  app.mount(document.createElement("div"));
  return api;
}

const events = () => capture.mock.calls.map(([name]) => name);
const propsOf = (name: string) => capture.mock.calls.find(([event]) => event === name)?.[1];

/** L'état du réseau que lit `downloadAll` (navigator.onLine). */
function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { value: online, configurable: true });
}

describe("« Tout télécharger »", () => {
  beforeEach(() => {
    capture.mockClear();
    error.mockClear();
    downloaded.clear();
    downloadBook.mockClear();
    setOnline(true);
  });

  afterEach(() => {
    setOnline(true);
  });

  it("télécharge les livres qui manquent, et compte zéro échec", async () => {
    downloaded.add(BOOKS[0].path);
    const { downloadAll } = setup();

    await downloadAll(BOOKS, "Talmud Bavli");

    // Le livre déjà sur l'appareil n'est ni compté ni retéléchargé.
    expect(downloadBook).toHaveBeenCalledTimes(2);
    expect(propsOf("offline_download_started")).toMatchObject({ scope: "all", books_count: 2 });
    expect(propsOf("offline_download_completed")).toMatchObject({
      books_count: 2,
      books_failed: 0,
    });
    expect(error).not.toHaveBeenCalled();
  });

  it("en ligne, continue après un échec et télécharge les livres suivants", async () => {
    downloadBook.mockRejectedValueOnce(new Error("Error during file transfer"));
    const { downloadAll } = setup();

    await downloadAll(BOOKS, "Talmud Bavli");

    // Les deux derniers livres sont bien passés : seul le premier manque.
    expect(downloadBook).toHaveBeenCalledTimes(3);
    expect(downloaded.has(BOOKS[1].path)).toBe(true);
    expect(downloaded.has(BOOKS[2].path)).toBe(true);
    expect(events()).toEqual([
      "offline_download_started",
      "offline_download_failed",
      "offline_download_completed",
    ]);
    expect(propsOf("offline_download_failed")).toMatchObject({
      book: BOOKS[0].path,
      books_done: 0,
      is_online: true,
      error_message: "Error during file transfer",
    });
    expect(propsOf("offline_download_completed")).toMatchObject({
      books_count: 2,
      books_failed: 1,
    });
    // Le lot est incomplet : le lecteur doit l'apprendre.
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("hors connexion, s'arrête au premier échec : les suivants échoueraient tous", async () => {
    setOnline(false);
    downloadBook.mockRejectedValue(new Error("réseau coupé"));
    const { downloadAll } = setup();

    await downloadAll(BOOKS, "Talmud Bavli");

    expect(downloadBook).toHaveBeenCalledTimes(1);
    expect(events()).toEqual(["offline_download_started", "offline_download_failed"]);
    expect(propsOf("offline_download_failed")).toMatchObject({ is_online: false });
    expect(error).toHaveBeenCalledTimes(1);
  });
});
