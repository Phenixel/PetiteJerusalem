import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref, type App } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, type Router } from "vue-router";

/**
 * La table d'étude (docs/design.md, « Des textes mis de côté, sur la
 * table ») : on met un texte de côté pour en ouvrir un autre, et on passe de
 * l'un à l'autre en retrouvant chacun à l'endroit exact où on l'a laissé.
 */

vi.mock("../components/readingTable/ReadingTableSheet.vue", () => ({
  default: { name: "ReadingTableSheetStub", render: () => null },
}));

import fr from "../locales/fr";
import ReadingTableBar from "../components/readingTable/ReadingTableBar.vue";
import {
  hasTableRestore,
  openFromTable,
  placeOnTable,
  refreshOnTable,
  registerTableReader,
  removeFromTable,
  resetReadingTableForTests,
  takeTableRestore,
  useReadingTable,
  MAX_TABLE_TEXTS,
  TABLE_RESTORE_TTL_MS,
  type TableText,
} from "../composables/useReadingTable";
import { takeReadingEntry } from "../services/readingEntry";

const STORAGE_KEY = "pj-reading-table";

function text(key: string, patch: Partial<TableText> = {}): TableText {
  return {
    key,
    path: `/bibliotheque/tanakh/${key}/1`,
    title: `Texte ${key}`,
    place: "Chapitre 1 · verset 3",
    book: "Berechit",
    excerpt: "בְּרֵאשִׁית בָּרָא אֱלֹהִים",
    corpus: "tanakh",
    line: 2,
    offset: 140,
    scrollY: 900,
    at: 1,
    ...patch,
  };
}

function fakeRouter(path: string) {
  const currentRoute = ref({ path });
  const push = vi.fn((to: string) => {
    currentRoute.value = { path: to };
    return Promise.resolve();
  });
  return { router: { currentRoute, push } as unknown as Router, push };
}

beforeEach(() => {
  localStorage.clear();
  resetReadingTableForTests();
});

