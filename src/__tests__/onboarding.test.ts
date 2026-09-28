import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import fr from "../locales/fr";

/**
 * L'introduction de première ouverture.
 *
 * Trois promesses tiennent cet écran : elle pose le choix de consentement
 * elle-même (et la bannière du bas se tait pendant ce temps), elle ne repose
 * pas une question déjà tranchée, et elle ne s'affiche qu'une fois. Et elle
 * reste courte : trois pages à lire après le consentement, puis les gestes,
 * la seule page qu'on puisse passer.
 */

// L'introduction ne s'ouvre que dans l'app native : c'est la plateforme que
// ces tests jouent, sauf celui qui vérifie justement le silence sur le web.
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true, appPlatform: "ios" }));

// Le compte n'est là que pour savoir où enregistrer les réglages : pas de
// Firebase à réveiller ici.
vi.mock("../services/authService", () => ({
  authService: { onAuthChanged: () => () => {} },
}));

// Firestore n'a rien à faire ici : chaque test repart d'un registre de modules
// neuf, et initializeFirestore ne supporte pas d'être rejoué sur la même app.
vi.mock("../firebase/firestore", () => ({ db: {} }));

// Le stockage hors ligne parle au système de fichiers de l'appareil.
vi.mock("../services/offlineTextStore", () => ({
  downloadManifest: { value: { files: {} } },
  ensureManifestLoaded: () => Promise.resolve(),
  isDownloaded: () => false,
  isDownloadCurrent: () => false,
  downloadFile: vi.fn(),
  removeFile: vi.fn(),
  outdatedDownloads: () => Promise.resolve([]),
}));

const CONSENT_KEY = "pj_analytics_consent";
const SEEN_KEY = "pj_onboarding_seen";

async function mountComponent(load: () => Promise<{ default: unknown }>) {
  const { default: component } = await load();
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:chemin(.*)*", component: { render: () => null } }],
  });
  await router.push("/");
  await router.isReady();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(component as never) });
  app.use(i18n);
  app.use(router);
  app.mount(host);
  return { host, router };
}

/** Bouton portant exactement ce libellé (les pages en comptent beaucoup). */
function button(host: HTMLElement, label: string): HTMLButtonElement | null {
  return (
    [...host.querySelectorAll("button")].find((el) => el.textContent?.trim() === label) ?? null
  );
}

async function click(el: Element | null) {
  expect(el).not.toBeNull();
  el?.dispatchEvent(new MouseEvent("click"));
  // Le tour de boucle laisse aussi passer une navigation du routeur.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
  await nextTick();
}

