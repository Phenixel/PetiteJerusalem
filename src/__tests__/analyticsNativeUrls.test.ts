import { describe, expect, it, vi } from "vitest";

/**
 * In the app, the origin of the Capacitor webview is rewritten as `app://ios`
 * / `app://android` before it is sent to PostHog (see docs/tracking-plan.md).
 *
 * iOS does not serve the bundle from `https://localhost` like Android, but
 * from `capacitor://localhost`: the rewrite only saw `http`/`https` and let
 * that scheme through. Every address of the iOS app went out as
 * `capacitor://localhost/...` (17,000 events over fourteen days as of
 * October 14, 2026), and per-page analyses split the iOS app from the
 * Android app and the site.
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
// The iOS app: the platform is fixed when the module loads.
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true, appPlatform: "ios" }));

type BeforeSend = (event: unknown) => { properties: Record<string, unknown> } | null;

async function beforeSendOfTheApp(): Promise<BeforeSend> {
  vi.resetModules();
  posthog.init.mockClear();
  // Outside production, tracking only loads through this escape hatch.
  localStorage.setItem("ph_debug", "1");
  const { analyticsService } = await import("../services/analyticsService");
  analyticsService.init();
  await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());
  return posthog.init.mock.calls[0][1].before_send as BeforeSend;
}

describe("the app's addresses sent to PostHog", () => {
  it("carry app://ios, whatever the webview's scheme", async () => {
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

  it("carry app://ios when the webview serves over https, with or without a port", async () => {
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

  it("leave an address that is not the webview's untouched", async () => {
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
