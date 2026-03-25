import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";

vi.mock("../services/firestoreService");

import { sessionService } from "../services/sessionService";
import { firestoreService } from "../services/firestoreService";

const baseSession: Session = {
  id: "abc123",
  slug: "etude-du-talmud",
  name: "Étude du Talmud",
  type: EnumTypeTextStudy.TalmudBavli,
  description: "Une session de Talmud.",
  dateLimit: new Date("2026-12-31"),
  createdAt: new Date("2026-01-01"),
  personId: "user1",
  creatorName: "Shimon",
  isCompleted: false,
  reservations: [],
};

const validArgs = {
  name: "Étude du Talmud",
  description: "Une session de Talmud.",
  type: EnumTypeTextStudy.TalmudBavli,
  dateLimit: "2026-12-31",
  personId: "user1",
  creatorName: "Shimon",
};

describe("sessionService - slug unique à la création", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(firestoreService.createSession).mockResolvedValue("new-id");
  });

  it("utilise le slug de base quand il n'existe pas encore", async () => {
    vi.mocked(firestoreService.getSessionBySlug).mockResolvedValue(null);

    await sessionService.createSessionWithValidation(
      validArgs.name,
      validArgs.description,
      validArgs.type,
      validArgs.dateLimit,
      validArgs.personId,
      validArgs.creatorName,
    );

    expect(firestoreService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "etude-du-talmud" }),
    );
  });

  it("utilise slug-1 quand le slug de base est déjà pris", async () => {
    vi.mocked(firestoreService.getSessionBySlug)
      .mockResolvedValueOnce(baseSession) // "etude-du-talmud" pris
      .mockResolvedValueOnce(null); // "etude-du-talmud-1" libre

    await sessionService.createSessionWithValidation(
      validArgs.name,
      validArgs.description,
      validArgs.type,
      validArgs.dateLimit,
      validArgs.personId,
      validArgs.creatorName,
    );

    expect(firestoreService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "etude-du-talmud-1" }),
    );
  });

  it("incrémente jusqu'à trouver un slug libre (slug-2)", async () => {
    vi.mocked(firestoreService.getSessionBySlug)
      .mockResolvedValueOnce(baseSession) // "etude-du-talmud" pris
      .mockResolvedValueOnce({ ...baseSession, id: "xyz", slug: "etude-du-talmud-1" }) // "-1" pris
      .mockResolvedValueOnce(null); // "-2" libre

    await sessionService.createSessionWithValidation(
      validArgs.name,
      validArgs.description,
      validArgs.type,
      validArgs.dateLimit,
      validArgs.personId,
      validArgs.creatorName,
    );

    expect(firestoreService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "etude-du-talmud-2" }),
    );
  });
});

describe("sessionService - slug unique à la mise à jour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(firestoreService.updateSession).mockResolvedValue(undefined);
  });

  it("réutilise son propre slug sans suffixe si le nom n'a pas changé", async () => {
    vi.mocked(firestoreService.getSessionBySlug).mockResolvedValue(baseSession);

    await sessionService.updateSession("abc123", {
      name: "Étude du Talmud",
      description: "desc",
      dateLimit: "2026-12-31",
    });

    expect(firestoreService.updateSession).toHaveBeenCalledWith(
      "abc123",
      expect.objectContaining({ slug: "etude-du-talmud" }),
    );
  });

  it("génère slug-1 si le nouveau nom est déjà pris par une autre session", async () => {
    const otherSession = { ...baseSession, id: "other-id", slug: "nouveau-nom" };
    vi.mocked(firestoreService.getSessionBySlug)
      .mockResolvedValueOnce(otherSession) // "nouveau-nom" pris par autre session
      .mockResolvedValueOnce(null); // "nouveau-nom-1" libre

    await sessionService.updateSession("abc123", {
      name: "Nouveau nom",
      description: "desc",
      dateLimit: "2026-12-31",
    });

    expect(firestoreService.updateSession).toHaveBeenCalledWith(
      "abc123",
      expect.objectContaining({ slug: "nouveau-nom-1" }),
    );
  });
});