describe("introduction de première ouverture", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
    vi.resetModules();
  });

  it("s'ouvre tant qu'elle n'a pas été vue, et plus jamais ensuite", async () => {
    const { useOnboarding, isOnboardingOpen } = await import("../composables/useOnboarding");
    expect(isOnboardingOpen.value).toBe(true);

    useOnboarding().completeOnboarding();
    expect(isOnboardingOpen.value).toBe(false);
    expect(localStorage.getItem(SEEN_KEY)).toBe("1");

    // Un nouveau lancement relit le stockage : elle ne revient pas.
    vi.resetModules();
    const relaunched = await import("../composables/useOnboarding");
    expect(relaunched.isOnboardingOpen.value).toBe(false);
  });

  it("pose le consentement en premier, puis déroule les réglages jusqu'à la fin", async () => {
    const { host } = await mountComponent(
      () => import("../components/onboarding/OnboardingFlow.vue"),
    );
    const { isOnboardingOpen } = await import("../composables/useOnboarding");

    // Cinq pages, et aucune porte de sortie tant que le choix n'est pas fait.
    expect(host.querySelectorAll("header span").length).toBe(5);
    expect(button(host, fr.onboarding.skip)).toBeNull();
    expect(button(host, fr.onboarding.consent.decline)).not.toBeNull();

    await click(button(host, fr.onboarding.consent.accept));
    expect(localStorage.getItem(CONSENT_KEY)).toBe("granted");

    // Réglages, textes à emporter, l'essentiel : à lire, pas de « Passer ».
    expect(host.textContent).toContain(fr.onboarding.settings.title);
    expect(button(host, fr.onboarding.skip)).toBeNull();
    await click(button(host, fr.onboarding.next));
    // Le sélecteur des textes à emporter est chargé à la demande.
    await vi.waitFor(() => expect(button(host, fr.onboarding.library.download)).not.toBeNull());
    expect(button(host, fr.onboarding.skip)).toBeNull();
    await click(button(host, fr.onboarding.next));
    expect(host.textContent).toContain(fr.onboarding.essentials.title);
    expect(button(host, fr.onboarding.skip)).toBeNull();
    await click(button(host, fr.onboarding.next));

    // Les gestes, en dernier : la seule page qu'on puisse passer.
    expect(host.textContent).toContain(fr.onboarding.gestures.title);
    expect(host.textContent).toContain(fr.tips.reading.pinch.title);
    expect(button(host, fr.onboarding.skip)).not.toBeNull();

    await click(button(host, fr.onboarding.finish));
    expect(localStorage.getItem(SEEN_KEY)).toBe("1");
    expect(isOnboardingOpen.value).toBe(false);
  });

  /**
   * La lecture du jour se propose sur la page de l'essentiel, et son bouton termine
   * l'introduction avant d'y conduire. Proposé plus tôt, il emmenait vers la
   * connexion (la page demande un compte) et l'introduction, notée comme vue
   * au passage, ne montrait jamais sa fin.
   */
  it("termine l'introduction avant de conduire à la lecture du jour", async () => {
    const { host, router } = await mountComponent(
      () => import("../components/onboarding/OnboardingFlow.vue"),
    );
    const { isOnboardingOpen } = await import("../composables/useOnboarding");

    await click(button(host, fr.onboarding.consent.accept));
    await click(button(host, fr.onboarding.next));
    await click(button(host, fr.onboarding.next));

    await click(button(host, fr.onboarding.essentials.compose));
    expect(isOnboardingOpen.value).toBe(false);
    expect(localStorage.getItem(SEEN_KEY)).toBe("1");
    expect(router.currentRoute.value.path).toBe("/bibliotheque/lecture-du-jour");
  });

  it("se passe depuis les gestes, et de là seulement", async () => {
    const { host } = await mountComponent(
      () => import("../components/onboarding/OnboardingFlow.vue"),
    );
    const { isOnboardingOpen } = await import("../composables/useOnboarding");
    await click(button(host, fr.onboarding.consent.accept));

    // Échap ne sort pas d'une page qu'on tient à faire lire.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(isOnboardingOpen.value).toBe(true);

    await click(button(host, fr.onboarding.next));
    await click(button(host, fr.onboarding.next));
    await click(button(host, fr.onboarding.next));
    await click(button(host, fr.onboarding.skip));
    expect(isOnboardingOpen.value).toBe(false);
    expect(localStorage.getItem(SEEN_KEY)).toBe("1");
  });

  it("ne propose, dans les réglages, que la langue, l'apparence et le thème", async () => {
    const { host } = await mountComponent(
      () => import("../components/onboarding/OnboardingFlow.vue"),
    );
    await click(button(host, fr.onboarding.consent.accept));

    // Les polices et les thèmes des fêtes attendent dans le profil.
    expect(host.textContent).not.toContain(fr.profile.fontsTitle);
    expect(host.textContent).not.toContain(fr.profile.holidayThemesTitle);
  });

  it("ne repose pas la question du consentement à qui y a déjà répondu", async () => {
    localStorage.setItem(CONSENT_KEY, "denied");
    const { host } = await mountComponent(
      () => import("../components/onboarding/OnboardingFlow.vue"),
    );

    expect(host.querySelectorAll("header span").length).toBe(4);
    expect(button(host, fr.onboarding.consent.accept)).toBeNull();
    expect(button(host, fr.onboarding.next)).not.toBeNull();
    // Le choix d'avant tient, l'introduction n'y touche pas.
    expect(localStorage.getItem(CONSENT_KEY)).toBe("denied");
  });

  it("laisse la bannière de consentement muette tant qu'elle est à l'écran", async () => {
    const { host } = await mountComponent(() => import("../components/ConsentBanner.vue"));
    const { useOnboarding } = await import("../composables/useOnboarding");
    expect(host.querySelector('[role="dialog"]')).toBeNull();

    // L'introduction terminée sans consentement enregistré (stockage
    // indisponible, par exemple) : la bannière reprend son rôle.
    useOnboarding().completeOnboarding();
    await nextTick();
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  });

  // En dernier : la plateforme rejouée ici vaut pour tous les imports qui
  // suivent, elle ne doit pas déteindre sur les tests de l'app native.
  it("ne s'ouvre jamais sur le web, où la bannière de consentement suffit", async () => {
    vi.doMock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));
    const { isOnboardingOpen, useOnboarding } = await import("../composables/useOnboarding");
    expect(isOnboardingOpen.value).toBe(false);
    // « Revoir l'introduction » n'y ouvrirait rien non plus (le lien n'y est pas).
    useOnboarding().replayOnboarding();
    expect(isOnboardingOpen.value).toBe(false);

    // La bannière de consentement, elle, garde son rôle entier sur le site.
    const { host } = await mountComponent(() => import("../components/ConsentBanner.vue"));
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("s'ouvre partout à qui la demande par l'adresse, site compris", async () => {
    vi.doMock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));
    window.history.replaceState({}, "", "/?intro");
    try {
      const { isOnboardingOpen, useOnboarding } = await import("../composables/useOnboarding");
      expect(isOnboardingOpen.value).toBe(true);
      // Une fois parcourue, elle se referme comme dans l'application.
      useOnboarding().completeOnboarding();
      expect(isOnboardingOpen.value).toBe(false);
    } finally {
      window.history.replaceState({}, "", "/");
    }
  });
});
