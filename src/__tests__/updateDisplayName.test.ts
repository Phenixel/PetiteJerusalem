import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModerationError } from "../services/moderationService";

/**
 * Changement du nom d'affichage depuis le profil.
 *
 * Ce qui doit tenir :
 * - le nom part vraiment chez Firebase (la page se contentait de le changer
 *   dans son état local, il revenait au rechargement) ;
 * - les abonnés d'onAuthChanged sont rejoués, sinon le bandeau et le menu du
 *   compte garderaient l'ancien nom : Firebase ne rejoue pas
 *   onAuthStateChanged après un updateProfile ;
 * - le nom est public, il passe donc par la modération, comme à l'inscription.
 */

const { authMock, updateProfile } = vi.hoisted(() => ({
  authMock: { currentUser: null as { uid: string; displayName: string; email: string } | null },
  updateProfile: vi.fn((user: { displayName: string }, profile: { displayName: string }) => {
    // Firebase met à jour l'utilisateur local une fois le serveur d'accord.
    user.displayName = profile.displayName;
    return Promise.resolve();
  }),
}));

vi.mock("../firebase/core", () => ({ app: {}, auth: authMock, googleAuthProvider: {} }));

// La modération tire Firestore : inutile de l'initialiser pour vérifier un nom.
vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  Timestamp: { now: vi.fn() },
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(() => () => {}),
  updateProfile,
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithRedirect: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithCredential: vi.fn(),
  reauthenticateWithPopup: vi.fn(),
  getRedirectResult: vi.fn(),
  signOut: vi.fn(),
  updatePassword: vi.fn(),
  reauthenticateWithCredential: vi.fn(),
  deleteUser: vi.fn(),
  EmailAuthProvider: { credential: vi.fn() },
  GoogleAuthProvider: { credential: vi.fn() },
  OAuthProvider: class {},
}));

vi.mock("@capacitor-firebase/authentication", () => ({
  FirebaseAuthentication: {
    signInWithGoogle: vi.fn(),
    signInWithApple: vi.fn(),
    signOut: vi.fn(),
  },
}));

const { authService } = await import("../services/authService");

describe("authService.updateDisplayName", () => {
  beforeEach(() => {
    updateProfile.mockClear();
    authMock.currentUser = { uid: "u1", displayName: "Ancien nom", email: "david@exemple.fr" };
  });

  it("enregistre le nouveau nom chez Firebase", async () => {
    const user = await authService.updateDisplayName("David Cohen");

    expect(updateProfile).toHaveBeenCalledWith(authMock.currentUser, {
      displayName: "David Cohen",
    });
    expect(user).toEqual({ id: "u1", name: "David Cohen", email: "david@exemple.fr" });
  });

  it("enlève les espaces autour du nom", async () => {
    await authService.updateDisplayName("  David Cohen  ");

    expect(updateProfile).toHaveBeenCalledWith(authMock.currentUser, {
      displayName: "David Cohen",
    });
  });

  it("prévient les abonnés d'onAuthChanged, que Firebase ne rejoue pas", async () => {
    const seen: (string | null)[] = [];
    const unsubscribe = authService.onAuthChanged((user) => seen.push(user?.name ?? null));

    await authService.updateDisplayName("David Cohen");
    expect(seen).toEqual(["David Cohen"]);

    // Désabonné : plus rien ne lui parvient.
    unsubscribe();
    await authService.updateDisplayName("Autre nom");
    expect(seen).toEqual(["David Cohen"]);
  });

  it("refuse un nom vide sans rien envoyer", async () => {
    await expect(authService.updateDisplayName("   ")).rejects.toThrow();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("refuse un nom que la modération rejette", async () => {
    await expect(authService.updateDisplayName("gros con")).rejects.toBeInstanceOf(ModerationError);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("refuse quand personne n'est connecté", async () => {
    authMock.currentUser = null;
    await expect(authService.updateDisplayName("David Cohen")).rejects.toThrow();
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
