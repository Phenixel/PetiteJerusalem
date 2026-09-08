import { describe, it, expect, vi, beforeAll } from "vitest";
import type { Session, TextStudy, TextStudyReservation } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";

vi.mock("../services/firestoreService");
vi.mock("../firebase/firestore", () => ({ db: {} }));

// Node >= 22 masque le localStorage de jsdom : stub mémoire minimal.
beforeAll(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  });
});

import { guestService } from "../services/guestService";
import { reservationService } from "../services/reservationService";
import { sessionService } from "../services/sessionService";
import { endOfLocalDay } from "../services/dateService";

const past = () => new Date(Date.now() - 60_000).toISOString();
const future = () => new Date(Date.now() + 60 * 60_000).toISOString();

const reservation = (overrides: Partial<TextStudyReservation> = {}): TextStudyReservation => ({
  id: "r1",
  textStudyId: "103",
  section: 1,
  chosenByName: "Sarah",
  chosenByGuestId: "guest-1",
  isCompleted: false,
  createdAt: new Date(),
  ...overrides,
});

const text = (id: string, totalSections: number): TextStudy =>
  ({
    id,
    name: `Texte ${id}`,
    livre: "Livre",
    link: "",
    totalSections,
    type: EnumTypeTextStudy.Mishna,
    createdAt: new Date(),
  }) as unknown as TextStudy;

const session = (reservations: TextStudyReservation[]): Session =>
  ({ id: "s1", type: EnumTypeTextStudy.Mishna, reservations }) as unknown as Session;

describe("reservationService.findActiveReservation", () => {
  it("ignore le tirage expiré et trouve la réservation qui a repris la place", () => {
    const expired = reservation({ id: "vieux", expiresAt: past() });
    const fresh = reservation({ id: "neuf" });

    // Le vieux tirage est en tête : l'ancien `find` par texte et section
    // tombait dessus, et annuler ou marquer « lu » visait une réservation morte.
    expect(reservationService.findActiveReservation([expired, fresh], "103", 1)?.id).toBe("neuf");
    expect(reservationService.findActiveReservation([expired], "103", 1)).toBeUndefined();
  });

  it("garde un tirage encore valide, et un tirage lu même périmé", () => {
    const valide = reservation({ id: "valide", expiresAt: future() });
    const lu = reservation({ id: "lu", isCompleted: true, expiresAt: past() });
    expect(reservationService.findActiveReservation([valide], "103", 1)?.id).toBe("valide");
    expect(reservationService.findActiveReservation([lu], "103", 1)?.id).toBe("lu");
  });

  it("une réservation du texte entier couvre chacune de ses sections", () => {
    const entier = reservation({ id: "entier", section: undefined });
    expect(reservationService.findActiveReservation([entier], "103", 4)?.id).toBe("entier");
    expect(reservationService.findActiveReservation([entier], "104", 4)).toBeUndefined();
  });
});

describe("reservationService.pruneExpiredForSlots", () => {
  it("retire les expirés des emplacements demandés, et seulement eux", () => {
    const list = [
      reservation({ id: "e1", expiresAt: past() }),
      reservation({ id: "autre", textStudyId: "104", expiresAt: past() }),
      reservation({ id: "vivant", textStudyId: "105", expiresAt: future() }),
    ];
    const kept = reservationService.pruneExpiredForSlots(list, [
      { textStudyId: "103", section: 1 },
    ]);
    expect(kept.map((r) => r.id)).toEqual(["autre", "vivant"]);
  });

  it("respecte le budget de retrait quand on en donne un", () => {
    const list = [
      reservation({ id: "e1", expiresAt: past() }),
      reservation({ id: "e2", expiresAt: past() }),
      reservation({ id: "e3", expiresAt: past() }),
    ];
    const kept = reservationService.pruneExpiredForSlots(
      list,
      [{ textStudyId: "103", section: 1 }],
      2,
    );
    expect(kept.map((r) => r.id)).toEqual(["e3"]);
  });
});

