import { describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, reactive } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import fr from "../locales/fr";

/**
 * Le hors ligne sur l'accueil de la bibliothèque (app native) : chaque livre
 * de l'étagère dit dans son angle s'il est sur le téléphone, et la ligne
 * « Hors ligne » dit avant combien il reste, pendant où l'on en est.
 *
 * Une coche quand tout le livre est là, un anneau quand il ne l'est qu'en
 * partie, rien sinon : l'étagère reste nue tant qu'on n'a rien téléchargé.
 */

const { bulk, downloaded, confirm, removeBooks } = vi.hoisted(() => ({
  bulk: {
    active: false,
    total: 0,
    done: 0,
    failed: 0,
    bytesTotal: 0,
    bytesDone: 0,
    startedAt: 0,
  },
  downloaded: new Set<string>(),
  confirm: vi.fn(),
  removeBooks: vi.fn(),
}));

vi.mock("../composables/useBookDownload", () => ({
  bulkDownload: bulk,
  useBookDownload: () => ({ downloadAll: vi.fn() }),
}));
vi.mock("../composables/useConfirm", () => ({ useConfirm: () => ({ confirm }) }));
vi.mock("../composables/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));
vi.mock("../services/offlineLibraryService", () => ({
  // Un mégaoctet estimé par livre manquant, autant sur l'appareil par livre là.
  approxBytesOfBooks: (books: unknown[]) => books.length * 1024 * 1024,
  downloadedBytesOf: (books: { path: string }[]) =>
    books.filter((b) => downloaded.has(b.path)).length * 1024 * 1024,
  isBookDownloaded: (book: { path: string }) => downloaded.has(book.path),
  removeBooks,
}));

import LibraryShelf from "../components/LibraryShelf.vue";
import LibraryOfflineRow from "../components/LibraryOfflineRow.vue";
import type { OfflineBook } from "../services/offlineLibraryService";

/** Le texte rendu, espaces insécables ramenés à des espaces. */
const textOf = (host: HTMLElement) => (host.textContent ?? "").replace(/[\u00a0\u202f]/g, " ");

function mount(component: unknown, props: Record<string, unknown>) {
  const state = reactive({ ...props });
  const app = createApp({ render: () => h(component as never, state) });
  app.use(createI18n({ legacy: false, locale: "fr", messages: { fr } }));
  app.use(
    createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/:p(.*)*", component: { render: () => null } }],
    }),
  );
  const host = document.createElement("div");
  app.mount(host);
  return { host, state };
}

describe("la pastille des livres de l'étagère", () => {
  it("coche un livre entier, cercle un livre en partie, laisse nu le reste", () => {
    const { host } = mount(LibraryShelf, {
      books: [
        { corpus: "tehilim", to: "/bibliotheque/tehilim", label: "Tehilim", offline: 1 },
        { corpus: "talmud", to: "/bibliotheque/talmud", label: "Talmud", offline: 0.25 },
        { corpus: "michna", to: "/bibliotheque/michna", label: "Michna", offline: 0 },
      ],
    });
    const badgeOf = (corpus: string) =>
      host.querySelector(`a[href="/bibliotheque/${corpus}"] .book-badge`);
    expect(badgeOf("tehilim")?.querySelector(".book-check")).toBeTruthy();
    expect(badgeOf("talmud")?.querySelector(".book-ring")).toBeTruthy();
    expect(badgeOf("michna")).toBeNull();
  });

  it("annonce l'état aux lecteurs d'écran", () => {
    const { host } = mount(LibraryShelf, {
      books: [
        {
          corpus: "tanakh",
          to: "/bibliotheque/tanakh",
          label: "Tanakh",
          offline: 1,
          ariaLabel: "Tanakh, sur ce téléphone",
        },
      ],
    });
    expect(host.querySelector("a")?.getAttribute("aria-label")).toBe("Tanakh, sur ce téléphone");
  });
});

describe("la ligne « Hors ligne »", () => {
  const BOOKS = ["berakhot", "chabbat", "erouvin"].map(
    (slug) => ({ path: `/texts/talmud/${slug}.json`, corpus: "Talmud Bavli" }) as OfflineBook,
  );

  it("dit avant combien il reste, puis où l'on en est, puis ce que tout occupe", async () => {
    downloaded.clear();
    downloaded.add(BOOKS[0].path);
    const { host } = mount(LibraryOfflineRow, { books: BOOKS });
    // Avant : la taille de ce qui manque, et ce qui est déjà là.
    expect(textOf(host)).toContain("Tout télécharger");
    expect(textOf(host)).toContain("Environ 2 Mo à télécharger, 1 Mo déjà là");

    // Pendant : le pourcentage du lot, en grand.
    Object.assign(bulk, {
      active: true,
      total: 2,
      done: 1,
      bytesTotal: 2 * 1024 * 1024,
      bytesDone: 1024 * 1024,
      startedAt: Date.now() - 4000,
    });
    // L'état du lot est un objet simple dans ce test : on remonte la ligne.
    const running = mount(LibraryOfflineRow, { books: BOOKS });
    await nextTick();
    expect(textOf(running.host)).toContain("Téléchargement");
    expect(textOf(running.host)).toContain("50%");
    // The time left, not « 1 Mo sur 2 Mo », which repeated the percentage.
    expect(textOf(running.host)).toContain("Encore quelques secondes");
    expect(textOf(running.host)).not.toContain("1 Mo sur 2 Mo");

    // Après : tout est là.
    Object.assign(bulk, { active: false });
    BOOKS.forEach((book) => downloaded.add(book.path));
    const done = mount(LibraryOfflineRow, { books: BOOKS });
    expect(textOf(done.host)).toContain("Tout est téléchargé");
    expect(textOf(done.host)).toContain("3 Mo sur ce téléphone");
  });

  it("libère aussi les textes du Sidour sur le téléphone, qui n'ont plus d'autre corbeille", async () => {
    Object.assign(bulk, { active: false });
    downloaded.clear();
    BOOKS.forEach((book) => downloaded.add(book.path));
    const feast = { path: "/texts/moadim/souccot.json", corpus: "Moadim" } as OfflineBook;
    downloaded.add(feast.path);
    confirm.mockResolvedValue(true);
    removeBooks.mockClear();
    const { host } = mount(LibraryOfflineRow, { books: BOOKS, alsoRemovable: [feast] });
    // La place prise compte les textes du Sidour.
    expect(textOf(host)).toContain("4 Mo sur ce téléphone");
    const trash = [...host.querySelectorAll("button")].at(-1);
    trash?.click();
    await vi.waitFor(() => expect(removeBooks).toHaveBeenCalled());
    expect(removeBooks.mock.calls[0][0]).toContainEqual(feast);
  });
});
