import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Sur le site, l'accueil d'un visiteur tirait le SDK Firestore complet
 * (173 kB gzip, un canal d'écoute, IndexedDB relu toutes les quatre secondes)
 * pour les seules informations de l'équipe. Elles se lisent désormais par
 * Firestore Lite (33 kB gzip) ; l'app native garde le SDK complet et son
 * cache hors ligne.
 */

const { getDocs, fullLoaded } = vi.hoisted(() => ({
  getDocs: vi.fn(),
  fullLoaded: vi.fn(),
}));

vi.mock("../composables/useNativeApp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../composables/useNativeApp")>()),
  isNativeApp: false,
}));
vi.mock("../firebase/firestoreLite", () => ({ liteDb: { lite: true } }));
vi.mock("firebase/firestore/lite", () => ({
  collection: (...args: unknown[]) => ({ collection: args }),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs,
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: (...args: unknown[]) => ({ query: args }),
  where: vi.fn(),
}));
// Le SDK complet ne doit pas être chargé sur le site.
vi.mock("../firebase/firestore", () => {
  fullLoaded();
  return { db: {} };
});

describe("les informations de l'équipe sur le site", () => {
  it("se lisent par Firestore Lite, sans charger le SDK complet", async () => {
    getDocs.mockResolvedValue({
      docs: [
        {
          id: "a1",
          data: () => ({
            kind: "news",
            title: { fr: "Nouveau" },
            body: { fr: "" },
            published: true,
          }),
        },
      ],
    });
    const { announcementService } = await import("../services/announcementService");
    const list = await announcementService.getAll();

    expect(list.map((a) => a.id)).toEqual(["a1"]);
    expect(getDocs).toHaveBeenCalledTimes(1);
    // La requête vise la base Lite.
    expect(JSON.stringify(getDocs.mock.calls[0][0])).toContain('"lite":true');
    expect(fullLoaded).not.toHaveBeenCalled();
  });

  it("n'importe statiquement ni le SDK complet ni sa base", () => {
    const source = readFileSync("src/services/announcementService.ts", "utf8");
    const staticImports = [...source.matchAll(/^import\s+(?!type\s)[^;]*?from\s+"([^"]+)"/gm)].map(
      (m) => m[1],
    );
    expect(staticImports).not.toContain("firebase/firestore");
    expect(staticImports).not.toContain("../firebase/firestore");
  });

  it("le module partagé par Lite et le SDK complet a son propre chunk", () => {
    // Laissé dans « firebase-firestore », il y faisait charger tout le SDK
    // complet à qui n'importait que Lite.
    const config = readFileSync("vite.config.ts", "utf8");
    expect(config).toContain("'firebase-bloom': ['@firebase/webchannel-wrapper/bloom-blob']");
  });
});
