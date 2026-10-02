import { describe, expect, it, vi } from "vitest";

/**
 * Sur le web, l'index des téléchargements se lit par @capacitor/preferences,
 * qui passe par localStorage. Quand le navigateur bloque les données du site,
 * localStorage lève : la promesse rejetée restait en place pour toute la
 * session, chaque lecture de texte échouait, et le lecteur n'affichait que
 * « erreur ». Un stockage bloqué n'empêche plus de lire par le réseau.
 */

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: () => Promise.reject(new DOMException("The operation is insecure.", "SecurityError")),
    set: () => Promise.reject(new DOMException("The operation is insecure.", "SecurityError")),
  },
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => "web",
    convertFileSrc: (u: string) => u,
  },
  CapacitorHttp: { get: vi.fn() },
}));
vi.mock("@capacitor/filesystem", () => ({ Directory: { Data: "DATA" }, Filesystem: {} }));
vi.mock("@capacitor/file-transfer", () => ({ FileTransfer: {} }));

describe("stockage du navigateur bloqué", () => {
  it("lit quand même les textes par le réseau", async () => {
    vi.stubGlobal("fetch", (url: string) =>
      Promise.resolve(
        String(url).includes("manifest.json")
          ? new Response(JSON.stringify({ files: {} }))
          : new Response('{"title":"Tehilim 1"}'),
      ),
    );
    const { fetchTextResponse, ensureManifestLoaded } = await import(
      "../services/offlineTextStore"
    );
    await expect(ensureManifestLoaded()).resolves.toBeUndefined();
    const first = await fetchTextResponse("/texts/tehilim/1.json");
    expect(await first.text()).toBe('{"title":"Tehilim 1"}');
    // Et la suivante aussi : rien de rejeté ne reste en place.
    const second = await fetchTextResponse("/texts/tehilim/2.json");
    expect(second.ok).toBe(true);
  });
});
