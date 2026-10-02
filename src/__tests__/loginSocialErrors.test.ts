import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import fr from "../locales/fr";
import LoginView from "../views/loginView.vue";

/**
 * L'écran de connexion devant un échec Google ou Apple : ce que l'appareil ne
 * sait pas faire s'affiche et se compte dans le funnel, sans remonter à
 * l'Error tracking ; toute autre panne y remonte. Et une feuille native
 * ouverte ne s'en superpose pas une seconde.
 */

const { capture, captureException, signInWithGooglePopup, signInWithApple } = vi.hoisted(() => ({
  capture: vi.fn(),
  captureException: vi.fn(),
  signInWithGooglePopup: vi.fn(),
  signInWithApple: vi.fn(),
}));

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture, captureException },
}));
vi.mock("../services/authService", () => ({
  authService: {
    getCurrentUser: async () => null,
    signInWithGooglePopup,
    signInWithApple,
  },
}));
vi.mock("../services/reservationService", () => ({
  reservationService: { migrateGuestReservations: async () => {} },
}));
vi.mock("../services/guestService", () => ({
  guestService: { getLocalGuestId: () => "guest" },
}));
// Le bouton Apple ne s'affiche que sur l'app iOS.
vi.mock("@capacitor/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@capacitor/core")>();
  return { ...actual, Capacitor: { ...actual.Capacitor, getPlatform: () => "ios" } };
});

const SAFARI_UNAVAILABLE = new Error("Unable to open Safari.");
const APPLE_UNAVAILABLE = new Error(
  "The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1000.)",
);

async function mount() {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:rest(.*)", component: { render: () => null } }],
  });
  await router.push("/login");
  await router.isReady();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(LoginView) });
  app.use(i18n);
  app.use(router);
  app.mount(host);
  await flush();

  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label)!;
  return {
    google: () => button(fr.login.signInWithGoogle),
    apple: () => button(fr.login.signInWithApple),
    // Les blancs ASCII seuls : les espaces insécables des messages restent.
    text: () => (host.textContent ?? "").replace(/[ \t\n\r]+/g, " "),
  };
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
    await nextTick();
  }
}

beforeEach(() => {
  document.body.innerHTML = "";
  capture.mockReset();
  captureException.mockReset();
  signInWithGooglePopup.mockReset();
  signInWithApple.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Un échec de connexion Google ou Apple", () => {
  it("n'envoie pas Safari hors d'atteinte à l'Error tracking", async () => {
    signInWithGooglePopup.mockRejectedValue(SAFARI_UNAVAILABLE);
    const view = await mount();
    view.google().click();
    await flush();

    expect(captureException).not.toHaveBeenCalled();
    expect(capture).toHaveBeenCalledWith(
      "google_signin_failed",
      expect.objectContaining({ reason: "unavailable" }),
    );
    expect(view.text()).toContain(fr.login.authBrowserUnavailable);
  });

  it("n'envoie pas la feuille Apple imprésentable à l'Error tracking", async () => {
    signInWithApple.mockRejectedValue(APPLE_UNAVAILABLE);
    const view = await mount();
    view.apple().click();
    await flush();

    expect(captureException).not.toHaveBeenCalled();
    expect(capture).toHaveBeenCalledWith(
      "apple_signin_failed",
      expect.objectContaining({ reason: "unavailable" }),
    );
    expect(view.text()).toContain(fr.login.appleSignInUnavailable);
  });

  it("envoie toute autre panne à l'Error tracking", async () => {
    const failure = Object.assign(new Error("Firebase: network"), {
      code: "auth/network-request-failed",
    });
    signInWithGooglePopup.mockRejectedValue(failure);
    const view = await mount();
    view.google().click();
    await flush();

    expect(captureException).toHaveBeenCalledWith(failure, { auth_flow: "google" });
    expect(capture).toHaveBeenCalledWith(
      "google_signin_failed",
      expect.objectContaining({ reason: "error" }),
    );
    expect(view.text()).toContain(fr.login.googleError);
  });

  it("ne remonte pas la panne d'un fournisseur sous la règle de l'autre", async () => {
    // Le code Apple 1000 sur le flux Google n'est pas une limite connue de
    // l'appareil : il reste une panne à examiner.
    signInWithGooglePopup.mockRejectedValue(APPLE_UNAVAILABLE);
    const view = await mount();
    view.google().click();
    await flush();

    expect(captureException).toHaveBeenCalledTimes(1);
  });
});

describe("Une feuille de connexion ouverte", () => {
  it("ne laisse pas en ouvrir une seconde", async () => {
    let fail!: (e: unknown) => void;
    signInWithGooglePopup.mockReturnValue(new Promise((_, reject) => (fail = reject)));
    const view = await mount();

    view.google().click();
    await flush();
    expect(view.google().disabled).toBe(true);
    expect(view.apple().disabled).toBe(true);
    view.google().click();
    view.apple().click();
    await flush();
    expect(signInWithGooglePopup).toHaveBeenCalledTimes(1);
    expect(signInWithApple).not.toHaveBeenCalled();

    // Refermée, la feuille rend la main : on peut réessayer, ou changer de
    // fournisseur.
    fail(new Error("Something went wrong"));
    await flush();
    expect(view.google().disabled).toBe(false);
    expect(view.apple().disabled).toBe(false);
  });
});