describe("reservationService.getTextDisplayStatus", () => {
  const texte = text("103", 3);

  it("disponible sans réservation, partiel avec une partie des sections", () => {
    expect(reservationService.getTextDisplayStatus("103", texte, session([])).status).toBe(
      "available",
    );
    expect(
      reservationService.getTextDisplayStatus("103", texte, session([reservation()])).status,
    ).toBe("partially_reserved");
  });

  it("complet quand toutes les sections sont prises par la même personne", () => {
    const s = session([
      reservation({ id: "a", section: 1 }),
      reservation({ id: "b", section: 2 }),
      reservation({ id: "c", section: 3 }),
    ]);
    expect(reservationService.getTextDisplayStatus("103", texte, s)).toEqual({
      status: "fully_reserved",
      reservedBy: "Sarah",
    });
  });

  it("complet aussi quand toutes les sections sont prises par des personnes différentes", () => {
    // Ce cas ressortait « disponible » : la branche qui le traitait venait
    // après celle du partiel, qui l'absorbait.
    const s = session([
      reservation({ id: "a", section: 1, chosenByName: "Sarah" }),
      reservation({ id: "b", section: 2, chosenByName: "David" }),
      reservation({ id: "c", section: 3, chosenByName: "Sarah" }),
    ]);
    expect(reservationService.getTextDisplayStatus("103", texte, s)).toEqual({
      status: "fully_reserved",
      reservedBy: "Sarah, David",
    });
  });

  it("ne compte pas un tirage expiré", () => {
    const s = session([
      reservation({ id: "a", section: 1 }),
      reservation({ id: "b", section: 2 }),
      reservation({ id: "c", section: 3, expiresAt: past() }),
    ]);
    expect(reservationService.getTextDisplayStatus("103", texte, s).status).toBe(
      "partially_reserved",
    );
  });
});

describe("reservationService.isOwnReservation", () => {
  it("reconnaît une réservation faite avec mon compte", () => {
    const user = { id: "u1", email: "u1@mail.fr" };
    expect(reservationService.isOwnReservation({ chosenById: "u1" }, user)).toBe(true);
    expect(reservationService.isOwnReservation({ chosenById: "u2" }, user)).toBe(false);
  });

  it("reconnaît une réservation invitée faite avec mon email ou depuis ce navigateur", () => {
    const user = { id: "u1", email: "u1@mail.fr" };
    const localId = guestService.getOrCreateLocalGuestId();
    expect(reservationService.isOwnReservation({ chosenByGuestId: "u1@mail.fr" }, user)).toBe(true);
    expect(reservationService.isOwnReservation({ chosenByGuestId: localId }, user)).toBe(true);
    expect(reservationService.isOwnReservation({ chosenByGuestId: localId }, null)).toBe(true);
    expect(reservationService.isOwnReservation({ chosenByGuestId: "autre" }, user)).toBe(false);
    expect(reservationService.isOwnReservation({}, user)).toBe(false);
  });
});

describe("sessionService.getSessionReservationStats", () => {
  const textes = [text("103", 3), text("104", 1)];

  it("compte les places, les lectures et les participants, hors tirages expirés", () => {
    const s = session([
      reservation({ id: "a", section: 1, isCompleted: true, chosenByGuestId: "g1" }),
      reservation({ id: "b", section: 2, chosenByGuestId: "g2", chosenByName: "David" }),
      reservation({ id: "c", textStudyId: "104", chosenById: "u1", expiresAt: past() }),
    ]);
    expect(sessionService.getSessionReservationStats(s, textes)).toEqual({
      total: 4,
      reserved: 2,
      read: 1,
      participants: 2,
      percentage: 50,
      readPercentage: 25,
    });
  });

  it("une réservation du texte entier vaut toutes ses sections", () => {
    const s = session([reservation({ id: "a", section: undefined, isCompleted: true })]);
    const stats = sessionService.getSessionReservationStats(s, textes);
    expect(stats.reserved).toBe(3);
    expect(stats.read).toBe(3);
    expect(stats.percentage).toBe(75);
  });
});

describe("endOfLocalDay", () => {
  it("donne la fin de journée locale, pour une chaîne de champ date comme pour une date", () => {
    const fromKey = endOfLocalDay("2026-03-15");
    expect([fromKey.getFullYear(), fromKey.getMonth(), fromKey.getDate()]).toEqual([2026, 2, 15]);
    expect([fromKey.getHours(), fromKey.getMinutes(), fromKey.getSeconds()]).toEqual([23, 59, 59]);

    // Minuit local d'un ancien document : la journée compte quand même entière.
    const fromDate = endOfLocalDay(new Date(2026, 2, 15, 0, 0, 0));
    expect(fromDate.getTime()).toBe(fromKey.getTime());
  });

  it("sert de règle unique à isSessionFinished", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const active = { dateLimit: today } as unknown as Session;
    expect(sessionService.isSessionFinished(active)).toBe(false);

    const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
    expect(sessionService.isSessionFinished({ dateLimit: yesterday } as unknown as Session)).toBe(
      true,
    );
  });
});
