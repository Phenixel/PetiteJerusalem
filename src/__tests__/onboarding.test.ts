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
 * pas une question déjà tranchée, et elle ne s'affiche qu'une fois.
 */

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

    // Quatre pages, et aucune porte de sortie tant que le choix n'est pas fait.
    expect(host.querySelectorAll("header span").length).toBe(4);
    expect(button(host, fr.onboarding.skip)).toBeNull();
    expect(button(host, fr.onboarding.consent.decline)).not.toBeNull();

    await click(button(host, fr.onboarding.consent.accept));
    expect(localStorage.getItem(CONSENT_KEY)).toBe("granted");

    // Réglages, puis lecture du jour, puis bibliothèque.
    expect(button(host, fr.onboarding.skip)).not.toBeNull();
    await click(button(host, fr.onboarding.next));
    expect(button(host, fr.onboarding.daily.cta)).not.toBeNull();
    await click(button(host, fr.onboarding.next));
    expect(button(host, fr.onboarding.library.open)).not.toBeNull();

    await click(button(host, fr.onboarding.finish));
    expect(localStorage.getItem(SEEN_KEY)).toBe("1");
    expect(isOnboardingOpen.value).toBe(false);
  });

  it("ne repose pas la question du consentement à qui y a déjà répondu", async () => {
    localStorage.setItem(CONSENT_KEY, "denied");
    const { host } = await mountComponent(
      () => import("../components/onboarding/OnboardingFlow.vue"),
    );

    expect(host.querySelectorAll("header span").length).toBe(3);
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
});
