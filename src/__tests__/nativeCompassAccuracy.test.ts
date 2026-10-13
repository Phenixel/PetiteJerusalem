import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le pont vers PjCompass, le plugin Android qui lit l'étalonnage du
 * magnétomètre (la webview ne donne que le cap) : il ne sert que dans l'app
 * Android, s'éteint avec la boussole, et ne laisse jamais le plugin traverser
 * une promesse (docs/app-native.md).
 */

const plateforme = vi.hoisted(() => ({ native: true, nom: "android" }));
const plugin = vi.hoisted(() => ({
  start: vi.fn(() => Promise.resolve({ available: true })),
  stop: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  ecoute: null as ((data: { accuracy: number }) => void) | null,
}));

vi.mock("../composables/useNativeApp", () => ({
  get isNativeApp() {
    return plateforme.native;
  },
  get appPlatform() {
    return plateforme.nom;
  },
}));

vi.mock("@capacitor/core", () => ({
  registerPlugin: () => ({
    start: plugin.start,
    stop: plugin.stop,
    addListener: (_event: string, listener: (data: { accuracy: number }) => void) => {
      plugin.ecoute = listener;
      return Promise.resolve({ remove: plugin.remove });
    },
  }),
}));

import { watchNativeCompassAccuracy } from "../services/nativeCompassAccuracy";

beforeEach(() => {
  plateforme.native = true;
  plateforme.nom = "android";
  plugin.start.mockClear();
  plugin.stop.mockClear();
  plugin.remove.mockClear();
  plugin.ecoute = null;
});

describe("étalonnage de la boussole (app Android)", () => {
  it("remonte le niveau d'Android, puis rend le capteur", async () => {
    const niveaux: string[] = [];
    const arrete = watchNativeCompassAccuracy((niveau) => niveaux.push(niveau));
    await Promise.resolve();

    expect(plugin.start).toHaveBeenCalledTimes(1);
    plugin.ecoute?.({ accuracy: 1 });
    plugin.ecoute?.({ accuracy: 3 });
    expect(niveaux).toEqual(["low", "high"]);

    arrete();
    expect(plugin.stop).toHaveBeenCalledTimes(1);
    expect(plugin.remove).toHaveBeenCalledTimes(1);
    // Une mesure tardive, après l'arrêt, ne remonte plus.
    plugin.ecoute?.({ accuracy: 2 });
    expect(niveaux).toEqual(["low", "high"]);
  });

  it("ne fait rien ailleurs que dans l'app Android", () => {
    plateforme.nom = "ios";
    watchNativeCompassAccuracy(() => {})();
    plateforme.native = false;
    plateforme.nom = "web";
    watchNativeCompassAccuracy(() => {})();
    expect(plugin.start).not.toHaveBeenCalled();
    expect(plugin.stop).not.toHaveBeenCalled();
  });
});
