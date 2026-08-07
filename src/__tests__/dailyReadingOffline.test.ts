import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lecture quotidienne hors connexion (app native).
 *
 * Ce qui doit tenir :
 * - la liste du jour reste affichée sans réseau, telle que le serveur la
 *   connaît (copie locale du dernier passage) ;
 * - le serveur a toujours raison : aucune modification n'est tentée hors
 *   ligne, et sa réponse remplace la copie locale dès qu'il répond ;
 * - on sait dire quels textes manquent sur l'appareil pour que la lecture du
 *   jour soit lisible sans connexion.
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

function snapshot(data: Record<string, unknown> | null) {
  return { exists: () => data !== null, data: () => data };
}

describe("préférences de la lecture quotidienne hors connexion", () => {
  beforeEach(() => {
    localStorage.clear();
    getDoc.mockReset();
    setDoc.mockReset();
    setOnline(true);
  });

  afterEach(() => setOnline(true));

  it("sert la copie locale du dernier passage quand l'appareil est hors ligne", async () => {
    const { userPreferencesService } = await import("../services/userPreferencesService");
    getDoc.mockResolvedValue(snapshot({ dailyReadingIds: [5, 12], theme: "emerald" }));
    await userPreferencesService.getPreferences("user-a");

    setOnline(false);
    getDoc.mockRejectedValue(new Error("offline"));
    const offlinePrefs = await userPreferencesService.getPreferences("user-a");

    // Firestore n'est même pas interrogé : la copie locale répond tout de suite.
    expect(getDoc).toHaveBeenCalledTimes(1);
    expect(offlinePrefs.dailyReadingIds).toEqual([5, 12]);
    expect(offlinePrefs.theme).toBe("emerald");
  });

  it("complète la copie locale par les valeurs par défaut", async () => {
    const { userPreferencesService } = await import("../services/userPreferencesService");
    getDoc.mockResolvedValue(snapshot({ dailyReadingIds: [7] }));
    await userPreferencesService.getPreferences("user-b");

    setOnline(false);
    const prefs = await userPreferencesService.getPreferences("user-b");
    expect(prefs.dailyReadingOptions).toEqual([]);
    expect(prefs.pushReminderHour).toBe(18);
  });

  it("refuse d'écrire hors connexion plutôt que de laisser l'écriture en attente", async () => {
    const { userPreferencesService, isOfflineWriteError } = await import(
      "../services/userPreferencesService"
    );
    setOnline(false);
    await expect(
      userPreferencesService.savePreferences("user-c", { dailyReadingIds: [1] }),
    ).rejects.toSatisfy(isOfflineWriteError);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("le serveur a toujours raison : sa réponse remplace la copie locale", async () => {
    const { userPreferencesService } = await import("../services/userPreferencesService");
    getDoc.mockResolvedValue(snapshot({ dailyReadingIds: [5, 12] }));
    await userPreferencesService.getPreferences("user-d");

    // La liste a changé depuis un autre appareil : au retour du réseau, c'est
    // elle qui s'impose, y compris pour les prochaines lectures hors ligne.
    getDoc.mockResolvedValue(snapshot({ dailyReadingIds: [42] }));
    expect((await userPreferencesService.getPreferences("user-d")).dailyReadingIds).toEqual([42]);

    setOnline(false);
    expect((await userPreferencesService.getPreferences("user-d")).dailyReadingIds).toEqual([42]);
  });

  it("une écriture confirmée met la copie locale à jour", async () => {
    const { userPreferencesService } = await import("../services/userPreferencesService");
    getDoc.mockResolvedValue(snapshot({ dailyReadingIds: [5] }));
    await userPreferencesService.getPreferences("user-e");

    setDoc.mockResolvedValue(undefined);
    await userPreferencesService.savePreferences("user-e", { dailyReadingIds: [5, 9] });

    setOnline(false);
    expect((await userPreferencesService.getPreferences("user-e")).dailyReadingIds).toEqual([5, 9]);
  });

  it("garde sur l'appareil une lecture cochée hors connexion", async () => {
    const { userPreferencesService } = await import("../services/userPreferencesService");
    getDoc.mockResolvedValue(snapshot({ dailyReadingIds: [5, 12] }));
    await userPreferencesService.getPreferences("user-g");

    setOnline(false);
    const result = await userPreferencesService.saveDailyProgress("user-g", {
      date: "2026-08-07",
      completedIds: [12],
    });
    expect(result).toBe("queued");
    expect(setDoc).not.toHaveBeenCalled();
    // La coche est visible tout de suite, y compris depuis l'accueil.
    const offlinePrefs = await userPreferencesService.getPreferences("user-g");
    expect(offlinePrefs.dailyReadingProgress.completedIds).toEqual([12]);
  });

  it("renvoie au serveur, fusionnée, la lecture cochée hors connexion", async () => {
    const { userPreferencesService } = await import("../services/userPreferencesService");
    getDoc.mockResolvedValue(snapshot({ dailyReadingIds: [5, 12] }));
    await userPreferencesService.getPreferences("user-h");

    setOnline(false);
    await userPreferencesService.saveDailyProgress("user-h", {
      date: "2026-08-07",
      completedIds: [12],
    });

    // Retour du réseau : le serveur a coché un autre texte entre-temps.
    setOnline(true);
    setDoc.mockResolvedValue(undefined);
    getDoc.mockResolvedValue(
      snapshot({
        dailyReadingIds: [5, 12],
        dailyReadingProgress: { date: "2026-08-07", completedIds: [5] },
      }),
    );
    const prefs = await userPreferencesService.getPreferences("user-h");
    expect(prefs.dailyReadingProgress.completedIds).toEqual([5, 12]);
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1]).toEqual({
      dailyReadingProgress: expect.objectContaining({ completedIds: [5, 12] }),
    });

    // Une fois envoyé, le suivi n'est plus en attente.
    setDoc.mockClear();
    await userPreferencesService.getPreferences("user-h");
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("oublie la copie locale à la déconnexion", async () => {
    const { userPreferencesService, clearPreferencesCache } = await import(
      "../services/userPreferencesService"
    );
    getDoc.mockResolvedValue(snapshot({ dailyReadingIds: [5] }));
    await userPreferencesService.getPreferences("user-f");

    clearPreferencesCache("user-f");
    setOnline(false);
    // Plus de copie locale et plus de réseau : la page repart d'une liste vide.
    getDoc.mockRejectedValue(new Error("offline"));
    expect((await userPreferencesService.getPreferences("user-f")).dailyReadingIds).toEqual([]);
  });
});
