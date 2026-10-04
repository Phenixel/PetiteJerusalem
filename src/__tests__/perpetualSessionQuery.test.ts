import { describe, expect, it, vi } from "vitest";

/**
 * Choisir Tehilim à la création d'une chaîne propose la chaîne perpétuelle.
 * Pour la trouver, la page lisait toute la collection `sessions`,
 * réservations comprises : autant de documents que de sessions, quand le
 * cache de la liste n'était plus frais. Une requête sur le seul champ
 * `perpetual` suffit.
 */

const { getDocs, where, query, collection } = vi.hoisted(() => ({
  getDocs: vi.fn(),
  where: vi.fn((...args: unknown[]) => ({ where: args })),
  query: vi.fn((...args: unknown[]) => ({ query: args })),
  collection: vi.fn((...args: unknown[]) => ({ collection: args[1] })),
}));

vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("firebase/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/firestore")>()),
  collection,
  getDocs,
  query,
  where,
}));

const docOf = (id: string, data: Record<string, unknown>) => ({ id, data: () => data });

describe("la chaîne perpétuelle proposée à la création", () => {
  it("se lit par une requête sur `perpetual`, pas par toute la collection", async () => {
    getDocs.mockResolvedValue({
      docs: [
        docOf("ancienne", { name: "Ancienne", perpetual: true, hidden: true }),
        docOf("chaine-perpetuelle", { name: "Perpétuelle", perpetual: true }),
      ],
    });
    const { sessionService } = await import("../services/sessionService");

    const found = await sessionService.getPerpetualSession();
    expect(found?.id).toBe("chaine-perpetuelle");

    expect(where).toHaveBeenCalledWith("perpetual", "==", true);
    expect(getDocs).toHaveBeenCalledTimes(1);
    // Ce que getDocs reçoit est la requête filtrée, jamais la collection nue.
    expect(getDocs.mock.calls[0][0]).toHaveProperty("query");
  });

  it("le formulaire de création passe par cette requête", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/views/ShareReading/NewSession.vue", "utf8");
    expect(source).toContain("sessionService.getPerpetualSession()");
    expect(source).not.toContain("getAllSessions");
  });
});
