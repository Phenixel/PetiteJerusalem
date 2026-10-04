import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

/**
 * Le widget des horaires (et la montre) reçoit une semaine d'heures calculée
 * par l'app. Pour ne pas refaire la centaine de calculs solaires à chaque
 * coche de lecture, le calcul n'est refait que si sa clé change ; or la clé
 * ignorait l'opinion suivie et l'écart d'allumage. Passer du Rav Posen au
 * Rav Ovadia relançait le calcul... pour retrouver la même clé : le widget
 * gardait les anciennes heures jusqu'au lendemain.
 */

const { setPayloads } = vi.hoisted(() => ({
  setPayloads: vi.fn<(payloads: Record<string, string>) => Promise<void>>(() => Promise.resolve()),
}));

vi.mock("@capacitor/core", async (original) => ({
  ...(await original<typeof import("@capacitor/core")>()),
  registerPlugin: () => ({ setPayloads }),
}));
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true, appPlatform: "android" }));
vi.mock("../composables/useTheme", () => ({
  useTheme: () => ({ appliedTheme: ref({ primary: "#1d4ed8" }) }),
}));
vi.mock("../services/authService", () => ({ authService: { onAuthChanged: vi.fn() } }));
vi.mock("../services/userPreferencesService", () => ({
  userPreferencesService: { getPreferencesOrThrow: vi.fn() },
}));
vi.mock("../services/watchService", () => ({
  watchService: { publish: () => Promise.resolve(), onRequest: vi.fn(), reset: vi.fn() },
}));

vi.stubGlobal("requestIdleCallback", (cb: () => void) => setTimeout(cb, 0));

const { widgetService } = await import("../services/widgetService");
const { useZmanimOpinion } = await import("../composables/useZmanimOpinion");
const { useCandleLighting } = await import("../composables/useCandleLighting");

/** Les horaires remis au widget au dernier envoi qui en portait. */
function lastZmanim(): string | undefined {
  const calls = setPayloads.mock.calls.filter(([payloads]) => payloads.zmanim !== undefined);
  return calls.at(-1)?.[0].zmanim;
}

describe("widget des horaires", () => {
  it("suit l'opinion suivie", async () => {
    useZmanimOpinion().choose("posen");
    await widgetService.refresh();
    const before = lastZmanim();
    expect(before).toBeDefined();

    useZmanimOpinion().choose("ovadia");
    await widgetService.refresh();

    expect(lastZmanim()).not.toBe(before);
  });

  it("suit l'écart d'allumage", async () => {
    useCandleLighting().choose(18);
    await widgetService.refresh();
    const before = lastZmanim();

    useCandleLighting().choose(40);
    await widgetService.refresh();

    expect(lastZmanim()).not.toBe(before);
  });
});
