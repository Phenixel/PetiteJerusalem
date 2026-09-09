import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Les événements capturés avant le chargement de PostHog (consentement,
 * import du SDK) partaient dans le vide : `home_viewed` et le début de
 * l'introduction manquaient à tous les funnels. Ils attendent maintenant dans
 * une file bornée et sont rejoués, dans l'ordre et à leur heure, une fois le
 * SDK prêt et ses super propriétés posées.
 */

const { posthog, onAuthChanged } = vi.hoisted(() => ({
  posthog: {
    init: vi.fn(),
    register: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    setPersonProperties: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    stopSessionRecording: vi.fn(),
    reset: vi.fn(),
  },
  onAuthChanged: vi.fn((cb: (user: null) => void) => {
    cb(null);
    return () => {};
  }),
}));

vi.mock("posthog-js", () => ({ default: posthog }));
vi.mock("../services/authService", () => ({
  authService: { onAuthChanged, isAuthResolved: () => true },
}));
vi.mock("../composables/useConsent", () => ({
  getConsentChoice: () => "granted",
  onConsentChange: vi.fn(),
}));

async function freshService() {
  vi.resetModules();
  // Force le chargement hors production (voir DEBUG_STORAGE_KEY).
  localStorage.setItem("ph_debug", "1");
  return (await import("../services/analyticsService")).analyticsService;
}

describe("file d'attente des événements", () => {
  beforeEach(() => {
    localStorage.clear();
    posthog.capture.mockReset();
    posthog.register.mockReset();
  });

  it("rejoue après le chargement ce qui a été capturé avant, à son heure", async () => {
    const analytics = await freshService();
    analytics.capture("home_viewed", { logged_in: false });
    analytics.capture("onboarding_started", { steps: 6 });
    expect(posthog.capture).not.toHaveBeenCalled();

    analytics.init();
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledTimes(2));

    expect(posthog.capture.mock.calls[0][0]).toBe("home_viewed");
    expect(posthog.capture.mock.calls[0][1]).toEqual({ logged_in: false });
    expect(posthog.capture.mock.calls[0][2]).toEqual({ timestamp: expect.any(Date) });
    expect(posthog.capture.mock.calls[1][0]).toBe("onboarding_started");
    // Les super propriétés sont posées avant que la file ne parte.
    expect(posthog.register.mock.invocationCallOrder[0]).toBeLessThan(
      posthog.capture.mock.invocationCallOrder[0],
    );

    // Une fois chargé, plus de file : l'événement part tout de suite.
    analytics.capture("zmanim_viewed");
    expect(posthog.capture).toHaveBeenLastCalledWith("zmanim_viewed", undefined);
  });

  it("garde au plus cinquante événements, les plus récents", async () => {
    const analytics = await freshService();
    for (let i = 0; i < 60; i++) analytics.capture(`event_${i}`);

    analytics.init();
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledTimes(50));
    expect(posthog.capture.mock.calls[0][0]).toBe("event_10");
    expect(posthog.capture.mock.calls[49][0]).toBe("event_59");
  });
});
