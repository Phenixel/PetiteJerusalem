import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import fr from "../locales/fr";
import LoginView from "../views/loginView.vue";

/**
 * L'écran de connexion devant un échec par email : un message en français à
 * la place de l'erreur brute de Firebase, la sortie qui va avec (créer le
 * compte, s'y connecter, le bouton de la dernière méthode), et « Dernière
 * utilisation » sur le bouton de la méthode employée la dernière fois ici.
 */

const { capture, signInWithEmail, signUpWithEmail, signInWithGooglePopup } = vi.hoisted(() => ({
  capture: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  signInWithGooglePopup: vi.fn(),
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
});

describe("Un échec de connexion par email", () => {
  it("se dit en français, sans l'erreur brute, et propose de créer le compte", async () => {
    signInWithEmail.mockRejectedValue(firebaseError("auth/invalid-credential"));
    const view = await mount();
    await view.submit("a@b.fr", "secret");

    expect(view.text()).toContain(fr.login.errors.invalidCredential);
    expect(view.text()).not.toContain("auth/invalid-credential");
    expect(capture).toHaveBeenCalledWith(
      "email_auth_failed",
      expect.objectContaining({ reason: "auth/invalid-credential", last_method: null }),
    );

    view.button(fr.login.help.signup)!.click();
    await flush();
    // Le formulaire d'inscription, l'adresse gardée.
    expect(view.host.querySelector("#confirmPassword")).not.toBeNull();
    expect(view.host.querySelector<HTMLInputElement>("#email")!.value).toBe("a@b.fr");
    expect(capture).toHaveBeenCalledWith("login_help_clicked", {
      help: "signup",
      reason: "auth/invalid-credential",
    });
  });

  it("rappelle Google quand c'est ainsi qu'on s'est connecté ici la dernière fois", async () => {
    localStorage.setItem("pj_last_auth_method", "google");
    signInWithEmail.mockRejectedValue(firebaseError("auth/invalid-credential"));
    signInWithGooglePopup.mockReturnValue(new Promise(() => {}));
    const view = await mount();
    await view.submit("a@b.fr", "secret");

    expect(view.text()).toContain(fr.login.errors.invalidCredentialGoogle);
    // Deux boutons Google : celui du haut, et la sortie sous l'erreur.
    const googles = [...view.host.querySelectorAll("button")].filter(
      (b) => b.textContent?.trim() === fr.login.signInWithGoogle,
    );
    expect(googles).toHaveLength(2);
    googles[1].click();
    await flush();
    expect(signInWithGooglePopup).toHaveBeenCalledTimes(1);
  });

  it("propose de se connecter quand l'adresse est déjà inscrite", async () => {
    signUpWithEmail.mockRejectedValue(firebaseError("auth/email-already-in-use"));
    const view = await mount("?mode=signup");
    await view.submit("a@b.fr", "secret", "secret");

    expect(view.text()).toContain(fr.login.errors.emailInUse);
    view.button(fr.login.help.login)!.click();
    await flush();
    // Le mode connexion : le bouton d'envoi ne dit plus « S'inscrire ».
    expect(view.button(fr.login.register)).toBeUndefined();
    expect(view.host.querySelector<HTMLInputElement>("#email")!.value).toBe("a@b.fr");
  });

  it("compte deux mots de passe différents sans appeler Firebase", async () => {
    const view = await mount("?mode=signup");
    await view.submit("a@b.fr", "secret", "autre");

    expect(signUpWithEmail).not.toHaveBeenCalled();
    expect(view.text()).toContain(fr.login.passwordsDoNotMatch);
    expect(capture).toHaveBeenCalledWith(
      "email_auth_failed",
      expect.objectContaining({ reason: "password_mismatch" }),
    );
  });
});

describe("« Dernière utilisation »", () => {
  it("se pose sur le bouton de la dernière méthode, et seulement là", async () => {
    localStorage.setItem("pj_last_auth_method", "google");
    const view = await mount();
    const badges = [...view.host.querySelectorAll("span")].filter(
      (span) => span.textContent?.trim() === fr.login.lastUsed,
    );
    expect(badges).toHaveLength(1);
    // Hors du bouton : son libellé reste celui de la commande.
    expect(view.button(fr.login.signInWithGoogle)).toBeDefined();
    expect(capture).toHaveBeenCalledWith(
      "login_viewed",
      expect.objectContaining({ reason: "direct", last_method: "google" }),
    );
  });

  it("ne s'affiche pas sur un appareil qui ne s'est jamais connecté", async () => {
    const view = await mount("?redirect=/bibliotheque/lecture-du-jour");
    expect(view.text()).not.toContain(fr.login.lastUsed);
    expect(capture).toHaveBeenCalledWith(
      "login_viewed",
      expect.objectContaining({ reason: "daily_reading", last_method: null }),
    );
  });
});
