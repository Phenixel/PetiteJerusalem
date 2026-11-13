import { describe, expect, it, vi } from "vitest";

// « Comment ça marche » (page du partage) se retire pour de bon une fois le
// principe connu : « J'ai compris », ou une première session créée ou
// rejointe. Le choix est gardé sur l'appareil.

vi.mock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));

describe("« Comment ça marche » du partage", () => {
  it("paraît tant que le principe n'est pas connu, puis plus jamais", async () => {
    localStorage.clear();
    vi.resetModules();
    const { useShareHowItWorks } = await import("../composables/useShareHowItWorks");
    const { known, markKnown } = useShareHowItWorks();
    expect(known.value).toBe(false);
    markKnown();
    expect(known.value).toBe(true);

    // Une visite suivante : la page s'ouvre sans la frise.
    vi.resetModules();
    const again = await import("../composables/useShareHowItWorks");
    expect(again.useShareHowItWorks().known.value).toBe(true);
  });
});
