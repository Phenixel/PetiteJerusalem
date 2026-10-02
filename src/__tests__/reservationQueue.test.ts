import { describe, expect, it, vi } from "vitest";
import type { ReservationRecord } from "../models/models";

/**
 * Les transactions de réservation d'une même chaîne passent l'une après
 * l'autre. Lancées ensemble (sept sections cochées en quarante secondes, en
 * septembre 2026), chacune invalidait celles encore ouvertes, et la plus
 * lente épuisait ses essais : « the stored version does not match the
 * required base version » (section_mark_read_failed). Un double appui sur le
 * même interrupteur pouvait aussi finir hors d'ordre.
 */

const { started, release, options } = vi.hoisted(() => ({
  started: [] as string[],
  release: [] as Array<() => void>,
  options: [] as unknown[],
}));

const store: { reservations: ReservationRecord[] } = {
  reservations: ["a", "b", "c"].map((id) => ({
    id,
    textStudyId: "103",
    section: 1,
    chosenByGuestId: "g",
    isCompleted: false,
    createdAt: new Date().toISOString(),
  })),
};

vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("../services/firestoreService", () => ({
  firestoreService: { invalidateSessionsCache: vi.fn() },
}));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, _collection: string, id: string) => id,
  // Chaque transaction s'arrête jusqu'à ce que le test la laisse finir.
  runTransaction: async (
    _db: unknown,
    fn: (t: {
      get: (ref: string) => Promise<{ exists: () => boolean; data: () => typeof store }>;
      update: (ref: string, data: { reservations: ReservationRecord[] }) => void;
    }) => Promise<unknown>,
    opts: unknown,
  ) => {
    options.push(opts);
    return fn({
      get: async (ref) => {
        started.push(ref);
        await new Promise<void>((resolve) => release.push(resolve));
        return { exists: () => true, data: () => store };
      },
      update: (_ref, data) => {
        store.reservations = data.reservations;
      },
    });
  },
}));

import { reservationService } from "../services/reservationService";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("les transactions d'une chaîne", () => {
  it("passent l'une après l'autre, dans l'ordre des appuis, et en essaient davantage", async () => {
    const first = reservationService.markReservationAsCompleted("chaine", "a", true);
    const second = reservationService.markReservationAsCompleted("chaine", "a", false);
    const elsewhere = reservationService.markReservationAsCompleted("autre-chaine", "b", true);
    await tick();
    // La première et celle d'une autre chaîne tournent ; la seconde attend.
    expect(started).toEqual(["chaine", "autre-chaine"]);

    release.shift()!();
    await first;
    await tick();
    expect(started).toEqual(["chaine", "autre-chaine", "chaine"]);
    release.shift()!();
    release.shift()!();
    await Promise.all([second, elsewhere]);
    // Le dernier appui l'emporte : « non lu ».
    expect(store.reservations.find((r) => r.id === "a")?.isCompleted).toBe(false);
    expect(options[0]).toEqual({ maxAttempts: 10 });
  });

  it("un échec ne bloque pas la suivante", async () => {
    started.length = 0;
    const gone = reservationService.markReservationAsCompleted("chaine", "inconnue", true);
    const next = reservationService.markReservationAsCompleted("chaine", "c", true);
    await tick();
    release.shift()!();
    await expect(gone).rejects.toThrow();
    await tick();
    release.shift()!();
    await next;
    expect(store.reservations.find((r) => r.id === "c")?.isCompleted).toBe(true);
  });
});
