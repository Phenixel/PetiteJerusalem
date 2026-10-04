import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le consentement à la mesure d'audience, dans les deux sens :
 * - accepter de nouveau, dans une session qui suit un refus, rétablit la
 *   capture : posthog-js garde le refus (opt_out_capturing persiste) et le
 *   relisait à l'initialisation, si bien que plus rien ne partait, sans fin ;
 * - rien de ce qui est capturé pendant un refus ne part après un accord
 *   ultérieur : la file d'attente ne sert qu'avant une réponse.
 */

const { posthog, consent, listeners } = vi.hoisted(() => ({
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
  consent: { choice: null as "granted" | "denied" | null },
  listeners: [] as Array<(choice: "granted" | "denied") => void>,
}));

vi.mock("posthog-js", () => ({ default: posthog }));
vi.mock("../services/authService", () => ({
  authService: { onAuthChanged: () => () => {}, isAuthResolved: () => true },
}));
vi.mock("../composables/useConsent", () => ({
  getConsentChoice: () => consent.choice,
  onConsentChange: (listener: (choice: "granted" | "denied") => void) => {
    listeners.push(listener);
    return () => {};
  },
}));

async function freshService() {
  vi.resetModules();
  localStorage.setItem("ph_debug", "1");
  return (await import("../services/analyticsService")).analyticsService;
}

function decide(choice: "granted" | "denied") {
  consent.choice = choice;
  for (const listener of listeners) listener(choice);
}

beforeEach(() => {
  localStorage.clear();
  listeners.length = 0;
  consent.choice = null;
  for (const fn of Object.values(posthog)) fn.mockClear();
  posthog.has_opted_out_capturing.mockReturnValue(false);
});

describe("le consentement à la mesure d'audience", () => {
  it("un nouvel accord après un refus gardé d'une session passée rétablit la capture", async () => {
    // Le refus d'hier, gardé par posthog-js.
    posthog.has_opted_out_capturing.mockReturnValue(true);
    consent.choice = "granted";
    const analytics = await freshService();
    analytics.init();
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());
    await vi.waitFor(() => expect(posthog.opt_in_capturing).toHaveBeenCalled());
  });

  it("ne relance rien sans refus gardé", async () => {
    consent.choice = "granted";
    const analytics = await freshService();
    analytics.init();
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
  });

  it("n'envoie pas, après un accord, ce qui a été capturé pendant le refus", async () => {
    consent.choice = "denied";
    const analytics = await freshService();
    analytics.init();
    analytics.capture("pendant_le_refus");

    analytics.capture("avant_accord");
    decide("granted");
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());
    const sent = posthog.capture.mock.calls.map((call) => call[0]);
    expect(sent).not.toContain("pendant_le_refus");
    expect(sent).not.toContain("avant_accord");
  });

  it("garde encore ce qui précède toute réponse, pour le rejouer à l'accord", async () => {
    const analytics = await freshService();
    analytics.init();
    analytics.capture("avant_reponse");
    decide("granted");
    await vi.waitFor(() =>
      expect(posthog.capture).toHaveBeenCalledWith("avant_reponse", undefined, expect.anything()),
    );
  });
});
