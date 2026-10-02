import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import fr from "../locales/fr";

/**
 * Supprimer son compte. Firebase exige une connexion de moins de cinq minutes.
 *
 * - Un compte à mot de passe n'avait aucun moyen de se ré-authentifier depuis
 *   l'écran : passé cinq minutes, la suppression échouait, il fallait se
 *   déconnecter et se reconnecter. Le mot de passe se saisit désormais dans
 *   la confirmation.
 * - La connexion récente se vérifiait avec l'horloge de l'appareil. En retard,
 *   elle laissait passer une connexion trop ancienne : préférences et
 *   marque-pages étaient purgés, puis Firebase refusait la suppression, et le
 *   compte restait, vide. Le contrôle compare deux instants du serveur.
 */

const { authMock, reauthenticateWithCredential, deleteUser, deletePreferences } = vi.hoisted(
  () => ({
    authMock: { currentUser: null as unknown },
    reauthenticateWithCredential: vi.fn(() => Promise.resolve()),
    deleteUser: vi.fn(() => Promise.resolve()),
    deletePreferences: vi.fn(() => Promise.resolve()),
  }),
);

vi.mock("../firebase/core", () => ({ app: {}, auth: authMock, googleAuthProvider: {} }));
vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  Timestamp: { now: vi.fn() },
}));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(() => () => {}),
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
  reauthenticateWithCredential,
  deleteUser,
  EmailAuthProvider: { credential: (email: string, password: string) => ({ email, password }) },
  GoogleAuthProvider: { credential: vi.fn() },
  OAuthProvider: class {},
}));
vi.mock("@capacitor-firebase/authentication", () => ({
  FirebaseAuthentication: { signInWithGoogle: vi.fn(), signInWithApple: vi.fn(), signOut: vi.fn() },
}));
vi.mock("../services/userPreferencesService", () => ({
  userPreferencesService: { deletePreferences },
  clearPreferencesCache: vi.fn(),
}));
vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn(), captureException: vi.fn(), reset: vi.fn() },
}));

const { authService } = await import("../services/authService");
const { default: SecuritySettings } = await import("../views/profilePage/SecuritySettings.vue");

const MINUTE = 60_000;

/** Un utilisateur dont la connexion date de `ageMs` selon le serveur. */
function userSignedIn(ageMs: number, providers = ["password"]) {
  const issued = Date.UTC(2026, 9, 2, 12, 0, 0);
  return {
    uid: "u1",
    email: "sarah@mail.fr",
    providerData: providers.map((providerId) => ({ providerId })),
    getIdTokenResult: () =>
      Promise.resolve({
        authTime: new Date(issued - ageMs).toUTCString(),
        issuedAtTime: new Date(issued).toUTCString(),
      }),
  };
}

beforeEach(() => {
  reauthenticateWithCredential.mockClear();
  deleteUser.mockClear();
  deletePreferences.mockClear();
  vi.useRealTimers();
});

describe("authService.deleteAccount et l'horloge de l'appareil", () => {
  it("refuse une connexion ancienne même si l'appareil retarde, sans rien purger", async () => {
    authMock.currentUser = userSignedIn(10 * MINUTE);
    // L'appareil croit qu'il ne s'est écoulé qu'une minute depuis la connexion.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.UTC(2026, 9, 2, 12, 0, 0) - 9 * MINUTE);

    await expect(authService.deleteAccount()).rejects.toMatchObject({
      code: "auth/requires-recent-login",
    });
    expect(deletePreferences).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("accepte une connexion récente même si l'appareil avance", async () => {
    authMock.currentUser = userSignedIn(1 * MINUTE);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.UTC(2026, 9, 2, 12, 0, 0) + 30 * MINUTE);

    await authService.deleteAccount();
    expect(deleteUser).toHaveBeenCalledTimes(1);
  });

  it("repart anonyme dans le suivi, comme à la déconnexion", async () => {
    authMock.currentUser = userSignedIn(1 * MINUTE);
    const { analyticsService } = await import("../services/analyticsService");
    vi.mocked(analyticsService.reset).mockClear();

    await authService.deleteAccount();
    expect(analyticsService.reset).toHaveBeenCalledTimes(1);
  });
});

async function flush() {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await nextTick();
  }
}

async function mountSecurity() {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:rest(.*)", component: { render: () => null } }],
  });
  await router.push("/profil");
  await router.isReady();
  const host = document.createElement("div");
  document.body.appendChild(host);
  createApp({ render: () => h(SecuritySettings) })
    .use(i18n)
    .use(router)
    .mount(host);
  await flush();
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
  return { host, button };
}

describe("supprimer un compte à mot de passe", () => {
  it("demande le mot de passe et s'en sert pour se ré-authentifier", async () => {
    authMock.currentUser = userSignedIn(30 * MINUTE);
    // Après ré-authentification, la connexion est récente.
    reauthenticateWithCredential.mockImplementationOnce(() => {
      authMock.currentUser = { ...userSignedIn(0), email: "sarah@mail.fr" };
      return Promise.resolve();
    });
    const { host, button } = await mountSecurity();

    button(fr.security.deleteMyAccount)!.click();
    await flush();
    const confirm = button(fr.security.confirmDeletion)!;
    const field = host.querySelector<HTMLInputElement>("#delete-account-password");
    expect(field).not.toBeNull();
    expect(confirm.disabled).toBe(true);

    field!.value = "secret";
    field!.dispatchEvent(new Event("input"));
    await flush();
    expect(confirm.disabled).toBe(false);
    confirm.click();
    await flush();

    expect(reauthenticateWithCredential).toHaveBeenCalledWith(expect.anything(), {
      email: "sarah@mail.fr",
      password: "secret",
    });
  });

  it("dit que le mot de passe est faux", async () => {
    authMock.currentUser = userSignedIn(30 * MINUTE);
    reauthenticateWithCredential.mockImplementationOnce(() =>
      Promise.reject(Object.assign(new Error("Firebase"), { code: "auth/invalid-credential" })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { host, button } = await mountSecurity();

    button(fr.security.deleteMyAccount)!.click();
    await flush();
    const field = host.querySelector<HTMLInputElement>("#delete-account-password")!;
    field.value = "faux";
    field.dispatchEvent(new Event("input"));
    await flush();
    button(fr.security.confirmDeletion)!.click();
    await flush();

    expect(host.textContent).toContain(fr.security.wrongPassword);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
