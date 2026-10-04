import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { Session } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";

/**
 * Les puces de type de l'accueil du partage proposaient aussi les types qui
 * n'existaient que dans des chaînes terminées, masquées, d'un créateur
 * bloqué, ou dans la chaîne perpétuelle : cliquer dessus menait à « aucun
 * résultat ». Elles suivent désormais la liste « En cours ».
 */

vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("../services/firestoreService");

const DAY = 86_400_000;
const chain = (over: Partial<Session>): Session =>
  ({
    id: over.type,
    name: "Chaîne",
    personId: "u1",
    dateLimit: new Date(Date.now() + 7 * DAY),
    reservations: [],
    ...over,
  }) as Session;

describe("les puces de type de l'accueil du partage", () => {
  it("ne proposent que les types de la liste en cours", async () => {
    const { sessionService } = await import("../services/sessionService");
    const sessions = [
      chain({ type: EnumTypeTextStudy.Mishna }),
      chain({ type: EnumTypeTextStudy.Tanakh, dateLimit: new Date(Date.now() - 2 * DAY) }),
      chain({ type: EnumTypeTextStudy.TalmudBavli, hidden: true }),
      chain({ type: EnumTypeTextStudy.Tehilim, perpetual: true }),
      chain({ id: "t2", type: EnumTypeTextStudy.Tehilim, personId: "bloque" }),
    ];
    expect(sessionService.listedTypes(sessions, ["bloque"])).toEqual([EnumTypeTextStudy.Mishna]);
  });

  it("la page en tire ses puces", () => {
    const page = readFileSync("src/views/ShareReading/ShareHomePage.vue", "utf8");
    expect(page).toContain("sessionService.listedTypes(sessions.value");
  });
});
