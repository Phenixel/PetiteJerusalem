import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TextStudyReservation } from "../models/models";

vi.mock("../services/firestoreService");
vi.mock("../firebase/firestore", () => ({ db: {} }));

/**
 * Un invité qui réserve avec son email : l'email devient le
 * `chosenByGuestId` de la réservation, mais le formulaire se vide au
 * rechargement de la page. L'invité ne pouvait plus alors ni annuler ni
 * marquer lue sa propre réservation : l'appareil ne savait plus qui il était.
 */

const memory = new Map<string, string>();
beforeAll(() => {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, String(value)),
    removeItem: (key: string) => void memory.delete(key),
    clear: () => memory.clear(),
    key: (index: number) => Array.from(memory.keys())[index] ?? null,
    get length() {
      return memory.size;
    },
  });
});

beforeEach(() => memory.clear());

async function services() {
  vi.resetModules();
  const { reservationService } = await import("../services/reservationService");
  const { guestService } = await import("../services/guestService");
  return { reservationService, guestService };
}

const reservation = (chosenByGuestId: string): TextStudyReservation => ({
  id: "r1",
  textStudyId: "103",
  chosenByGuestId,
  isCompleted: false,
  createdAt: new Date(),
});

describe("l'email d'un invité, après rechargement", () => {
  it("lui laisse annuler sa réservation, formulaire vide", async () => {
    const avant = await services();
    const guestId = avant.reservationService.resolveGuestId({
      name: "Sarah",
      email: " sarah@mail.fr ",
    });
    expect(guestId).toBe("sarah@mail.fr");

    // Rechargement : nouveaux modules, formulaire vide, même stockage.
    const apres = await services();
    expect(apres.reservationService.canUserDeleteReservation(reservation(guestId), null, "")).toBe(
      true,
    );
  });

  it("ne donne rien sur la réservation d'un autre email", async () => {
    const { reservationService } = await services();
    reservationService.resolveGuestId({ name: "Sarah", email: "sarah@mail.fr" });

    expect(
      reservationService.canUserDeleteReservation(reservation("autre@mail.fr"), null, ""),
    ).toBe(false);
  });

  it("garde les plus récents, sans doublon", async () => {
    const { guestService } = await services();
    for (let i = 1; i <= 7; i++) guestService.rememberGuestEmail(`e${i}@mail.fr`);
    guestService.rememberGuestEmail("e5@mail.fr");

    expect(guestService.getGuestEmails()).toEqual([
      "e5@mail.fr",
      "e7@mail.fr",
      "e6@mail.fr",
      "e4@mail.fr",
      "e3@mail.fr",
    ]);
  });

  it("réserver sans email ne retient rien", async () => {
    const { reservationService, guestService } = await services();
    reservationService.resolveGuestId({ name: "Sarah", email: "  " });

    expect(guestService.getGuestEmails()).toEqual([]);
  });
});
