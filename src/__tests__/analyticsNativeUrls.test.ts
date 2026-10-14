import { describe, expect, it, vi } from "vitest";

/**
 * Dans l'app, l'origine de la webview Capacitor est réécrite en `app://ios` /
 * `app://android` avant envoi à PostHog (voir docs/tracking-plan.md).
 *
 * iOS ne sert pas le bundle depuis `https://localhost` comme Android, mais
 * depuis `capacitor://localhost` : la réécriture ne voyait que `http`/`https`
 * et laissait passer ce schéma. Toutes les adresses de l'app iOS partaient en
 * `capacitor://localhost/...` (17 000 événements sur quatorze jours au
 * 14 octobre 2026), et les analyses par page séparaient l'app iOS de l'app
 * Android et du site.
 */

const { posthog } = vi.hoisted(() => ({
  posthog: {
    init: vi.fn(),
    register: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    has_opted_out_capturing: vi.fn(() => false),
    stopSessionRecording: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock("posthog-js", () => ({ default: posthog }));
vi.mock("../services/authService", () => ({
  authService: { onAuthChanged: () => () => {}, isAuthResolved: () => true },
}));
vi.mock("../composables/useConsent", () => ({
  getConsentChoice: () => "granted",
  onConsentChange: vi.fn(),
}));
// L'app iOS : la plateforme est figée au chargement du module.
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true, appPlatform: "ios" }));

type BeforeSend = (event: unknown) => { properties: Record<string, unknown> } | null;

async function beforeSendOfTheApp(): Promise<BeforeSend> {
  vi.resetModules();
  posthog.init.mockClear();
  // Hors production, le suivi ne se charge que par cette porte de sortie.
  localStorage.setItem("ph_debug", "1");
  const { analyticsService } = await import("../services/analyticsService");
  analyticsService.init();
  await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());
  return posthog.init.mock.calls[0][1].before_send as BeforeSend;
}

describe("les adresses de l'app envoyées à PostHog", () => {
  it("portent app://ios, quel que soit le schéma de la webview", async () => {
    const beforeSend = await beforeSendOfTheApp();
    const sent = beforeSend({
      event: "$exception",
      properties: {
        $current_url: "capacitor://localhost/horaires",
        $initial_current_url: "capacitor://localhost/",
        $referrer: "ionic://localhost/bibliotheque",
        $host: "localhost",
      },
    });
    expect(sent?.properties.$current_url).toBe("app://ios/horaires");
    expect(sent?.properties.$initial_current_url).toBe("app://ios/");
    expect(sent?.properties.$referrer).toBe("app://ios/bibliotheque");
    expect(sent?.properties.$host).toBe("app.ios");
  });

  it("portent app://ios quand la webview sert en https, avec ou sans port", async () => {
    const beforeSend = await beforeSendOfTheApp();
    const sent = beforeSend({
      event: "zmanim_viewed",
      properties: {
        $current_url: "https://localhost/horaires/marseille",
        $initial_current_url: "http://localhost:5473/",
      },
    });
    expect(sent?.properties.$current_url).toBe("app://ios/horaires/marseille");
    expect(sent?.properties.$initial_current_url).toBe("app://ios/");
  });

  it("laissent intacte une adresse qui n'est pas celle de la webview", async () => {
    const beforeSend = await beforeSendOfTheApp();
    const sent = beforeSend({
      event: "share_opened",
      properties: {
        $current_url: "capacitor://localhost/horaires",
        $referrer: "https://petite-jerusalem.fr/horaires",
      },
    });
    expect(sent?.properties.$referrer).toBe("https://petite-jerusalem.fr/horaires");
  });
});
