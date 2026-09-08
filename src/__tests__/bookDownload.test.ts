import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";

/**
 * Le téléchargement d'un livre, le même depuis la bibliothèque, le menu de
 * lecture et la tête des Sli'hot : le début, la réussite et l'échec d'un
 * téléchargement s'écrivent tous, le lecteur n'écrivait que la réussite.
 */

// `vi.mock` est hissé en tête de fichier : ce que ses fabriques lisent doit
// l'être aussi.
const { capture, downloaded, downloadBook, removeBook } = vi.hoisted(() => {
  const downloaded = new Set<string>();
  return {
    capture: vi.fn(),
    downloaded,
    downloadBook: vi.fn(async (book: { path: string }) => {
      downloaded.add(book.path);
    }),
    removeBook: vi.fn(async (book: { path: string }) => {
      downloaded.delete(book.path);
    }),
  };
});
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture } }));
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true, appPlatform: "android" }));
vi.mock("../services/offlineLibraryService", () => ({
  bookForEntry: () => ({ path: "/texts/talmud/berakhot.json" }),
  isBookDownloaded: (book: { path: string }) => downloaded.has(book.path),
  downloadingPaths: new Set<string>(),
  downloadBook,
  removeBook,
}));

import { useBookDownload } from "../composables/useBookDownload";

const ENTRY = {
  id: 1,
  name: "ברכות (Berakhot)",
  livre: "",
  link: "",
  totalSections: 9,
  type: "Talmud Bavli",
};

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

describe("useBookDownload", () => {
  beforeEach(() => {
    capture.mockClear();
    downloaded.clear();
    downloadBook.mockClear();
    removeBook.mockClear();
  });

  it("écrit le début et la réussite d'un téléchargement, puis sa suppression", async () => {
    const { bookStateOf, toggleDownload } = setup();
    expect(bookStateOf(ENTRY)).toBe("idle");

    await toggleDownload(ENTRY);
    expect(downloadBook).toHaveBeenCalledTimes(1);
    expect(events()).toEqual(["offline_download_started", "offline_download_completed"]);
    expect(bookStateOf(ENTRY)).toBe("downloaded");

    await toggleDownload(ENTRY);
    expect(removeBook).toHaveBeenCalledTimes(1);
    expect(events().at(-1)).toBe("offline_download_deleted");
    expect(bookStateOf(ENTRY)).toBe("idle");
  });

  it("écrit l'échec, avec l'état du réseau", async () => {
    downloadBook.mockRejectedValueOnce(new Error("réseau coupé"));
    const { toggleDownload } = setup();
    await toggleDownload(ENTRY);
    expect(events()).toEqual(["offline_download_started", "offline_download_failed"]);
    const [, props] = capture.mock.calls[1];
    expect(props).toMatchObject({ scope: "book", error_message: "réseau coupé" });
    expect(typeof props.is_online).toBe("boolean");
  });
});
