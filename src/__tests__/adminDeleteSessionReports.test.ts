import { describe, expect, it, vi } from "vitest";

/**
 * Supprimer une session depuis le backoffice supprimait les signalements de
 * la liste chargée avec la page, pas ceux arrivés depuis : un signalement
 * posé entre-temps restait orphelin et gonflait la pastille « sessions
 * signalées », sans ligne pour le traiter.
 */

const { deleted, getDocs } = vi.hoisted(() => ({
  deleted: [] as string[],
  getDocs: vi.fn(),
}));

vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("../firebase/storage", () => ({ storage: {} }));
vi.mock("firebase/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/firestore")>()),
  collection: (_db: unknown, name: string) => ({ name }),
  doc: (_db: unknown, name: string, id: string) => ({ path: `${name}/${id}` }),
  query: (...args: unknown[]) => ({ query: args }),
  where: (...args: unknown[]) => ({ where: args }),
  getDocs,
  writeBatch: () => ({
    delete: (ref: { path: string }) => deleted.push(ref.path),
    update: vi.fn(),
    commit: () => Promise.resolve(),
  }),
}));

describe("supprimer une session depuis le backoffice", () => {
  it("supprime aussi les signalements arrivés depuis le chargement de la page", async () => {
    getDocs.mockResolvedValue({ docs: [{ id: "ancien" }, { id: "nouveau" }] });
    const { adminService } = await import("../services/adminService");

    await adminService.deleteSessionWithReports("s1", [{ id: "ancien" } as never]);

    expect(deleted.sort()).toEqual(["reports/ancien", "reports/nouveau", "sessions/s1"]);
  });
});
