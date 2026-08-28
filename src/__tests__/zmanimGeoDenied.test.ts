import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La mémoire du refus de géolocalisation (useZmanimLocation.deniedBefore) :
 * les pages de tefila demandent la position à l'arrivée, mais qui a dit non
 * ne doit pas revoir la demande à chaque visite. Le refus s'écrit donc dans
 * le localStorage et se relit au chargement ; une position accordée
 * l'efface, une panne technique n'y touche pas.
 */

async function freshComposable() {
  vi.resetModules();
  const { useZmanimLocation } = await import("../composables/useZmanimLocation");
  return useZmanimLocation();
}

type SuccessCallback = (position: { coords: { latitude: number; longitude: number } }) => void;
type ErrorCallback = (error: { code: number }) => void;

function mockGeolocation(impl: (success: SuccessCallback, error: ErrorCallback) => void) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: impl },
  });
}

describe("mémoire du refus de géolocalisation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retient un refus et le relit au chargement suivant", async () => {
    mockGeolocation((_success, error) => error({ code: 1 }));
    const first = await freshComposable();
    expect(first.deniedBefore.value).toBe(false);

    expect(await first.useDevicePlace()).toBe(false);
    expect(first.status.value).toBe("denied");
    expect(first.deniedBefore.value).toBe(true);

    // Visite suivante : le refus se relit depuis le stockage.
    const next = await freshComposable();
    expect(next.deniedBefore.value).toBe(true);
  });

  it("ne prend pas une panne technique pour un refus", async () => {
    mockGeolocation((_success, error) => error({ code: 2 }));
    const composable = await freshComposable();

    expect(await composable.useDevicePlace()).toBe(false);
    expect(composable.status.value).toBe("unavailable");
    expect(composable.deniedBefore.value).toBe(false);
  });

  it("efface le refus mémorisé quand la position est accordée", async () => {
    localStorage.setItem("pj_zmanim_geo_denied", "1");
    mockGeolocation((success) => success({ coords: { latitude: 48.8566, longitude: 2.3522 } }));
    const composable = await freshComposable();
    expect(composable.deniedBefore.value).toBe(true);

    expect(await composable.useDevicePlace()).toBe(true);
    expect(composable.deniedBefore.value).toBe(false);
    expect(localStorage.getItem("pj_zmanim_geo_denied")).toBeNull();
  });
});
