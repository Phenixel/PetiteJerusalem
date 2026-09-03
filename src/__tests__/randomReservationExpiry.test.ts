import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import type { ReservationRecord } from "../models/models";

vi.mock("../services/firestoreService");

/**
 * Le document de session, en mémoire : ces tests portent sur ce que la
 * transaction ÉCRIT, pas sur Firestore. `doc()` et `runTransaction()` sont
 * remplacés par le minimum dont le service se sert.
 */
const store: { reservations?: ReservationRecord[] } = {};
let exists = true;
let written: { reservations: ReservationRecord[] } | null = null;

vi.mock("../firebase/firestore", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  doc: () => ({}),
  runTransaction: (
    _db: unknown,
    fn: (t: {
      get: (ref: unknown) => Promise<{ exists: () => boolean; data: () => typeof store }>;
      update: (ref: unknown, data: { reservations: ReservationRecord[] }) => void;
    }) => Promise<unknown>,
  ) =>
    fn({
      get: () => Promise.resolve({ exists: () => exists, data: () => store }),
      update: (_ref, data) => {
        written = data;
      },
    }),
}));

beforeAll(() => {
  const memory = new Map<string, string>();
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
  vi.stubGlobal("crypto", { ...globalThis.crypto, randomUUID: () => "new-id" });
});

import { reservationService, ReservationGoneError } from "../services/reservationService";

const past = () => new Date(Date.now() - 60_000).toISOString();
const future = () => new Date(Date.now() + 60 * 60_000).toISOString();

const record = (overrides: Partial<ReservationRecord> = {}): ReservationRecord => ({
  id: "r1",
  textStudyId: "103",
  section: 1,
  chosenByName: "Anonyme",
  chosenByGuestId: "guest-1",
  available: false,
  isCompleted: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  store.reservations = [];
  written = null;
  exists = true;
});

describe("createReservation et les tirages expirés", () => {
  it("remplace le tirage expiré de l'emplacement demandé", async () => {
    store.reservations = [record({ id: "vieux", expiresAt: past() })];

    await reservationService.createReservation(
      "s1",
      "103",
      1,
      undefined,
      "guest-2",
      undefined,
      "Sarah",
    );

    expect(written?.reservations.map((r) => r.id)).toEqual(["new-id"]);
    // Taille inchangée : les règles Firestore l'acceptent comme une simple
    // mise à jour, la borne « au plus une de moins » n'est pas franchie.
    expect(written?.reservations).toHaveLength(store.reservations.length);
  });

  it("laisse intacts les tirages expirés des AUTRES emplacements", async () => {
    store.reservations = [
      record({ id: "autre", textStudyId: "104", expiresAt: past() }),
      record({ id: "vieux", expiresAt: past() }),
    ];

    await reservationService.createReservation(
      "s1",
      "103",
      1,
      undefined,
      "guest-2",
      undefined,
      "Sarah",
    );

    expect(written?.reservations.map((r) => r.id)).toEqual(["autre", "new-id"]);
  });

  it("ne retire jamais plus d'expirés que les règles Firestore n'en acceptent", async () => {
    // Trois enregistrements expirés couvrent le même emplacement (une
    // réservation du texte entier et deux du chapitre). Tout retirer ferait
    // perdre deux éléments au tableau, ce que les règles refusent : on en
    // laisse un, ignoré de toute façon par les affichages.
    store.reservations = [
      record({ id: "e1", section: undefined, expiresAt: past() }),
      record({ id: "e2", expiresAt: past() }),
      record({ id: "e3", expiresAt: past() }),
    ];

    await reservationService.createReservation(
      "s1",
      "103",
      1,
      undefined,
      "guest-2",
      undefined,
      "Sarah",
    );

    expect(written?.reservations).toHaveLength(store.reservations.length - 1);
    expect(written?.reservations.map((r) => r.id)).toEqual(["e3", "new-id"]);
  });

  it("refuse encore un emplacement tenu par un tirage valide", async () => {
    store.reservations = [record({ expiresAt: future() })];

    await expect(
      reservationService.createReservation(
        "s1",
        "103",
        1,
        undefined,
        "guest-2",
        undefined,
        "Sarah",
      ),
    ).rejects.toThrow("déjà réservée");
    expect(written).toBeNull();
  });

  it("écrit expiresAt quand le tirage en pose un", async () => {
    const expiresAt = future();
    await reservationService.createReservation(
      "s1",
      "103",
      1,
      undefined,
      "guest-2",
      undefined,
      "Sarah",
      { expiresAt },
    );

    expect(written?.reservations[0].expiresAt).toBe(expiresAt);
  });

  it("ne pose aucune échéance sur une réservation choisie à la main", async () => {
    await reservationService.createReservation(
      "s1",
      "103",
      1,
      undefined,
      "guest-2",
      undefined,
      "Sarah",
    );

    expect(written?.reservations[0]).not.toHaveProperty("expiresAt");
  });
});

