import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Deux comptes sur un même appareil (un téléphone de famille, l'ordinateur
 * d'une synagogue). À la déconnexion, les marque-pages, positions de lecture
 * et dates personnelles du premier restent sur l'appareil, et c'est voulu :
 * ils y ont autant leur place qu'avant la connexion. Mais à la connexion du
 * second, la fusion les versait dans SON compte : les hazkarot de la famille
 * de l'un apparaissaient chez l'autre, et le suivaient partout.
 *
 * Ce qu'un compte a laissé ne rejoint pas un autre compte ; ce qui a été
 * saisi sans compte, si.
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

let remote: Record<string, unknown> = {};
const savePreferences = vi.fn<(id: string, prefs: Record<string, unknown>) => Promise<void>>(() =>
  Promise.resolve(),
);

vi.mock("../services/userPreferencesService", () => ({
  userPreferencesService: {
    getPreferences: () => Promise.resolve(remote),
    getPreferencesOrThrow: () => Promise.resolve(remote),
    savePreferences: (id: string, prefs: Record<string, unknown>) => savePreferences(id, prefs),
  },
}));

async function laisserFiler(): Promise<void> {
  for (let i = 0; i < 30; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

beforeEach(() => {
  localStorage.clear();
  remote = {};
  savePreferences.mockClear();
  vi.resetModules();
});

const marquePage = (textId: string) => ({
  id: `${textId}#0#4`,
  textId,
  section: 0,
  line: 4,
  path: `/bibliotheque/tehilim/${textId}`,
  label: `Tehilim ${textId}`,
  at: 10,
});

describe("marque-pages et positions", () => {
  async function connecter(userId: string) {
    const { readingProgressService } = await import("../services/readingProgressService");
    void readingProgressService.ensureSynced();
    listener({ id: userId });
    await laisserFiler();
    return readingProgressService;
  }

  it("ceux d'un autre compte ne rejoignent pas celui qui se connecte", async () => {
    localStorage.setItem("pj-bookmarks", JSON.stringify([marquePage("1")]));
    localStorage.setItem("pj-reading-owner", JSON.stringify("compte-a"));
    remote = { bookmarks: [marquePage("2")], readingPositions: {}, deletedBookmarks: {} };

    const progress = await connecter("compte-b");

    expect(savePreferences).not.toHaveBeenCalled();
    expect(progress.getBookmarkCounts()).toEqual({ "2": 1 });
  });

  it("ceux saisis sans compte rejoignent le compte", async () => {
    localStorage.setItem("pj-bookmarks", JSON.stringify([marquePage("1")]));
    remote = { bookmarks: [marquePage("2")], readingPositions: {}, deletedBookmarks: {} };

    await connecter("compte-b");

    const ecrit = savePreferences.mock.calls[0][1] as { bookmarks: { textId: string }[] };
    expect(ecrit.bookmarks.map((b) => b.textId).sort()).toEqual(["1", "2"]);
  });

  it("ceux du même compte, revenu, restent", async () => {
    localStorage.setItem("pj-bookmarks", JSON.stringify([marquePage("1")]));
    localStorage.setItem("pj-reading-owner", JSON.stringify("compte-a"));
    remote = { bookmarks: [], readingPositions: {}, deletedBookmarks: {} };

    const progress = await connecter("compte-a");

    expect(progress.getBookmarkCounts()).toEqual({ "1": 1 });
  });
});

describe("dates personnelles", () => {
  const date = (id: string, name: string) => ({
    id,
    name,
    kind: "yahrzeit",
    day: 12,
    month: 1,
    reminder: "none",
  });

  async function connecter(userId: string) {
    const { useHebrewOccasions } = await import("../composables/useHebrewOccasions");
    const occasions = useHebrewOccasions();
    await laisserFiler();
    listener({ id: userId });
    await laisserFiler();
    return occasions;
  }

  it("celles d'un autre compte ne rejoignent pas celui qui se connecte", async () => {
    localStorage.setItem("pj_hebrew_occasions", JSON.stringify([date("a1", "Grand-père de A")]));
    localStorage.setItem("pj_hebrew_occasions_owner", "compte-a");
    localStorage.setItem("pj_hebrew_occasions_adopted", JSON.stringify(["compte-a"]));
    remote = { hebrewOccasions: [date("b1", "Grand-mère de B")] };

    const { occasions: list } = await connecter("compte-b");

    expect(savePreferences).not.toHaveBeenCalled();
    expect(list.value.map((o) => o.name)).toEqual(["Grand-mère de B"]);
  });

  it("un appareil d'avant ce correctif : un compte déjà adopté en tient lieu", async () => {
    localStorage.setItem("pj_hebrew_occasions", JSON.stringify([date("a1", "Grand-père de A")]));
    localStorage.setItem("pj_hebrew_occasions_adopted", JSON.stringify(["compte-a"]));
    remote = { hebrewOccasions: [date("b1", "Grand-mère de B")] };

    const { occasions: list } = await connecter("compte-b");

    expect(list.value.map((o) => o.name)).toEqual(["Grand-mère de B"]);
  });

  it("celles saisies sans compte rejoignent le compte", async () => {
    localStorage.setItem("pj_hebrew_occasions", JSON.stringify([date("x1", "Saisie sans compte")]));
    remote = { hebrewOccasions: [date("b1", "Grand-mère de B")] };

    const { occasions: list } = await connecter("compte-b");

    expect(list.value.map((o) => o.name).sort()).toEqual(["Grand-mère de B", "Saisie sans compte"]);
    expect(savePreferences).toHaveBeenCalledTimes(1);
  });
});
