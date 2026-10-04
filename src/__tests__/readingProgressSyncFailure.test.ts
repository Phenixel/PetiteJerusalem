import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * À la connexion, les marque-pages de l'appareil se fusionnent avec ceux du
 * compte. Quand le compte ne se lisait pas (serveur injoignable, aucune copie
 * locale : un premier passage sur cet appareil), getPreferences rendait des
 * préférences vides ; la fusion voyait alors un compte sans marque-page et y
 * écrivait l'état de l'appareil seul, effaçant ceux posés ailleurs. Le
 * marque-page suivant faisait de même.
 */

type Listener = (user: { id: string } | null) => void;
let listener: Listener = () => {};

vi.mock("../services/authService", () => ({
  authService: {
    onAuthChanged: (cb: Listener) => {
      listener = cb;
      return () => {};
    },
  },
}));

const getPreferencesFromServer = vi.fn();
const savePreferences = vi.fn<(id: string, prefs: unknown) => Promise<void>>(() =>
  Promise.resolve(),
);

vi.mock("../services/userPreferencesService", () => ({
  userPreferencesService: {
    getPreferencesFromServer: (id: string) => getPreferencesFromServer(id),
    // Ce que faisait la fusion : un échec de lecture devenait un compte vide.
    getPreferences: (id: string) =>
      getPreferencesFromServer(id).catch(() => ({ bookmarks: [], readingPositions: {} })),
    savePreferences: (id: string, prefs: unknown) => savePreferences(id, prefs),
  },
}));

const MARQUE_PAGE_DU_COMPTE = {
  id: "103#0#4",
  textId: "103",
  section: 0,
  line: 4,
  path: "/bibliotheque/tehilim/1",
  label: "Tehilim 1",
  at: 10,
};

async function service() {
  vi.resetModules();
  const { readingProgressService } = await import("../services/readingProgressService");
  void readingProgressService.ensureSynced();
  return readingProgressService;
}

async function laisserFiler(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

beforeEach(() => {
  localStorage.clear();
  getPreferencesFromServer.mockReset();
  savePreferences.mockClear();
});

describe("fusion des marque-pages quand le compte ne se lit pas", () => {
  it("n'écrit rien au compte", async () => {
    getPreferencesFromServer.mockRejectedValue(new Error("injoignable"));
    localStorage.setItem(
      "pj-bookmarks",
      JSON.stringify([{ ...MARQUE_PAGE_DU_COMPTE, id: "104#0#1", textId: "104", at: 20 }]),
    );
    await service();
    listener({ id: "u1" });
    await laisserFiler();

    expect(savePreferences).not.toHaveBeenCalled();
  });

  it("au marque-page suivant, relit le compte et garde ce qu'il portait", async () => {
    getPreferencesFromServer.mockRejectedValueOnce(new Error("injoignable"));
    const progress = await service();
    listener({ id: "u1" });
    await laisserFiler();

    // Le serveur répond de nouveau.
    getPreferencesFromServer.mockResolvedValue({
      bookmarks: [MARQUE_PAGE_DU_COMPTE],
      readingPositions: {},
      deletedBookmarks: {},
    });
    progress.toggleBookmark({
      textId: "104",
      section: 0,
      line: 1,
      path: "/bibliotheque/tehilim/2",
      label: "Tehilim 2",
    });
    await laisserFiler();

    expect(savePreferences).toHaveBeenCalledTimes(1);
    const ecrit = savePreferences.mock.calls[0][1] as { bookmarks: { id: string }[] };
    expect(ecrit.bookmarks.map((b) => b.id).sort()).toEqual(["103#0#4", "104#0#1"]);
  });

  it("fusionne et écrit normalement quand le compte se lit", async () => {
    getPreferencesFromServer.mockResolvedValue({
      bookmarks: [MARQUE_PAGE_DU_COMPTE],
      readingPositions: {},
      deletedBookmarks: {},
    });
    localStorage.setItem(
      "pj-bookmarks",
      JSON.stringify([{ ...MARQUE_PAGE_DU_COMPTE, id: "104#0#1", textId: "104", at: 20 }]),
    );
    await service();
    listener({ id: "u1" });
    await laisserFiler();

    expect(savePreferences).toHaveBeenCalledTimes(1);
    const ecrit = savePreferences.mock.calls[0][1] as { bookmarks: { id: string }[] };
    expect(ecrit.bookmarks.map((b) => b.id).sort()).toEqual(["103#0#4", "104#0#1"]);
  });
});
