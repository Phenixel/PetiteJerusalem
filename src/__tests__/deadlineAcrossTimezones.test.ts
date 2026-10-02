import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../models/models";

/**
 * La date limite d'une chaîne est la même pour tous, celle qu'a choisie son
 * créateur. Stockée comme un instant (fin de journée dans le fuseau du
 * créateur), elle se relisait dans le fuseau de qui regarde : créée à Paris
 * pour le 5 octobre, elle se lisait « 6 octobre » à Jérusalem et n'y finissait
 * que le 6 ; créée à Montréal, la modale de modification la réenregistrait au
 * 6 à Paris sans qu'on touche à la date.
 */

vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("../services/firestoreService");

const ORIGINAL_TZ = process.env.TZ;

/** Ce que l'app écrit à la création, dans le fuseau du créateur. */
async function createdIn(tz: string, day: string): Promise<Session> {
  process.env.TZ = tz;
  const { endOfLocalDay } = await import("../services/dateService");
  return {
    id: "s1",
    dateLimit: endOfLocalDay(day),
    dateLimitDay: day,
  } as unknown as Session;
}

describe("la date limite d'une chaîne, d'un fuseau à l'autre", () => {
  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
    vi.useRealTimers();
  });

  it("créée à Paris pour le 5, elle est le 5 à Jérusalem et y finit le 5 au soir", async () => {
    const session = await createdIn("Europe/Paris", "2026-10-05");
    process.env.TZ = "Asia/Jerusalem";
    const { deadlineDayOf } = await import("../services/dateService");
    const { sessionService } = await import("../services/sessionService");

    expect(deadlineDayOf(session)).toBe("2026-10-05");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T12:00:00+03:00"));
    expect(sessionService.isSessionFinished(session)).toBe(true);
    vi.setSystemTime(new Date("2026-10-05T23:30:00+03:00"));
    expect(sessionService.isSessionFinished(session)).toBe(false);
  });

  it("créée à Montréal pour le 5, la modale la relit au 5 à Paris", async () => {
    const session = await createdIn("America/Toronto", "2026-10-05");
    process.env.TZ = "Europe/Paris";
    const { deadlineDayOf, localDayKey } = await import("../services/dateService");

    // L'instant seul, relu à Paris, tombe le 6 : c'était le défaut.
    expect(localDayKey(new Date(session.dateLimit))).toBe("2026-10-06");
    expect(deadlineDayOf(session)).toBe("2026-10-05");
  });

  it("sans le jour (anciennes chaînes), l'instant se lit dans le fuseau de l'appareil", async () => {
    const session = await createdIn("Europe/Paris", "2026-10-05");
    delete session.dateLimitDay;
    process.env.TZ = "Asia/Jerusalem";
    const { deadlineDayOf } = await import("../services/dateService");
    expect(deadlineDayOf(session)).toBe("2026-10-06");
  });

  it("un jour qui ne concorde plus avec l'instant cède à l'instant", async () => {
    // Une version publiée de l'app a déplacé la date au 20 sans connaître le
    // champ : il dit encore le 5.
    process.env.TZ = "Europe/Paris";
    const { deadlineDayOf, endOfLocalDay } = await import("../services/dateService");
    const session = {
      dateLimit: endOfLocalDay("2026-10-20"),
      dateLimitDay: "2026-10-05",
    } as unknown as Session;
    expect(deadlineDayOf(session)).toBe("2026-10-20");
  });

  it("la création et la modification écrivent le jour choisi", async () => {
    process.env.TZ = "Europe/Paris";
    const { firestoreService } = await import("../services/firestoreService");
    vi.mocked(firestoreService.getSessionBySlug).mockResolvedValue(null);
    vi.mocked(firestoreService.createSession).mockResolvedValue("s1");
    const { sessionService } = await import("../services/sessionService");
    const { EnumTypeTextStudy } = await import("../models/typeTextStudy");

    await sessionService.createSessionWithValidation(
      "Chaîne",
      "Description",
      EnumTypeTextStudy.Tehilim,
      "2026-10-05",
      "u1",
      "Sarah",
    );
    expect(vi.mocked(firestoreService.createSession).mock.calls[0][0]).toMatchObject({
      dateLimitDay: "2026-10-05",
    });

    await sessionService.updateSession("s1", {
      name: "Chaîne",
      description: "Description",
      dateLimit: "2026-10-07",
      slug: "chaine",
    });
    expect(vi.mocked(firestoreService.updateSession).mock.calls[0][1]).toMatchObject({
      dateLimitDay: "2026-10-07",
    });
  });
});
