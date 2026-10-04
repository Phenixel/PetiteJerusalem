import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import fr from "../locales/fr";
import LoginView from "../views/loginView.vue";
import {
  describePasswordResetError,
  isPasswordResetSilent,
  PASSWORD_RESET_ERROR_KEYS,
} from "../services/authErrors";

/**
 * « Mot de passe oublié », depuis l'écran de connexion : l'email de
 * réinitialisation de Firebase Auth, et un message qui ne dit pas si
 * l'adresse a un compte. Sans lui, l'aide tournait en rond : un mot de passe
 * refusé proposait de créer un compte, l'adresse déjà inscrite de s'y
 * connecter. Ni l'adresse ni l'existence du compte ne partent vers PostHog.
 */

const { capture, signInWithEmail, signUpWithEmail, signInWithGooglePopup, sendPasswordReset } =
  vi.hoisted(() => ({
    capture: vi.fn(),
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    signInWithGooglePopup: vi.fn(),
    sendPasswordReset: vi.fn(),
  }));

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture, captureException: vi.fn() },
}));
vi.mock("../services/authService", () => ({
  authService: {
    getCurrentUser: async () => null,
    signInWithEmail,
    signUpWithEmail,
    signInWithGooglePopup,
    signInWithApple: vi.fn(),
    sendPasswordReset,
  },
}));
vi.mock("../services/reservationService", () => ({
  reservationService: { migrateGuestReservations: async () => {} },
}));
vi.mock("../services/guestService", () => ({
  guestService: { getLocalGuestId: () => "guest" },
}));
vi.mock("@capacitor/preferences", () => ({
  Preferences: { get: () => Promise.resolve({ value: null }), set: () => Promise.resolve() },
}));

const firebaseError = (code: string) =>
  Object.assign(new Error(`Firebase: Error (${code}).`), { code });

async function mount(query = "") {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:rest(.*)", component: { render: () => null } }],
  });
  await router.push(`/login${query}`);
  await router.isReady();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(LoginView) });
  app.use(i18n);
  app.use(router);
  app.mount(host);
  await flush();

  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
  const fill = (id: string, value: string) => {
    const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event("input"));
  };
  return {
    host,
    button,
    async submit(email: string, password: string, confirm?: string) {
      fill("email", email);
      fill("password", password);
      if (confirm !== undefined) fill("confirmPassword", confirm);
      await nextTick();
      host.querySelector("form")!.dispatchEvent(new Event("submit"));
      await flush();
    },
    // Les blancs ASCII seuls : les espaces insécables des messages restent.
    text: () => (host.textContent ?? "").replace(/[ \t\n\r]+/g, " "),
  };
}

async function flush() {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
    await nextTick();
  }
}

beforeEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  capture.mockReset();
  signInWithEmail.mockReset();
  signUpWithEmail.mockReset();
  signInWithGooglePopup.mockReset();
  sendPasswordReset.mockReset();
});

/** La phrase telle qu'elle s'affiche, sans les blancs ASCII de mise en page. */
const said = (text: string) => text.replace(/[ \t\n\r]+/g, " ");

async function openReset(view: Awaited<ReturnType<typeof mount>>, email: string) {
  const input = view.host.querySelector<HTMLInputElement>("#email")!;
  input.value = email;
  input.dispatchEvent(new Event("input"));
  view.button(fr.login.reset.link)!.click();
  await flush();
}

async function send(view: Awaited<ReturnType<typeof mount>>) {
  view.host.querySelector("form")!.dispatchEvent(new Event("submit"));
  await flush();
}

describe("Mot de passe oublié", () => {
  it("s'ouvre sous le mot de passe, garde l'adresse, et envoie l'email dans la langue de l'écran", async () => {
    sendPasswordReset.mockResolvedValue(undefined);
    const view = await mount();
    await openReset(view, "a@b.fr");

    expect(view.host.querySelector("#password")).toBeNull();
    expect(view.host.querySelector<HTMLInputElement>("#email")!.value).toBe("a@b.fr");
    expect(view.text()).toContain(said(fr.login.reset.intro));

    await send(view);
    expect(sendPasswordReset).toHaveBeenCalledWith("a@b.fr", "fr");
    expect(view.text()).toContain(said(fr.login.reset.sent.replace("{email}", "a@b.fr")));
    expect(capture).toHaveBeenCalledWith("password_reset_requested", {
      outcome: "sent",
      reason: null,
    });

    view.button(fr.login.reset.back)!.click();
    await flush();
    expect(view.host.querySelector("#password")).not.toBeNull();
  });

  it("sort de la boucle d'un mot de passe refusé, et le compte", async () => {
    signInWithEmail.mockRejectedValue(firebaseError("auth/invalid-credential"));
    const view = await mount();
    await view.submit("a@b.fr", "faux");
    expect(view.button(fr.login.reset.link)).toBeDefined();

    view.button(fr.login.reset.link)!.click();
    await flush();
    expect(capture).toHaveBeenCalledWith("password_reset_opened", {
      after_error: "auth/invalid-credential",
      last_method: null,
    });
    // L'erreur de la connexion ne reste pas sous la fenêtre de réinitialisation.
    expect(view.text()).not.toContain(said(fr.login.errors.invalidCredential));
  });

  it("dit l'échec sans dire si l'adresse a un compte", async () => {
    sendPasswordReset.mockRejectedValue(firebaseError("auth/too-many-requests"));
    const view = await mount();
    await openReset(view, "a@b.fr");
    await send(view);
    expect(view.text()).toContain(said(fr.login.errors.tooManyRequests));
    expect(capture).toHaveBeenCalledWith("password_reset_requested", {
      outcome: "failed",
      reason: "auth/too-many-requests",
    });
  });

  it("n'envoie jamais l'adresse vers PostHog", async () => {
    sendPasswordReset.mockResolvedValue(undefined);
    const view = await mount();
    await openReset(view, "secret@exemple.fr");
    await send(view);
    expect(JSON.stringify(capture.mock.calls)).not.toContain("secret@exemple.fr");
  });
});

describe("les erreurs de la réinitialisation", () => {
  it("taisent ce qui trahirait l'existence d'un compte", () => {
    expect(isPasswordResetSilent("auth/user-not-found")).toBe(true);
    expect(isPasswordResetSilent("auth/invalid-credential")).toBe(true);
    expect(isPasswordResetSilent("auth/too-many-requests")).toBe(false);
    expect(isPasswordResetSilent(null)).toBe(false);
  });

  it("rendent des clés qui existent dans la locale française", () => {
    type Messages = { [key: string]: string | Messages };
    const lookup = (path: string) =>
      path.split(".").reduce<unknown>((node, key) => (node as Messages)?.[key], fr as Messages);
    expect(PASSWORD_RESET_ERROR_KEYS.filter((key) => typeof lookup(key) !== "string")).toEqual([]);
    expect(describePasswordResetError("auth/invalid-email")).toBe("login.errors.invalidEmail");
    expect(describePasswordResetError("auth/internal-error")).toBe("login.reset.error");
  });

  it("ont leurs textes dans les trois langues", async () => {
    const [{ default: en }, { default: he }] = await Promise.all([
      import("../locales/en"),
      import("../locales/he"),
    ]);
    for (const locale of [fr, en, he]) {
      for (const key of Object.keys(fr.login.reset)) {
        expect((locale.login.reset as Record<string, string>)[key]).toBeTruthy();
      }
    }
  });
});
