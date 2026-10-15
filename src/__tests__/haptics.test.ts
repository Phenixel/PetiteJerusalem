import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Les retours au toucher (services/haptics.ts) : dans l'app, le moteur du
 * téléphone ; sur le site, la vibration du navigateur. Un seuil franchi ne
 * bat qu'une fois par instant, et un retour qui échoue ne casse jamais le
 * geste qu'il accompagne.
 *
 * Le plugin est un `Proxy` comme le vrai (docs/app-native.md, « Un plugin ne
 * traverse jamais une promesse ») : toute propriété inconnue rend un appel
 * natif rejeté, `then` compris.
 */

const native = vi.hoisted(() => ({ app: false, calls: [] as string[] }));

vi.mock("../composables/useNativeApp", () => ({
  get isNativeApp() {
    return native.app;
  },
}));

vi.mock("@capacitor/haptics", () => {
  const IMPLEMENTED: Record<string, (options: { style?: string; type?: string }) => Promise<void>> =
    {
      impact: async ({ style }) => void native.calls.push(`impact:${style}`),
      notification: async ({ type }) => void native.calls.push(`notification:${type}`),
    };
  return {
    ImpactStyle: { Heavy: "HEAVY", Medium: "MEDIUM", Light: "LIGHT" },
    NotificationType: { Success: "SUCCESS", Warning: "WARNING", Error: "ERROR" },
    Haptics: new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop in IMPLEMENTED) return IMPLEMENTED[prop];
          return () => Promise.reject(new Error(`"Haptics.${prop}()" is not implemented`));
        },
      },
    ),
  };
});

beforeEach(() => {
  vi.resetModules();
  native.app = false;
  native.calls = [];
});
afterEach(() => vi.restoreAllMocks());

describe("les retours au toucher", () => {
  it("sur le site, fait vibrer le navigateur : deux battements pour une tâche faite", async () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    const { haptic, WEB_PATTERNS } = await import("../services/haptics");
    haptic("done");
    haptic("undo");
    expect(vibrate.mock.calls).toEqual([[WEB_PATTERNS.done], [WEB_PATTERNS.undo]]);
  });

  it("ne bat qu'une fois quand un seuil se franchit plusieurs fois d'affilée", async () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    const { haptic } = await import("../services/haptics");
    haptic("tick");
    haptic("tick");
    haptic("tick");
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("se tait sans casser le geste quand le navigateur refuse", async () => {
    Object.defineProperty(navigator, "vibrate", {
      value: () => {
        throw new Error("refusé");
      },
      configurable: true,
    });
    const { haptic } = await import("../services/haptics");
    expect(() => haptic("done")).not.toThrow();
  });

  it("dans l'app, passe par le moteur du téléphone : le succès pour une tâche faite", async () => {
    native.app = true;
    const { haptic } = await import("../services/haptics");
    // Un geste après l'autre : sous Vitest, des imports simultanés d'un module
    // simulé n'obtiennent pas tous la simulation.
    for (const [kind, n] of [
      ["done", 1],
      ["press", 2],
      ["undo", 3],
    ] as const) {
      haptic(kind);
      await vi.waitFor(() => expect(native.calls).toHaveLength(n));
    }
    expect(native.calls).toEqual(["notification:SUCCESS", "impact:MEDIUM", "impact:LIGHT"]);
  });
});
