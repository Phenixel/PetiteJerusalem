import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le slug compose le lien de partage d'une chaîne (`/partage/session/<slug>`).
 * L'app en génère un unique, mais rien n'empêche un client d'écrire une
 * session avec le slug d'une autre : les règles ne voient pas les autres
 * documents. getSessionBySlug rendait alors le premier résultat, dans l'ordre
 * des identifiants : la copie pouvait capter les liens de l'original, ceux de
 * la chaîne perpétuelle compris (identifiant et slug `chaine-perpetuelle`).
 */

type Doc = { id: string; data: () => Record<string, unknown> };
let docs: Doc[] = [];

vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: () => Promise.resolve({ empty: docs.length === 0, docs }),
  Timestamp: { now: vi.fn() },
  FirestoreError: class extends Error {},
}));

const { firestoreService } = await import("../services/firestoreService");

const at = (iso: string) => ({ toDate: () => new Date(iso) });
const session = (id: string, createdAt: string): Doc => ({
  id,
  data: () => ({ name: id, slug: "shabbat-chalom", createdAt: at(createdAt) }),
});

beforeEach(() => {
  docs = [];
});

describe("deux sessions sous le même slug", () => {
  it("le lien reste à la plus ancienne, quel que soit l'ordre des identifiants", async () => {
    // « AAA » passe avant « zzz » dans l'ordre de Firestore.
    docs = [
      session("AAA-copie", "2026-10-01T00:00:00Z"),
      session("zzz-original", "2026-03-01T00:00:00Z"),
    ];

    expect((await firestoreService.getSessionBySlug("shabbat-chalom"))?.id).toBe("zzz-original");
  });

  it("le lien de la chaîne perpétuelle reste à la chaîne", async () => {
    const copie = {
      id: "AAA-copie",
      data: () => ({ slug: "chaine-perpetuelle", createdAt: at("2020-01-01T00:00:00Z") }),
    };
    const chaine = {
      id: "chaine-perpetuelle",
      data: () => ({ slug: "chaine-perpetuelle", createdAt: at("2026-09-01T00:00:00Z") }),
    };
    docs = [copie, chaine];

    expect((await firestoreService.getSessionBySlug("chaine-perpetuelle"))?.id).toBe(
      "chaine-perpetuelle",
    );
  });

  it("un slug seul ou absent se résout comme avant", async () => {
    docs = [session("unique", "2026-03-01T00:00:00Z")];
    expect((await firestoreService.getSessionBySlug("shabbat-chalom"))?.id).toBe("unique");
    docs = [];
    expect(await firestoreService.getSessionBySlug("inconnu")).toBeNull();
  });
});