describe("markReservationAsCompleted", () => {
  it("efface l'échéance : lue, la réservation devient définitive", async () => {
    store.reservations = [record({ expiresAt: future() })];

    await reservationService.markReservationAsCompleted("s1", "r1", true);

    expect(written?.reservations[0].isCompleted).toBe(true);
    // Sans cet effacement, « remettre en non lu » une heure plus tard rendrait
    // le texte immédiatement prenable par quelqu'un d'autre.
    expect(written?.reservations[0]).not.toHaveProperty("expiresAt");
  });

  it("garde l'échéance quand on remet en non lu", async () => {
    store.reservations = [record({ isCompleted: true })];

    await reservationService.markReservationAsCompleted("s1", "r1", false);

    expect(written?.reservations[0].isCompleted).toBe(false);
    expect(written?.reservations[0]).not.toHaveProperty("expiresAt");
  });

  it("signale l'emplacement repris par une erreur reconnaissable", async () => {
    store.reservations = [];

    await expect(reservationService.markReservationAsCompleted("s1", "r1", true)).rejects.toThrow(
      ReservationGoneError,
    );
  });
});

describe("renewReservationExpiry", () => {
  it("repousse l'échéance du tirage en cours", async () => {
    store.reservations = [record({ expiresAt: past() })];
    const next = future();

    await reservationService.renewReservationExpiry("s1", "r1", next);

    expect(written?.reservations[0].expiresAt).toBe(next);
  });

  it("n'écrit rien sur une réservation sans échéance", async () => {
    store.reservations = [record()];

    await reservationService.renewReservationExpiry("s1", "r1", future());

    expect(written).toBeNull();
  });

  it("n'écrit rien sur une réservation déjà lue", async () => {
    store.reservations = [record({ isCompleted: true, expiresAt: past() })];

    await reservationService.renewReservationExpiry("s1", "r1", future());

    expect(written).toBeNull();
  });

  it("signale l'emplacement repris", async () => {
    await expect(reservationService.renewReservationExpiry("s1", "r1", future())).rejects.toThrow(
      ReservationGoneError,
    );
  });
});

describe("deleteReservation", () => {
  it("retire la réservation demandée", async () => {
    store.reservations = [record(), record({ id: "r2", textStudyId: "104" })];

    await reservationService.deleteReservation("s1", "r1");

    expect(written?.reservations.map((r) => r.id)).toEqual(["r2"]);
  });

  it("n'écrit rien quand la réservation a déjà disparu", async () => {
    store.reservations = [record({ id: "r2" })];

    await reservationService.deleteReservation("s1", "r1");

    // Les règles n'acceptent qu'une suppression qui retire vraiment un
    // élément : écrire ici ne produirait qu'un refus de permission.
    expect(written).toBeNull();
  });
});

describe("affichages et réservations expirées", () => {
  const sessionWith = (reservations: ReservationRecord[]) => ({ id: "s1", reservations }) as never;

  it("isTextOrSectionReserved ignore un tirage abandonné", () => {
    expect(
      reservationService.isTextOrSectionReserved(
        "103",
        1,
        sessionWith([record({ expiresAt: past() })]),
      ).isReserved,
    ).toBe(false);
    expect(
      reservationService.isTextOrSectionReserved(
        "103",
        1,
        sessionWith([record({ expiresAt: future() })]),
      ).isReserved,
    ).toBe(true);
  });

  it("getTextDisplayStatus rend l'emplacement disponible", () => {
    const textStudy = { id: "103", totalSections: 1 } as never;
    expect(
      reservationService.getTextDisplayStatus(
        "103",
        textStudy,
        sessionWith([record({ expiresAt: past() })]),
      ).status,
    ).toBe("available");
  });

  it("activeReservations ne garde que ce qui tient encore", () => {
    const kept = reservationService.activeReservations([
      record({ id: "vif", expiresAt: future() }),
      record({ id: "lu", isCompleted: true, expiresAt: past() }),
      record({ id: "manuel" }),
      record({ id: "abandonné", expiresAt: past() }),
    ]);
    expect(kept.map((r) => r.id)).toEqual(["vif", "lu", "manuel"]);
  });
});
