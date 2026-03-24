import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";

vi.mock("../services/firestoreService");

import { sessionService } from "../services/sessionService";
import { firestoreService } from "../services/firestoreService";

const mockSession: Session = {
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

describe("sessionService.resolveSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne la session trouvée par slug", async () => {
    vi.mocked(firestoreService.getSessionBySlug).mockResolvedValue(mockSession);

    const result = await sessionService.resolveSession("etude-du-talmud");

    expect(result).toBe(mockSession);
    expect(firestoreService.getSessionBySlug).toHaveBeenCalledWith("etude-du-talmud");
    expect(firestoreService.getSessionById).not.toHaveBeenCalled();
  });

  it("fait un fallback sur getSessionById si le slug n'est pas trouvé", async () => {
    vi.mocked(firestoreService.getSessionBySlug).mockResolvedValue(null);
    vi.mocked(firestoreService.getSessionById).mockResolvedValue(mockSession);

    const result = await sessionService.resolveSession("abc123");

    expect(result).toBe(mockSession);
    expect(firestoreService.getSessionBySlug).toHaveBeenCalledWith("abc123");
    expect(firestoreService.getSessionById).toHaveBeenCalledWith("abc123");
  });

  it("retourne null si ni le slug ni l'ID ne donnent de résultat", async () => {
    vi.mocked(firestoreService.getSessionBySlug).mockResolvedValue(null);
    vi.mocked(firestoreService.getSessionById).mockResolvedValue(null);

    const result = await sessionService.resolveSession("inexistant");

    expect(result).toBeNull();
  });

  it("résout par slug en priorité même si l'ID correspondrait aussi", async () => {
    const sessionBySlug = { ...mockSession, id: "other-id" };
    vi.mocked(firestoreService.getSessionBySlug).mockResolvedValue(sessionBySlug);

    const result = await sessionService.resolveSession("etude-du-talmud");

    expect(result).toBe(sessionBySlug);
    expect(firestoreService.getSessionById).not.toHaveBeenCalled();
  });
});