describe("la table d'étude", () => {
  it("pose un nouveau texte au bout, de l'autre côté des précédents", () => {
    placeOnTable(text("a"));
    placeOnTable(text("b"));
    expect(useReadingTable().texts.value.map((t) => t.key)).toEqual(["a", "b"]);
  });

  it("un texte déjà posé retient sa nouvelle page sans changer de place", () => {
    placeOnTable(text("a"));
    placeOnTable(text("b"));
    placeOnTable(text("a", { path: "/bibliotheque/tanakh/a/4", line: 12 }));
    const { texts } = useReadingTable();
    expect(texts.value.map((t) => t.key)).toEqual(["a", "b"]);
    expect(texts.value[0]).toMatchObject({ path: "/bibliotheque/tanakh/a/4", line: 12 });
  });

  it("ne réécrit rien quand le lecteur n'a pas changé de verset", () => {
    placeOnTable(text("a"));
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    refreshOnTable(text("a", { at: 99 }));
    expect(setItem).not.toHaveBeenCalled();
    refreshOnTable(text("a", { line: 5 }));
    expect(setItem).toHaveBeenCalledTimes(1);
    setItem.mockRestore();
  });

  it("suit ce qu'un autre onglet vient d'écrire", () => {
    placeOnTable(text("a"));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, texts: [text("a"), text("x")] }));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(useReadingTable().texts.value.map((t) => t.key)).toEqual(["a", "x"]);
  });

  it("ne met à jour que les textes qui sont sur la table", () => {
    refreshOnTable(text("absent"));
    expect(useReadingTable().texts.value).toEqual([]);
  });

  it("survit à un rechargement, et ignore ce qui ne se relit pas", () => {
    placeOnTable(text("a"));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").texts).toHaveLength(1);
    resetReadingTableForTests();
    expect(useReadingTable().texts.value.map((t) => t.key)).toEqual(["a"]);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 1, texts: [{ key: "x" }, text("b"), "n'importe quoi"] }),
    );
    resetReadingTableForTests();
    expect(useReadingTable().texts.value.map((t) => t.key)).toEqual(["b"]);
  });

  it("ne garde aucun texte du Sidour, qui ne se pose pas sur la table", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 1,
        texts: [
          text("a"),
          text("cha", { path: "/bibliotheque/sidour/chaharit", corpus: "sidour" }),
          text("sli", { path: "/bibliotheque/moadim/slihot", corpus: "moadim" }),
        ],
      }),
    );
    resetReadingTableForTests();
    expect(useReadingTable().texts.value.map((t) => t.key)).toEqual(["a"]);
  });

  it("se borne, le plus ancien posé quittant la table", () => {
    for (let i = 0; i <= MAX_TABLE_TEXTS; i++) placeOnTable(text(`t${i}`));
    const keys = useReadingTable().texts.value.map((t) => t.key);
    expect(keys).toHaveLength(MAX_TABLE_TEXTS);
    expect(keys[0]).toBe("t1");
  });

  it("vidée, elle referme son panneau", () => {
    placeOnTable(text("a"));
    const { sheetOpen } = useReadingTable();
    sheetOpen.value = true;
    removeFromTable("a");
    expect(sheetOpen.value).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("passer d'un texte à l'autre", () => {
  it("le texte quitté retient sa page, l'autre se rouvre là où on l'avait laissé", () => {
    placeOnTable(text("a"));
    placeOnTable(text("b", { path: "/bibliotheque/talmud/b", line: null, scrollY: 2400 }));
    // On lit « a », plus loin qu'au moment de le poser.
    const unregister = registerTableReader({
      key: "a",
      snapshot: () => text("a", { line: 40, offset: 220, scrollY: 5000 }),
    });
    const { router, push } = fakeRouter("/bibliotheque/tanakh/a/1");

    openFromTable("b", router);

    expect(useReadingTable().texts.value[0]).toMatchObject({ line: 40, offset: 220 });
    expect(push).toHaveBeenCalledWith("/bibliotheque/talmud/b");
    // Le routeur ne remet pas la page en haut, le lecteur la replace une fois.
    expect(hasTableRestore("/bibliotheque/talmud/b")).toBe(true);
    expect(takeTableRestore("/bibliotheque/autre")).toBeNull();
    expect(takeTableRestore("/bibliotheque/talmud/b")).toMatchObject({ scrollY: 2400 });
    expect(takeTableRestore("/bibliotheque/talmud/b")).toBeNull();
    // `text_opened` dira qu'on vient de la table.
    expect(takeReadingEntry(null, { session: false })).toBe("table");
    unregister();
  });

  it("remonté à la liste des chapitres, le texte garde le chapitre où l'on lisait", () => {
    placeOnTable(text("a", { path: "/bibliotheque/talmud/a/3", line: null, scrollY: 1800 }));
    placeOnTable(text("b"));
    // Le lecteur est sur la liste des chapitres : rien à retenir en mise à jour.
    const unregister = registerTableReader({
      key: "a",
      snapshot: (refresh) =>
        refresh ? null : text("a", { path: "/bibliotheque/talmud/a", scrollY: 0 }),
    });
    const { router } = fakeRouter("/bibliotheque/talmud/a");

    openFromTable("b", router);

    expect(useReadingTable().texts.value[0]).toMatchObject({
      path: "/bibliotheque/talmud/a/3",
      scrollY: 1800,
    });
    unregister();
  });

  it("une reprise qui n'a pas abouti expire, et ne fait pas sauter une visite suivante", () => {
    placeOnTable(text("b", { path: "/bibliotheque/talmud/b" }));
    const { router } = fakeRouter("/bibliotheque");
    openFromTable("b", router);
    const later = Date.now() + TABLE_RESTORE_TTL_MS + 1;
    expect(hasTableRestore("/bibliotheque/talmud/b", later)).toBe(false);
    expect(takeTableRestore("/bibliotheque/talmud/b", later)).toBeNull();
  });

  it("une navigation refusée ne laisse rien en attente", async () => {
    placeOnTable(text("b", { path: "/bibliotheque/talmud/b" }));
    const { router, push } = fakeRouter("/bibliotheque");
    push.mockImplementationOnce(() => Promise.resolve(new Error("annulée") as never));
    openFromTable("b", router);
    await Promise.resolve();
    await Promise.resolve();
    expect(hasTableRestore("/bibliotheque/talmud/b")).toBe(false);
  });

  it("le texte déjà sous les yeux ne se rouvre pas : le panneau se referme", () => {
    placeOnTable(text("a"));
    const unregister = registerTableReader({ key: "a", snapshot: () => text("a") });
    const { router, push } = fakeRouter("/bibliotheque/tanakh/a/1");
    const { sheetOpen } = useReadingTable();
    sheetOpen.value = true;

    openFromTable("a", router);

    expect(push).not.toHaveBeenCalled();
    expect(sheetOpen.value).toBe(false);
    expect(hasTableRestore("/bibliotheque/tanakh/a/1")).toBe(false);
    unregister();
  });
});

describe("la barre de la table", () => {
  let app: App | null = null;
  let host: HTMLElement;

  afterEach(() => {
    app?.unmount();
    host?.remove();
    app = null;
  });

  async function mountBar(router?: Router) {
    host = document.createElement("div");
    document.body.appendChild(host);
    app = createApp({ render: () => h(ReadingTableBar) });
    app.use(createI18n({ legacy: false, locale: "fr", messages: { fr } }));
    if (router) app.use(router);
    app.mount(host);
    await nextTick();
  }

  it("n'existe pas tant que la table est vide", async () => {
    await mountBar();
    expect(host.querySelector("[role='region']")).toBeNull();
  });

  it("porte un livre par texte posé, celui qu'on lit sorti du rang", async () => {
    for (const key of ["a", "b", "c", "d", "e"]) placeOnTable(text(key));
    const unregister = registerTableReader({ key: "c", snapshot: () => text("c") });
    await mountBar();

    const tabs = [...host.querySelectorAll<HTMLElement>("[data-table-key]")];
    expect(tabs.map((tab) => tab.dataset.tableKey)).toEqual(["a", "b", "c", "d", "e"]);
    expect(tabs.filter((tab) => tab.classList.contains("table-book-open"))).toEqual([tabs[2]]);
    expect(tabs[2].getAttribute("aria-current")).toBe("page");
    unregister();
  });

  it("un livre ouvre son texte, la barre ouvre la table", async () => {
    placeOnTable(text("a"));
    placeOnTable(text("b"));
    const unregister = registerTableReader({ key: "b", snapshot: () => text("b") });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/:rest(.*)*", component: { render: () => null } }],
    });
    await router.push("/bibliotheque/tanakh/b/1");
    await mountBar(router);

    host.querySelector<HTMLElement>("[data-table-key='a']")!.click();
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe("/bibliotheque/tanakh/a/1"));
    expect(hasTableRestore("/bibliotheque/tanakh/a/1")).toBe(true);
    expect(useReadingTable().sheetOpen.value).toBe(false);

    host.querySelector<HTMLElement>("[role='region']")!.click();
    expect(useReadingTable().sheetOpen.value).toBe(true);
    unregister();
  });
});
