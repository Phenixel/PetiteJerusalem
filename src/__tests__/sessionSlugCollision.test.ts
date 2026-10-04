import { beforeEach, describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase/firestore";
import { slugOwnerIndex } from "../../functions/src/sessionSlug";

/**
 * Le slug compose le lien de partage d'une chaîne (`/partage/session/<slug>`).
 * L'app en génère un unique, mais rien n'empêche un client d'écrire une
 * session avec le slug d'une autre : les règles ne voient pas les autres
 * documents. getSessionBySlug rendait alors le premier résultat, dans l'ordre
 * des identifiants : la copie pouvait capter les liens de l'original, ceux de
 * la chaîne perpétuelle compris (identifiant et slug `chaine-perpetuelle`).
 *
 * La chaîne se reconnaît à son drapeau `perpetual`, réservé à l'admin par les
 * règles, et non à son identifiant : celui-ci se choisit à la création, une
 * copie nommée comme le slug aurait pris le lien de n'importe quelle session.
 * L'aperçu social (functions/src/sessionSlug.ts) suit la même règle.
 */

type Doc = { id: string; data: () => Record<string, unknown> };
let docs: Doc[] = [];

vi.mock("../firebase/firestore", () => ({ db: {} }));
// Le vrai Timestamp : firestoreService le reconnaît par `instanceof`.
vi.mock("firebase/firestore", async (importOriginal) => ({
  Timestamp: (await importOriginal<typeof import("firebase/firestore")>()).Timestamp,
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: () => Promise.resolve({ empty: docs.length === 0, docs }),
  FirestoreError: class extends Error {},
}));

const { firestoreService } = await import("../services/firestoreService");

const at = (iso: string) => Timestamp.fromDate(new Date(iso));
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

  it("le lien de la chaîne perpétuelle reste à la chaîne, même face à une copie antidatée", async () => {
    const copie = {
      id: "AAA-copie",
      data: () => ({ slug: "chaine-perpetuelle", createdAt: at("2020-01-01T00:00:00Z") }),
    };
    const chaine = {
      id: "chaine-perpetuelle",
      data: () => ({
        slug: "chaine-perpetuelle",
        perpetual: true,
        createdAt: at("2026-09-01T00:00:00Z"),
      }),
    };
    docs = [copie, chaine];

    expect((await firestoreService.getSessionBySlug("chaine-perpetuelle"))?.id).toBe(
      "chaine-perpetuelle",
    );
  });

  it("une copie nommée comme le slug ne prend pas le lien de l'original", async () => {
    // L'identifiant d'un document se choisit à la création : ce n'est pas lui
    // qui départage.
    docs = [
      session("shabbat-chalom", "2026-10-01T00:00:00Z"),
      session("zzz-original", "2026-03-01T00:00:00Z"),
    ];

    expect((await firestoreService.getSessionBySlug("shabbat-chalom"))?.id).toBe("zzz-original");
  });

  it("un slug seul ou absent se résout comme avant", async () => {
    docs = [session("unique", "2026-03-01T00:00:00Z")];
    expect((await firestoreService.getSessionBySlug("shabbat-chalom"))?.id).toBe("unique");
    docs = [];
    expect(await firestoreService.getSessionBySlug("inconnu")).toBeNull();
  });
});

describe("l'aperçu social, sous le même slug", () => {
  const stamp = (iso: string) => ({ toMillis: () => new Date(iso).getTime() });

  it("revient à la chaîne perpétuelle, sinon à la plus ancienne", () => {
    expect(
      slugOwnerIndex([
        { createdAt: stamp("2020-01-01T00:00:00Z") },
        { perpetual: true, createdAt: stamp("2026-09-01T00:00:00Z") },
      ]),
    ).toBe(1);
    expect(
      slugOwnerIndex([
        { createdAt: stamp("2026-10-01T00:00:00Z") },
        { createdAt: stamp("2026-03-01T00:00:00Z") },
      ]),
    ).toBe(1);
  });

  it("une date illisible passe après les autres, un drapeau imité ne compte pas", () => {
    expect(
      slugOwnerIndex([
        { createdAt: "hier" },
        { perpetual: "true", createdAt: stamp("2026-10-01T00:00:00Z") },
        { createdAt: stamp("2026-03-01T00:00:00Z") },
      ]),
    ).toBe(2);
    expect(slugOwnerIndex([{}])).toBe(0);
  });
});
