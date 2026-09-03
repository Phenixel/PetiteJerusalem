import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import type { Session, TextStudy, TextStudyReservation } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";

vi.mock("../services/firestoreService");

// Même stub que guestReservations.test.ts : Node >= 22 masque le
// localStorage de jsdom.
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

const makeText = (id: string): TextStudy =>
  ({
    id,
    name: `Tehilim ${id}`,
    livre: "ספר 1 (Sefer 1)",
    link: "",
    totalSections: 1,
    type: EnumTypeTextStudy.Tehilim,
    createdAt: new Date(),
  }) as unknown as TextStudy;

const makeSession = (reservations: TextStudyReservation[] = []): Session =>
  ({
    id: "s1",
    name: "Chaîne",
    type: EnumTypeTextStudy.Tehilim,
    reservations,
  }) as unknown as Session;

const emptyForm = { name: "", email: "" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sessionService - tirage aléatoire", () => {
  it("réserve un texte disponible au nom « Anonyme » pour un invité sans nom", async () => {
    const spy = vi.spyOn(reservationService, "createReservation").mockResolvedValue("rid-1");
    const localId = guestService.getOrCreateLocalGuestId();

    const result = await sessionService.reserveRandomAvailableText(
      makeSession(),
      [makeText("103"), makeText("104")],
      null,
      emptyForm,
      "Anonyme",
    );

    expect(result).not.toBeNull();
    expect(["103", "104"]).toContain(result!.text.id);
    expect(spy).toHaveBeenCalledWith(
      "s1",
      result!.text.id,
      1,
      undefined,
      localId,
      undefined,
      "Anonyme",
      { expiresAt: expect.any(String) },
    );
    expect(result!.reservation).toMatchObject({
      id: "rid-1",
      textStudyId: result!.text.id,
      section: 1,
      chosenByName: "Anonyme",
      chosenByGuestId: localId,
      isCompleted: false,
    });
    // Le tirage expire dans environ une heure : non lu d'ici là, il sera
    // libéré automatiquement.
    const ttl = new Date(result!.reservation.expiresAt!).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(55 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it("préfère le nom du formulaire invité quand il est rempli", async () => {
    vi.spyOn(reservationService, "createReservation").mockResolvedValue("rid-2");

    const result = await sessionService.reserveRandomAvailableText(
      makeSession(),
      [makeText("103")],
      null,
      { name: "Sarah", email: "" },
      "Anonyme",
    );

    expect(result!.reservation.chosenByName).toBe("Sarah");
  });

  it("réserve au nom de l'utilisateur connecté", async () => {
    const spy = vi.spyOn(reservationService, "createReservation").mockResolvedValue("rid-3");
    const user = { id: "u1", name: "Shimon", email: "shimon@mail.fr" };

    const result = await sessionService.reserveRandomAvailableText(
      makeSession(),
      [makeText("103")],
      user,
      emptyForm,
      "Anonyme",
    );

    expect(spy).toHaveBeenCalledWith("s1", "103", 1, "u1", undefined, "Shimon", undefined, {
      expiresAt: expect.any(String),
    });
    expect(result!.reservation).toMatchObject({ chosenById: "u1", chosenByName: "Shimon" });
  });

  it("écarte les textes déjà réservés du tirage", async () => {
    vi.spyOn(reservationService, "createReservation").mockResolvedValue("rid-4");
    const session = makeSession([
      {
        id: "r1",
        textStudyId: "103",
        section: 1,
        available: false,
        isCompleted: false,
        createdAt: new Date(),
      },
    ]);

    const result = await sessionService.reserveRandomAvailableText(
      session,
      [makeText("103"), makeText("104")],
      null,
      emptyForm,
      "Anonyme",
    );

    expect(result!.text.id).toBe("104");
  });

  it("repioche un autre texte quand le premier tirage entre en conflit", async () => {
    const spy = vi
      .spyOn(reservationService, "createReservation")
      .mockRejectedValueOnce(new Error("Cette section est déjà réservée"))
      .mockResolvedValueOnce("rid-5");

    const result = await sessionService.reserveRandomAvailableText(
      makeSession(),
      [makeText("103"), makeText("104")],
      null,
      emptyForm,
      "Anonyme",
    );

    expect(result).not.toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
    // Le texte en conflit ne doit pas être retiré : les deux appels portent
    // sur des textes différents.
    expect(spy.mock.calls[0][1]).not.toBe(spy.mock.calls[1][1]);
  });

  it("renvoie null quand plus rien n'est disponible", async () => {
    const spy = vi.spyOn(reservationService, "createReservation");
    const session = makeSession([
      {
        id: "r1",
        textStudyId: "103",
        section: 1,
        available: false,
        isCompleted: false,
        createdAt: new Date(),
      },
    ]);

    const result = await sessionService.reserveRandomAvailableText(
      session,
      [makeText("103")],
      null,
      emptyForm,
      "Anonyme",
    );

    expect(result).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("considère comme disponible un tirage expiré sans lecture", async () => {
    vi.spyOn(reservationService, "createReservation").mockResolvedValue("rid-6");
    const session = makeSession([
      {
        id: "r1",
        textStudyId: "103",
        section: 1,
        available: false,
        isCompleted: false,
        createdAt: new Date(),
        // Tirage abandonné : expiré depuis une minute, jamais lu.
        expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
      },
    ]);

    const result = await sessionService.reserveRandomAvailableText(
      session,
      [makeText("103")],
      null,
      emptyForm,
      "Anonyme",
    );

    expect(result!.text.id).toBe("103");
  });

  it("un tirage expiré mais lu reste réservé", async () => {
    const spy = vi.spyOn(reservationService, "createReservation");
    const session = makeSession([
      {
        id: "r1",
        textStudyId: "103",
        section: 1,
        available: false,
        isCompleted: true,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
      },
    ]);

    const result = await sessionService.reserveRandomAvailableText(
      session,
      [makeText("103")],
      null,
      emptyForm,
      "Anonyme",
    );

    expect(result).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("isReservationExpired ne vise que les tirages non lus et périmés", () => {
    const base = {
      id: "r1",
      textStudyId: "103",
      available: false,
      createdAt: new Date(),
    };
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 1000).toISOString();

    // Réservation manuelle (sans expiresAt) : n'expire jamais.
    expect(sessionService.isReservationExpired({ ...base, isCompleted: false })).toBe(false);
    // Tirage encore dans les temps.
    expect(
      sessionService.isReservationExpired({ ...base, isCompleted: false, expiresAt: future }),
    ).toBe(false);
    // Tirage périmé sans lecture : libéré.
    expect(
      sessionService.isReservationExpired({ ...base, isCompleted: false, expiresAt: past }),
    ).toBe(true);
    // Tirage lu avant ou après l'échéance : acquis.
    expect(
      sessionService.isReservationExpired({ ...base, isCompleted: true, expiresAt: past }),
    ).toBe(false);
  });

  it("renewRandomReservation repousse l'échéance et rend la nouvelle", async () => {
    const spy = vi.spyOn(reservationService, "renewReservationExpiry").mockResolvedValue();

    const expiresAt = await sessionService.renewRandomReservation("s1", "r1");

    expect(spy).toHaveBeenCalledWith("s1", "r1", expiresAt);
    const ttl = new Date(expiresAt).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(55 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it("laisse remonter les autres erreurs sans repiocher", async () => {
    vi.spyOn(reservationService, "createReservation").mockRejectedValue(
      new Error("Document de session introuvable"),
    );

    await expect(
      sessionService.reserveRandomAvailableText(
        makeSession(),
        [makeText("103"), makeText("104")],
        null,
        emptyForm,
        "Anonyme",
      ),
    ).rejects.toThrow("introuvable");
  });
});

describe("sessionService - statistiques et tirages abandonnés", () => {
  const reservation = (overrides: Partial<TextStudyReservation>): TextStudyReservation => ({
    id: "r1",
    textStudyId: "103",
    section: 1,
    available: false,
    isCompleted: false,
    createdAt: new Date(),
    ...overrides,
  });

  it("l'aperçu ne compte plus un tirage expiré sans lecture", () => {
    const abandonne = makeSession([
      reservation({ expiresAt: new Date(Date.now() - 60 * 1000).toISOString() }),
    ]);
    const tenu = makeSession([
      reservation({ expiresAt: new Date(Date.now() + 60 * 1000).toISOString() }),
    ]);

    expect(sessionService.getSessionReservationStats(abandonne).reserved).toBe(0);
    expect(sessionService.getSessionReservationStats(tenu).reserved).toBe(1);
  });

  it("l'aperçu compte encore un tirage lu, même passée l'échéance", () => {
    const lu = makeSession([
      reservation({
        isCompleted: true,
        expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
      }),
    ]);

    expect(sessionService.getSessionReservationStats(lu).reserved).toBe(1);
  });
});
