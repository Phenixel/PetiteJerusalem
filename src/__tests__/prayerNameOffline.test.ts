import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrayerName } from "../models/models";
import type { PrayerNameInput } from "../services/perpetualChain";
import { PrayerNameOfflineError, PrayerNamePendingError } from "../services/appError";
import fr from "../locales/fr";
import en from "../locales/en";
import he from "../locales/he";

/**
 * Les noms de la chaîne perpétuelle sans réseau. Avec le cache persistant de
 * Firestore, une écriture sans réseau ne rend pas la main : la fenêtre
 * « Proposer un nom » restait figée, sans message, et l'écriture partait seule
 * au retour du réseau, d'où un doublon si l'on avait réessayé.
 *
 * - Hors ligne (`navigator.onLine` faux) : ajouter, corriger, prolonger,
 *   retirer refusent tout de suite, sans toucher Firestore
 *   (PrayerNameOfflineError).
 * - L'appareil se croit en ligne mais le serveur ne répond pas : la main est
 *   rendue au bout de SERVER_ACK_TIMEOUT_MS (PrayerNamePendingError), et
 *   réessayer le même nom reprend l'écriture en route au lieu d'en lancer une
 *   seconde.
 */

const addDoc = vi.fn();
const updateDoc = vi.fn();
const deleteDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
  addDoc: (...args: unknown[]) => addDoc(...args),
  updateDoc: (...args: unknown[]) => updateDoc(...args),
  deleteDoc: (...args: unknown[]) => deleteDoc(...args),
  collection: () => ({}),
  doc: () => ({}),
  getDocs: vi.fn(),
  deleteField: () => "deleteField",
  serverTimestamp: () => "serverTimestamp",
  Timestamp: class {
    static fromDate(date: Date) {
      return date;
    }
  },
}));
vi.mock("../firebase/firestore", () => ({ db: {} }));

import { prayerNameService, SERVER_ACK_TIMEOUT_MS } from "../services/prayerNameService";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

const input: PrayerNameInput = {
  gender: "male",
  firstName: "David",
  motherName: "Sarah",
  kind: "refoua",
  deathDay: null,
  deathMonth: null,
};

const name: PrayerName = {
  id: "n1",
  ownerId: "u1",
  gender: "male",
  firstName: "David",
  motherName: "Sarah",
  kind: "refoua",
  createdAt: new Date(),
  updatedAt: new Date(),
  expiresAt: new Date(Date.now() + 86_400_000),
};

describe("un nom de la chaîne perpétuelle, hors ligne", () => {
  beforeEach(() => {
    addDoc.mockReset().mockResolvedValue({ id: "nouveau" });
    updateDoc.mockReset().mockResolvedValue(undefined);
    deleteDoc.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => setOnline(true));

  it("n'est ni ajouté, ni corrigé, ni prolongé, ni retiré, et l'erreur le dit", async () => {
    setOnline(false);
    const chain = "chaine-perpetuelle";
    await expect(prayerNameService.add(chain, "u1", input, 0)).rejects.toBeInstanceOf(
      PrayerNameOfflineError,
    );
    await expect(prayerNameService.update(chain, name, input)).rejects.toBeInstanceOf(
      PrayerNameOfflineError,
    );
    await expect(prayerNameService.renew(chain, name)).rejects.toBeInstanceOf(
      PrayerNameOfflineError,
    );
    await expect(prayerNameService.remove(chain, name.id)).rejects.toBeInstanceOf(
      PrayerNameOfflineError,
    );
    expect(addDoc).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it("s'écrit normalement en ligne", async () => {
    setOnline(true);
    await expect(
      prayerNameService.add("chaine-perpetuelle", "u1", input, 0),
    ).resolves.toMatchObject({ id: "nouveau", firstName: "David" });
    expect(addDoc).toHaveBeenCalledTimes(1);
  });

  it("rend la main quand le serveur se tait, sans écrire le nom deux fois", async () => {
    vi.useFakeTimers();
    try {
      let land: (value: { id: string }) => void = () => {};
      addDoc.mockReturnValue(new Promise((resolve) => (land = resolve)));
      const chain = "chaine-perpetuelle";

      const first = prayerNameService.add(chain, "u1", input, 0).catch((err: unknown) => err);
      await vi.advanceTimersByTimeAsync(SERVER_ACK_TIMEOUT_MS);
      const late = await first;
      expect(late).toBeInstanceOf(PrayerNamePendingError);
      // L'erreur porte l'ajout en route : la fenêtre le montrera quand il arrive.
      const landing = (late as PrayerNamePendingError).landing;
      expect(landing).toBeDefined();

      // On réessaie le même nom : c'est la même écriture, qui arrive enfin.
      const retry = prayerNameService.add(chain, "u1", { ...input, firstName: " David " }, 0);
      land({ id: "arrive" });
      await expect(retry).resolves.toMatchObject({ id: "arrive" });
      await expect(landing).resolves.toMatchObject({ id: "arrive", firstName: "David" });
      expect(addDoc).toHaveBeenCalledTimes(1);

      // Une fois arrivée, un nouvel ajout est un nouvel ajout.
      addDoc.mockResolvedValue({ id: "autre" });
      await expect(prayerNameService.add(chain, "u1", input, 1)).resolves.toMatchObject({
        id: "autre",
      });
      expect(addDoc).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rend la main aussi pour corriger, prolonger ou retirer", async () => {
    vi.useFakeTimers();
    try {
      const never = () => new Promise<never>(() => {});
      updateDoc.mockImplementation(never);
      deleteDoc.mockImplementation(never);
      const chain = "chaine-perpetuelle";
      const writes = [
        prayerNameService.update(chain, name, input),
        prayerNameService.renew(chain, name),
        prayerNameService.remove(chain, name.id),
      ];
      const checks = writes.map((w) => expect(w).rejects.toBeInstanceOf(PrayerNamePendingError));
      await vi.advanceTimersByTimeAsync(SERVER_ACK_TIMEOUT_MS);
      await Promise.all(checks);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a ses messages dans les trois langues", () => {
    for (const code of [new PrayerNameOfflineError().code, new PrayerNamePendingError().code]) {
      for (const locale of [fr, en, he]) {
        expect((locale.errors as Record<string, string>)[code]).toBeTruthy();
      }
    }
  });
});
