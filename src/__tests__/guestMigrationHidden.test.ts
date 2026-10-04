import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReservationRecord, Session } from "../models/models";

vi.mock("../services/firestoreService");
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));

/**
 * À la connexion, les réservations faites en invité sont rattachées au
 * compte, session par session. Une session masquée par la modération refuse
 * toute écriture sur ses réservations (règle `sessionNotHidden` de
 * firestore.rules) : la transaction levait, la boucle s'arrêtait là, et les
 * réservations des sessions suivantes restaient à l'invité.
 *
 * Firestore est remplacé par un document par session ; l'écriture sur une
 * session masquée est refusée, comme par la règle.
 */

const docs = new Map<string, { hidden?: boolean; reservations: ReservationRecord[] }>();

vi.mock("../firebase/firestore", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, _collection: string, id: string) => ({ id }),
  runTransaction: async (
    _db: unknown,
    fn: (t: {
      get: (ref: { id: string }) => Promise<{ exists: () => boolean; data: () => unknown }>;
      update: (ref: { id: string }, data: { reservations: ReservationRecord[] }) => void;
    }) => Promise<unknown>,
  ) => {
    const writes: [string, ReservationRecord[]][] = [];
    const result = await fn({
      get: (ref) =>
        Promise.resolve({ exists: () => docs.has(ref.id), data: () => docs.get(ref.id) }),
      update: (ref, data) => void writes.push([ref.id, data.reservations]),
    });
    for (const [id, reservations] of writes) {
      if (docs.get(id)?.hidden) {
        throw Object.assign(new Error("Missing or insufficient permissions."), {
          code: "permission-denied",
        });
      }
      docs.get(id)!.reservations = reservations;
    }
    return result;
  },
}));

import { reservationService } from "../services/reservationService";
import { firestoreService } from "../services/firestoreService";

const guestReservation = (id: string): ReservationRecord => ({
  id,
  textStudyId: "103",
  chosenByName: "Anonyme",
  chosenByGuestId: "guest-1",
  isCompleted: false,
  createdAt: new Date().toISOString(),
});

function seed(id: string, hidden = false): Session {
  docs.set(id, { hidden, reservations: [guestReservation(`r-${id}`)] });
  return { id, hidden, reservations: [guestReservation(`r-${id}`)] } as unknown as Session;
}

beforeEach(() => {
  docs.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

const migrate = () =>
  reservationService.migrateGuestReservations("sarah@example.com", "u1", "Sarah", "guest-1");

describe("rattachement des réservations d'invité", () => {
  it("passe une session masquée et rattache celles qui suivent", async () => {
    vi.mocked(firestoreService.getSessions).mockResolvedValue([seed("masquee", true), seed("s2")]);

    expect(await migrate()).toBe(1);
    expect(docs.get("s2")!.reservations[0]).toMatchObject({ chosenById: "u1" });
    expect(docs.get("masquee")!.reservations[0].chosenByGuestId).toBe("guest-1");
  });

  it("une session en échec ne prive pas les suivantes", async () => {
    // Masquée entre la lecture de la liste et la transaction : le cache la
    // croit visible, la règle refuse.
    const stale = seed("s1");
    docs.get("s1")!.hidden = true;
    vi.mocked(firestoreService.getSessions).mockResolvedValue([stale, seed("s2")]);

    expect(await migrate()).toBe(1);
    expect(docs.get("s2")!.reservations[0]).toMatchObject({ chosenById: "u1" });
  });
});
