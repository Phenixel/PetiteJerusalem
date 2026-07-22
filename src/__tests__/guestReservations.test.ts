import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TextStudyReservation } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";

vi.mock("../services/firestoreService");

import { guestService } from "../services/guestService";
import { reservationService } from "../services/reservationService";
import { sessionService } from "../services/sessionService";
import { firestoreService } from "../services/firestoreService";

const makeReservation = (overrides: Partial<TextStudyReservation> = {}): TextStudyReservation => ({
  id: "r1",
  textStudyId: "t1",
  available: false,
  isCompleted: false,
  createdAt: new Date(),
  ...overrides,
});

describe("guestService - identité locale", () => {
  it("ne crée pas d'identifiant tant qu'on ne le demande pas", () => {
    // Doit passer avant tout getOrCreateLocalGuestId : l'identifiant ne doit
    // pas être créé au chargement de la page pour un simple visiteur.
    expect(guestService.getLocalGuestId()).toBeNull();
  });

  it("crée un identifiant stable et le persiste en localStorage", () => {
    const id = guestService.getOrCreateLocalGuestId();
    expect(id).toMatch(/^guest-/);
    expect(guestService.getOrCreateLocalGuestId()).toBe(id);
    expect(guestService.getLocalGuestId()).toBe(id);
    expect(localStorage.getItem("pj_guest_id")).toBe(id);
  });
});

describe("reservationService - invités sans email", () => {
  it("resolveGuestId privilégie l'email quand il est fourni", () => {
    expect(reservationService.resolveGuestId({ name: "Sarah", email: " sarah@mail.fr " })).toBe(
      "sarah@mail.fr",
    );
  });

  it("resolveGuestId retombe sur l'identifiant local sans email", () => {
    const localId = guestService.getOrCreateLocalGuestId();
    expect(reservationService.resolveGuestId({ name: "Sarah", email: "" })).toBe(localId);
  });

  it("canUserDeleteReservation reconnaît l'invité via son email", () => {
    const reservation = makeReservation({ chosenByGuestId: "sarah@mail.fr" });
    expect(reservationService.canUserDeleteReservation(reservation, null, "sarah@mail.fr")).toBe(
      true,
    );
    expect(reservationService.canUserDeleteReservation(reservation, null, "autre@mail.fr")).toBe(
      false,
    );
  });

  it("canUserDeleteReservation reconnaît l'invité via l'identifiant local, sans email saisi", () => {
    const localId = guestService.getOrCreateLocalGuestId();
    const reservation = makeReservation({ chosenByGuestId: localId });
    expect(reservationService.canUserDeleteReservation(reservation, null)).toBe(true);
    expect(reservationService.canUserDeleteReservation(reservation, null, "")).toBe(true);
  });

  it("canUserDeleteReservation refuse un invité étranger à la réservation", () => {
    const reservation = makeReservation({ chosenByGuestId: "guest-quelquun-dautre" });
    expect(reservationService.canUserDeleteReservation(reservation, null)).toBe(false);
  });

  it("canUserDeleteReservation reconnaît un utilisateur connecté par son id", () => {
    const user = { id: "u1", email: "u1@mail.fr" };
    expect(
      reservationService.canUserDeleteReservation(makeReservation({ chosenById: "u1" }), user),
    ).toBe(true);
    expect(
      reservationService.canUserDeleteReservation(makeReservation({ chosenById: "u2" }), user),
    ).toBe(false);
  });
});

describe("sessionService - email invité optionnel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createSessionWithValidation enregistre le choix du créateur", async () => {
    vi.mocked(firestoreService.getSessionBySlug).mockResolvedValue(null);
    vi.mocked(firestoreService.createSession).mockResolvedValue("new-id");

    await sessionService.createSessionWithValidation(
      "Étude",
      "desc",
      EnumTypeTextStudy.Tehilim,
      "2026-12-31",
      "user1",
      "Shimon",
      undefined,
      true,
    );

    expect(firestoreService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ guestEmailRequired: true }),
    );
  });

  it("createSessionWithValidation laisse l'email optionnel par défaut", async () => {
    vi.mocked(firestoreService.getSessionBySlug).mockResolvedValue(null);
    vi.mocked(firestoreService.createSession).mockResolvedValue("new-id");

    await sessionService.createSessionWithValidation(
      "Étude",
      "desc",
      EnumTypeTextStudy.Tehilim,
      "2026-12-31",
      "user1",
      "Shimon",
    );

    expect(firestoreService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ guestEmailRequired: false }),
    );
  });

  it("createBatchReservationsForUser exige l'email quand la session l'impose", async () => {
    await expect(
      sessionService.createBatchReservationsForUser(
        "s1",
        [{ textStudyId: "t1" }],
        null,
        { name: "Sarah", email: "" },
        true,
      ),
    ).rejects.toThrow("nom et email");
  });

  it("createBatchReservationsForUser accepte le nom seul quand l'email est optionnel", async () => {
    const spy = vi
      .spyOn(reservationService, "createBatchReservations")
      .mockResolvedValue(["id1"]);

    const localId = guestService.getOrCreateLocalGuestId();
    await sessionService.createBatchReservationsForUser(
      "s1",
      [{ textStudyId: "t1" }],
      null,
      { name: "Sarah", email: "" },
      false,
    );

    expect(spy).toHaveBeenCalledWith("s1", [{ textStudyId: "t1" }], undefined, localId, undefined, "Sarah");
    spy.mockRestore();
  });

  it("createBatchReservationsForUser refuse toujours un formulaire sans nom", async () => {
    await expect(
      sessionService.createBatchReservationsForUser(
        "s1",
        [{ textStudyId: "t1" }],
        null,
        { name: "", email: "" },
        false,
      ),
    ).rejects.toThrow("nom");
  });
});
