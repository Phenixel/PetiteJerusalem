import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * « Gérer les cookies » rouvre la bannière en remettant le choix affiché à
 * null. La décision, elle, reste appliquée tant qu'elle n'est pas modifiée :
 * après un refus, ce qui est capturé pendant que la bannière est rouverte ne
 * part pas si l'on accepte ensuite. Le service lisait le choix affiché, et
 * remplissait sa file d'attente comme avant toute réponse.
 */

const { posthog } = vi.hoisted(() => ({
  posthog: {
    init: vi.fn(),
    register: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    setPersonProperties: vi.fn(),
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

/** Le vrai composable et le service, relus sur l'appareil tel qu'il est. */
async function fresh() {
  vi.resetModules();
  localStorage.setItem("ph_debug", "1");
  const consent = await import("../composables/useConsent");
  const { analyticsService } = await import("../services/analyticsService");
  return { ...consent, analytics: analyticsService };
}

beforeEach(() => {
  localStorage.clear();
  for (const fn of Object.values(posthog)) fn.mockClear();
});

describe("la bannière rouverte", () => {
  it("garde la décision en vigueur, la bannière seule revient", async () => {
    localStorage.setItem("pj_analytics_consent", "denied");
    const { useConsent, getConsentChoice } = await fresh();
    const { choice, reopen } = useConsent();

    reopen();

    expect(choice.value).toBeNull();
    expect(getConsentChoice()).toBe("denied");
  });

  it("après un refus, ne rejoue pas à l'accord ce qui s'est passé entre-temps", async () => {
    localStorage.setItem("pj_analytics_consent", "denied");
    const { useConsent, analytics } = await fresh();
    const { reopen, setChoice } = useConsent();
    analytics.init();

    reopen();
    analytics.capture("banniere_rouverte");
    setChoice("granted");
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());

    expect(posthog.capture.mock.calls.map((call) => call[0])).not.toContain("banniere_rouverte");
  });

  it("sans décision encore, garde ce qui précède la réponse pour le rejouer", async () => {
    const { useConsent, getConsentChoice, analytics } = await fresh();
    const { setChoice } = useConsent();
    analytics.init();
    expect(getConsentChoice()).toBeNull();

    analytics.capture("avant_reponse");
    setChoice("granted");

    await vi.waitFor(() =>
      expect(posthog.capture).toHaveBeenCalledWith("avant_reponse", undefined, expect.anything()),
    );
  });
});
