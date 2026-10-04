import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * getPreferencesFromServer : les préférences que le serveur vient de rendre,
 * ou une erreur. La fusion des marque-pages s'en sert avant de réécrire le
 * compte : getPreferencesOrThrow, lui, rend la copie locale du dernier
 * passage dès que le réseau manque, et une copie d'hier prise pour le compte
 * effacerait ce qui a été posé depuis sur un autre appareil.
 */

const getDoc = vi.fn();
const setDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` }),
  getDoc: (...args: unknown[]) => getDoc(...args),
  setDoc: (...args: unknown[]) => setDoc(...args),
  arrayUnion: (...values: unknown[]) => values,
  deleteDoc: vi.fn(),
}));
vi.mock("../firebase/firestore", () => ({ db: {} }));

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

function snapshot(data: Record<string, unknown>, fromCache = false) {
  return { exists: () => true, data: () => data, metadata: { fromCache } };
}

async function service() {
  vi.resetModules();
  return (await import("../services/userPreferencesService")).userPreferencesService;
}

beforeEach(() => {
  localStorage.clear();
  getDoc.mockReset();
  setDoc.mockReset().mockResolvedValue(undefined);
  setOnline(true);
});
afterEach(() => setOnline(true));

describe("les préférences, du serveur ou rien", () => {
  it("rend ce que le serveur répond", async () => {
    const prefs = await service();
    getDoc.mockResolvedValue(snapshot({ bookmarks: [{ id: "a" }] }));

    expect((await prefs.getPreferencesFromServer("u1")).bookmarks).toEqual([{ id: "a" }]);
  });

  it("refuse la copie locale quand l'appareil est hors ligne", async () => {
    const prefs = await service();
    getDoc.mockResolvedValue(snapshot({ bookmarks: [{ id: "a" }] }));
    await prefs.getPreferencesFromServer("u1");

    setOnline(false);
    await expect(prefs.getPreferencesFromServer("u1")).rejects.toThrow();
    // La lecture ordinaire, elle, sert toujours la copie du dernier passage.
    expect((await prefs.getPreferencesOrThrow("u1")).bookmarks).toEqual([{ id: "a" }]);
  });

  it("refuse la copie locale quand le serveur ne répond pas", async () => {
    const prefs = await service();
    getDoc.mockResolvedValueOnce(snapshot({ bookmarks: [{ id: "a" }] }));
    await prefs.getPreferencesFromServer("u1");

    getDoc.mockRejectedValue(new Error("unavailable"));
    await expect(prefs.getPreferencesFromServer("u1")).rejects.toThrow();
    expect((await prefs.getPreferencesOrThrow("u1")).bookmarks).toEqual([{ id: "a" }]);
  });

  it("refuse un document rendu par le cache de Firestore", async () => {
    const prefs = await service();
    getDoc.mockResolvedValue(snapshot({ bookmarks: [{ id: "a" }] }, true));

    await expect(prefs.getPreferencesFromServer("u1")).rejects.toThrow();
  });
});
