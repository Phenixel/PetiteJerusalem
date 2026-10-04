import { describe, expect, it, vi } from "vitest";

/**
 * Un compte créé par email sans « Nom affiché » (champ facultatif) prenait
 * son adresse pour nom. Ce nom part tel quel dans les données publiques :
 * créateur d'une chaîne (« Créée par jean@x.fr »), nom d'une réservation,
 * lisibles par tous. Le nom ne contient plus l'adresse entière.
 */

const { currentUser } = vi.hoisted(() => ({
  currentUser: { value: null as Record<string, unknown> | null },
}));

vi.mock("firebase/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/auth")>()),
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    callback(currentUser.value);
    return () => {};
  },
}));
vi.mock("../firebase/core", () => ({ auth: {}, googleAuthProvider: {} }));
vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn(), identify: vi.fn(), reset: vi.fn() },
}));

describe("le nom d'un compte sans nom affiché", () => {
  it("n'est pas l'adresse email", async () => {
    const { authService } = await import("../services/authService");

    currentUser.value = { uid: "u1", displayName: null, email: "jean.dupont@exemple.fr" };
    const user = await authService.getCurrentUser();
    expect(user?.name).toBe("jean.dupont");
    expect(user?.name).not.toContain("@");
    expect(user?.email).toBe("jean.dupont@exemple.fr");

    // Le nom affiché, quand il existe, reste le nom.
    currentUser.value = { uid: "u2", displayName: "Sarah", email: "s@exemple.fr" };
    expect((await authService.getCurrentUser())?.name).toBe("Sarah");

    // Ni nom ni email : vide, la vue dit « Utilisateur » dans sa langue.
    currentUser.value = { uid: "u3", displayName: null, email: null };
    expect((await authService.getCurrentUser())?.name).toBe("");
  });
});
