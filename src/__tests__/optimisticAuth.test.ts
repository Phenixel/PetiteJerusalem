import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Session optimiste au lancement (voir LAST_USER_KEY dans authService).
 *
 * Au démarrage, Firebase relit sa persistance locale avant de rendre son
 * premier verdict : pendant ce temps, l'app se croyait déconnectée puis
 * basculait d'un coup (bandeau, accueil, thème). Ce qui doit tenir :
 * - avant le verdict, onAuthChanged sert immédiatement le dernier compte
 *   connu, gardé sur l'appareil ;
 * - le verdict reprend ensuite la main : il confirme, ou infirme (une
 *   déconnexion purge le compte gardé) ;
 * - après le premier verdict, plus aucune émission optimiste ;
 * - le compte gardé suit les connexions, pour le prochain lancement.
 */

const { listeners, authMock } = vi.hoisted(() => ({
  listeners: [] as Array<
    (user: { uid: string; displayName: string | null; email: string | null } | null) => void
  >,
  authMock: { currentUser: null },
}));

vi.mock("../firebase/core", () => ({ app: {}, auth: authMock, googleAuthProvider: {} }));

// La modération tire Firestore : inutile de l'initialiser ici.
vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  Timestamp: { now: vi.fn() },
}));

vi.mock("firebase/auth", () => ({
  // Chaque abonné est gardé de côté : les tests rendent le verdict eux-mêmes.
  onAuthStateChanged: vi.fn(
    (
      _auth: unknown,
      cb: (user: { uid: string; displayName: string | null; email: string | null } | null) => void,
    ) => {
      listeners.push(cb);
      return () => {
        const index = listeners.indexOf(cb);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
  ),
  updateProfile: vi.fn(),
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

const LAST_USER_KEY = "pj-last-user";
const DAVID = { id: "u1", name: "David", email: "david@exemple.fr" };

/** Rend le verdict de Firebase à tous les abonnés (le service compris). */
function fireAuthVerdict(
  user: { uid: string; displayName: string | null; email: string | null } | null,
) {
  [...listeners].forEach((cb) => cb(user));
}

/** Recharge authService : un démarrage d'app à neuf, abonnement du service compris. */
async function freshAuthService() {
  vi.resetModules();
  listeners.length = 0;
  return (await import("../services/authService")).authService;
}

describe("session optimiste au lancement", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("sert le dernier compte connu avant le verdict de Firebase", async () => {
    localStorage.setItem(LAST_USER_KEY, JSON.stringify(DAVID));
    const authService = await freshAuthService();

    const seen: unknown[] = [];
    authService.onAuthChanged((user) => seen.push(user));

    // Synchrone : aucun verdict rendu, et l'abonné connaît déjà le compte.
    expect(seen).toEqual([DAVID]);
  });

  it("laisse le verdict confirmer, puis une déconnexion purger le compte gardé", async () => {
    localStorage.setItem(LAST_USER_KEY, JSON.stringify(DAVID));
    const authService = await freshAuthService();

    const seen: unknown[] = [];
    authService.onAuthChanged((user) => seen.push(user));

    fireAuthVerdict({ uid: "u1", displayName: "David", email: "david@exemple.fr" });
    expect(seen).toEqual([DAVID, DAVID]);

    // Session révoquée entre-temps : l'interface bascule, le cache est purgé.
    fireAuthVerdict(null);
    expect(seen).toEqual([DAVID, DAVID, null]);
    expect(localStorage.getItem(LAST_USER_KEY)).toBeNull();
  });

  it("n'émet rien sans compte gardé : l'app attend le verdict, comme avant", async () => {
    const authService = await freshAuthService();

    const seen: unknown[] = [];
    authService.onAuthChanged((user) => seen.push(user));

    expect(seen).toEqual([]);
  });

  it("cesse l'optimisme dès le premier verdict rendu", async () => {
    localStorage.setItem(LAST_USER_KEY, JSON.stringify(DAVID));
    const authService = await freshAuthService();
    fireAuthVerdict({ uid: "u1", displayName: "David", email: "david@exemple.fr" });

    // Abonné tardif : c'est Firebase qui le servira (auth fait foi), pas le cache.
    const seen: unknown[] = [];
    authService.onAuthChanged((user) => seen.push(user));
    expect(seen).toEqual([]);
  });

  it("mémorise le compte rendu par le verdict, pour le prochain lancement", async () => {
    await freshAuthService();

    fireAuthVerdict({ uid: "u2", displayName: "Ruth", email: "ruth@exemple.fr" });

    expect(JSON.parse(localStorage.getItem(LAST_USER_KEY) ?? "null")).toEqual({
      id: "u2",
      name: "Ruth",
      email: "ruth@exemple.fr",
    });
  });

  it("ignore un compte gardé illisible", async () => {
    localStorage.setItem(LAST_USER_KEY, "{pas du json");
    const authService = await freshAuthService();

    const seen: unknown[] = [];
    authService.onAuthChanged((user) => seen.push(user));
    expect(seen).toEqual([]);
  });
});
