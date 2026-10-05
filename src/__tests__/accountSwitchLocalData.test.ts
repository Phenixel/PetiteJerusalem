import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Deux comptes sur un même appareil (un téléphone de famille, l'ordinateur
 * d'une synagogue). À la déconnexion, les marque-pages, positions de lecture
 * et dates personnelles du premier restent sur l'appareil, et c'est voulu :
 * ils y ont autant leur place qu'avant la connexion. Mais à la connexion du
 * second, la fusion les versait dans SON compte : les hazkarot de la famille
 * de l'un apparaissaient chez l'autre, et le suivaient partout.
 *
 * Ce qu'un compte a laissé ne rejoint pas un autre compte ; ce qui a été
 * saisi sans compte, si, y compris après le départ du premier : c'est tout
 * ce qu'il en existe, l'écarter avec le reste le perdrait.
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
const lireLeCompte = vi.fn(() => Promise.resolve(remote));
const savePreferences = vi.fn<(id: string, prefs: Record<string, unknown>) => Promise<void>>(() =>
  Promise.resolve(),
);

vi.mock("../services/userPreferencesService", () => ({
  userPreferencesService: {
    getPreferences: () => Promise.resolve(remote),
    getPreferencesFromServer: () => lireLeCompte(),
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
  lireLeCompte.mockReset();
  lireLeCompte.mockImplementation(() => Promise.resolve(remote));
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const marquePage = (textId: string, at = 10) => ({
  id: `${textId}#0#4`,
  textId,
  section: 0,
  line: 4,
  path: `/bibliotheque/tehilim/${textId}`,
  label: `Tehilim ${textId}`,
  at,
});

const aPoser = (textId: string) => ({
  textId,
  section: 0,
  line: 4,
  path: `/bibliotheque/tehilim/${textId}`,
  label: `Tehilim ${textId}`,
});

const ecrits = () => {
  const dernier = savePreferences.mock.calls.at(-1)?.[1] as { bookmarks: { textId: string }[] };
  return dernier.bookmarks.map((b) => b.textId).sort();
};

describe("marque-pages et positions", () => {
  async function ouvrir() {
    const { readingProgressService } = await import("../services/readingProgressService");
    void readingProgressService.ensureSynced();
    return readingProgressService;
  }

  async function connecter(userId: string) {
    const progress = await ouvrir();
    listener({ id: userId });
    await laisserFiler();
    return progress;
  }

  const compteAParti = (leftAt: number) =>
    localStorage.setItem("pj-reading-owner", JSON.stringify({ id: "compte-a", leftAt }));

  it("ceux d'un autre compte ne rejoignent pas celui qui se connecte", async () => {
    localStorage.setItem("pj-bookmarks", JSON.stringify([marquePage("1")]));
    localStorage.setItem(
      "pj-reading-positions",
      JSON.stringify({ "1": { ...marquePage("1"), id: undefined } }),
    );
    localStorage.setItem("pj-bookmark-tombstones", JSON.stringify({ "9#0#4": 20 }));
    compteAParti(100);
    remote = { bookmarks: [marquePage("2")], readingPositions: {}, deletedBookmarks: {} };

    const progress = await connecter("compte-b");

    expect(savePreferences).not.toHaveBeenCalled();
    expect(progress.getBookmarkCounts()).toEqual({ "2": 1 });
    expect(progress.getLastPosition()).toBeNull();
  });

  it("ceux posés sans compte après son départ rejoignent le suivant", async () => {
    localStorage.setItem(
      "pj-bookmarks",
      JSON.stringify([marquePage("1", 10), marquePage("3", 200)]),
    );
    compteAParti(100);
    remote = { bookmarks: [marquePage("2")], readingPositions: {}, deletedBookmarks: {} };

    const progress = await connecter("compte-b");

    expect(ecrits()).toEqual(["2", "3"]);
    expect(progress.getBookmarkCounts()).toEqual({ "2": 1, "3": 1 });
  });

  it("de bout en bout : A se déconnecte, on lit sans compte, B se connecte", async () => {
    let maintenant = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => maintenant);
    remote = { bookmarks: [], readingPositions: {}, deletedBookmarks: {} };
    const progress = await connecter("compte-a");
    progress.toggleBookmark(aPoser("1"));
    await laisserFiler();

    maintenant = 2000;
    listener(null);
    maintenant = 3000;
    progress.toggleBookmark(aPoser("3"));
    await laisserFiler();

    maintenant = 4000;
    savePreferences.mockClear();
    remote = { bookmarks: [marquePage("2")], readingPositions: {}, deletedBookmarks: {} };
    listener({ id: "compte-b" });
    await laisserFiler();

    expect(ecrits()).toEqual(["2", "3"]);
    expect(savePreferences.mock.calls.every(([id]) => id === "compte-b")).toBe(true);
  });

  it("le compte illisible à la connexion : ce que B pose en attendant n'est pas écarté", async () => {
    let maintenant = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => maintenant);
    localStorage.setItem("pj-bookmarks", JSON.stringify([marquePage("1", 10)]));
    localStorage.setItem("pj-reading-owner", JSON.stringify({ id: "compte-a", leftAt: null }));
    remote = { bookmarks: [marquePage("2")], readingPositions: {}, deletedBookmarks: {} };
    lireLeCompte.mockRejectedValueOnce(new Error("injoignable"));

    const progress = await connecter("compte-b");
    expect(progress.getBookmarkCounts()).toEqual({ "1": 1 });

    maintenant = 2000;
    progress.toggleBookmark(aPoser("3"));
    await laisserFiler();

    expect(ecrits()).toEqual(["2", "3"]);
  });

  it("ceux saisis sans compte rejoignent le compte", async () => {
    localStorage.setItem("pj-bookmarks", JSON.stringify([marquePage("1")]));
    remote = { bookmarks: [marquePage("2")], readingPositions: {}, deletedBookmarks: {} };

    await connecter("compte-b");

    expect(ecrits()).toEqual(["1", "2"]);
  });

  it("ceux du même compte, revenu, restent", async () => {
    localStorage.setItem("pj-bookmarks", JSON.stringify([marquePage("1")]));
    compteAParti(100);
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

  const surLAppareil = (...dates: ReturnType<typeof date>[]) =>
    localStorage.setItem("pj_hebrew_occasions", JSON.stringify(dates));
  const dernierCompte = (id: string, ...ids: string[]) =>
    localStorage.setItem("pj_hebrew_occasions_owner", JSON.stringify({ id, ids }));

  it("celles d'un autre compte ne rejoignent pas celui qui se connecte", async () => {
    surLAppareil(date("a1", "Grand-père de A"));
    dernierCompte("compte-a", "a1");
    remote = { hebrewOccasions: [date("b1", "Grand-mère de B")] };

    const { occasions: list } = await connecter("compte-b");

    expect(savePreferences).not.toHaveBeenCalled();
    expect(list.value.map((o) => o.name)).toEqual(["Grand-mère de B"]);
  });

  it("celles saisies sans compte après son départ rejoignent le suivant", async () => {
    surLAppareil(date("a1", "Grand-père de A"), date("x1", "Saisie sans compte"));
    dernierCompte("compte-a", "a1");
    remote = { hebrewOccasions: [date("b1", "Grand-mère de B")] };

    const { occasions: list } = await connecter("compte-b");

    expect(list.value.map((o) => o.name)).toEqual(["Grand-mère de B", "Saisie sans compte"]);
    expect(savePreferences).toHaveBeenCalledTimes(1);
    const ecrit = savePreferences.mock.calls[0][1] as { hebrewOccasions: { id: string }[] };
    expect(ecrit.hebrewOccasions.map((o) => o.id)).toEqual(["b1", "x1"]);
  });

  it("de bout en bout : A se déconnecte, on saisit sans compte, B se connecte", async () => {
    remote = { hebrewOccasions: [date("a1", "Grand-père de A")] };
    const { occasions: list, saveOccasion } = await connecter("compte-a");
    saveOccasion({ ...date("a2", "Oncle de A"), id: "a2" } as never);
    await laisserFiler();

    listener(null);
    saveOccasion({ ...date("x1", "Saisie sans compte"), id: "x1" } as never);
    await laisserFiler();

    remote = { hebrewOccasions: [date("b1", "Grand-mère de B")] };
    listener({ id: "compte-b" });
    await laisserFiler();

    expect(list.value.map((o) => o.name)).toEqual(["Grand-mère de B", "Saisie sans compte"]);
  });

  it("le même compte, revenu : ce qui a été saisi sans lui le rejoint", async () => {
    surLAppareil(date("a1", "Grand-père de A"), date("x1", "Saisie sans compte"));
    dernierCompte("compte-a", "a1");
    remote = { hebrewOccasions: [date("a1", "Grand-père de A")] };

    const { occasions: list } = await connecter("compte-a");

    expect(list.value.map((o) => o.id)).toEqual(["a1", "x1"]);
    expect(savePreferences).toHaveBeenCalledTimes(1);
  });

  it("le même compte, revenu : une date supprimée ailleurs ne ressuscite pas", async () => {
    surLAppareil(date("a1", "Grand-père de A"), date("a2", "Oncle de A"));
    dernierCompte("compte-a", "a1", "a2");
    remote = { hebrewOccasions: [date("a1", "Grand-père de A")] };

    const { occasions: list } = await connecter("compte-a");

    expect(list.value.map((o) => o.id)).toEqual(["a1"]);
    expect(savePreferences).not.toHaveBeenCalled();
  });

  it("une date dont l'écriture au compte a échoué n'est pas tenue pour sienne", async () => {
    remote = { hebrewOccasions: [] };
    savePreferences.mockRejectedValueOnce(new Error("hors ligne"));
    const { saveOccasion } = await connecter("compte-a");
    saveOccasion({ ...date("a1", "Grand-père de A"), id: "a1" } as never);
    await laisserFiler();

    const owner = JSON.parse(localStorage.getItem("pj_hebrew_occasions_owner") ?? "{}") as {
      ids: string[];
    };
    expect(owner.ids).toEqual([]);
  });

  it("un appareil d'avant ce correctif garde la règle d'alors, sans rien écarter", async () => {
    surLAppareil(date("a1", "Sur l'appareil"));
    localStorage.setItem("pj_hebrew_occasions_adopted", JSON.stringify(["compte-a"]));
    remote = { hebrewOccasions: [date("b1", "Grand-mère de B")] };

    const { occasions: list } = await connecter("compte-b");

    expect(list.value.map((o) => o.name)).toEqual(["Grand-mère de B", "Sur l'appareil"]);
  });

  it("un appareil d'avant ce correctif : un compte déjà adopté fait foi", async () => {
    surLAppareil(date("a1", "Grand-père de A"), date("a2", "Supprimée ailleurs"));
    localStorage.setItem("pj_hebrew_occasions_adopted", JSON.stringify(["compte-a"]));
    remote = { hebrewOccasions: [date("a1", "Grand-père de A")] };

    const { occasions: list } = await connecter("compte-a");

    expect(list.value.map((o) => o.id)).toEqual(["a1"]);
  });

  it("celles saisies sans compte rejoignent le compte", async () => {
    surLAppareil(date("x1", "Saisie sans compte"));
    remote = { hebrewOccasions: [date("b1", "Grand-mère de B")] };

    const { occasions: list } = await connecter("compte-b");

    expect(list.value.map((o) => o.name).sort()).toEqual(["Grand-mère de B", "Saisie sans compte"]);
    expect(savePreferences).toHaveBeenCalledTimes(1);
  });
});
