import { describe, expect, it, vi } from "vitest";

/**
 * La liste des sessions se garde une minute, et toute écriture l'invalide.
 * Une lecture partie AVANT l'écriture rapportait pourtant l'état d'avant et
 * remplissait le cache après l'invalidation : la réservation qu'on venait de
 * faire manquait à la liste pendant une minute.
 */

const { getDocs } = vi.hoisted(() => ({ getDocs: vi.fn() }));

vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("firebase/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/firestore")>()),
  collection: vi.fn(),
  getDocs,
}));

const snapshot = (names: string[]) => ({
  docs: names.map((name) => ({ id: name, data: () => ({ name, reservations: [] }) })),
});

describe("le cache de la liste des sessions", () => {
  it("ne garde pas une lecture partie avant une écriture", async () => {
    const { firestoreService } = await import("../services/firestoreService");

    let release!: (value: unknown) => void;
    getDocs.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const stale = firestoreService.getSessions();

    // Une écriture passe pendant la lecture.
    firestoreService.invalidateSessionsCache();
    release(snapshot(["avant"]));
    expect((await stale).map((s) => s.name)).toEqual(["avant"]);

    // La lecture suivante repart du serveur.
    getDocs.mockResolvedValueOnce(snapshot(["avant", "après"]));
    const fresh = await firestoreService.getSessions();
    expect(fresh.map((s) => s.name)).toEqual(["avant", "après"]);
    expect(getDocs).toHaveBeenCalledTimes(2);
  });

  it("une lecture ancienne n'efface pas la lecture plus récente en cours", async () => {
    vi.resetModules();
    getDocs.mockReset();
    const { firestoreService } = await import("../services/firestoreService");

    let releaseOld!: (value: unknown) => void;
    getDocs.mockImplementationOnce(() => new Promise((resolve) => (releaseOld = resolve)));
    const old = firestoreService.getSessions();
    firestoreService.invalidateSessionsCache();

    let releaseNew!: (value: unknown) => void;
    getDocs.mockImplementationOnce(() => new Promise((resolve) => (releaseNew = resolve)));
    const recent = firestoreService.getSessions();

    releaseOld(snapshot(["avant"]));
    await old;
    // Un troisième appelant rejoint la lecture récente au lieu d'en lancer une.
    const joined = firestoreService.getSessions();
    releaseNew(snapshot(["après"]));
    expect((await recent).map((s) => s.name)).toEqual(["après"]);
    expect((await joined).map((s) => s.name)).toEqual(["après"]);
    expect(getDocs).toHaveBeenCalledTimes(2);
  });
});
