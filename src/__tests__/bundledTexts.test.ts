import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import bundledTexts from "../datas/bundledTexts.json";

/**
 * Ce que l'app native embarque (src/datas/bundledTexts.json) se lit sans
 * réseau dès l'installation : les Tehilim, et le Sidour tout entier.
 *
 * Les deux familles ne se lisent pas de la même façon. Les Tehilim se lisent
 * dans le binaire. Les tefilot se demandent d'abord au site, qui fait foi (une
 * correction ne doit pas attendre une version de l'app), et la copie embarquée
 * ne sert que quand il ne répond pas.
 */

const { httpGet } = vi.hoisted(() => ({ httpGet: vi.fn() }));

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: () => Promise.resolve({ value: null }),
    set: () => Promise.resolve(),
  },
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => "android",
    convertFileSrc: (uri: string) => uri,
  },
  CapacitorHttp: { get: httpGet },
}));
vi.mock("@capacitor/filesystem", () => ({ Directory: { Data: "DATA" }, Filesystem: {} }));
vi.mock("@capacitor/file-transfer", () => ({ FileTransfer: { downloadFile: vi.fn() } }));

const CHAHARIT = "/texts/tefila/chaharit.json";
const TEHILIM = "/texts/tehilim.json";

/** Les fichiers du binaire, tels que la webview les sert. */
const embarques: Record<string, string> = {
  [CHAHARIT]: "chaharit embarqué",
  [TEHILIM]: "tehilim embarqués",
};

async function lire(path: string): Promise<string> {
  vi.resetModules();
  const { fetchTextResponse } = await import("../services/offlineTextStore");
  return (await fetchTextResponse(path)).text();
}

beforeEach(() => {
  httpGet.mockReset();
  vi.stubGlobal("fetch", (url: string) => {
    const corps = embarques[String(url)];
    return Promise.resolve(
      corps === undefined ? new Response("", { status: 404 }) : new Response(corps),
    );
  });
});

describe("textes embarqués dans l'app", () => {
  it("existent tous dans public/texts, d'où le build les copie", () => {
    const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public");
    const manquants = [...bundledTexts.authoritative, ...bundledTexts.fallback].filter(
      (path) => !existsSync(join(publicDir, path)),
    );
    expect(manquants).toEqual([]);
  });

  it("lit les Tehilim dans le binaire, sans rien demander au site", async () => {
    expect(await lire(TEHILIM)).toBe("tehilim embarqués");
    expect(httpGet).not.toHaveBeenCalled();
  });

  it("lit Cha'harit sur le site quand il répond, avec des délais courts", async () => {
    httpGet.mockResolvedValue({ status: 200, data: "chaharit du site" });
    expect(await lire(CHAHARIT)).toBe("chaharit du site");
    expect(httpGet).toHaveBeenCalledWith(
      expect.objectContaining({ connectTimeout: 5_000, readTimeout: 5_000 }),
    );
  });

  it("lit la copie embarquée de Cha'harit hors ligne", async () => {
    httpGet.mockRejectedValue(new Error("hors ligne"));
    expect(await lire(CHAHARIT)).toBe("chaharit embarqué");
  });

  it("lit la copie embarquée de Cha'harit quand le site est en erreur", async () => {
    httpGet.mockResolvedValue({ status: 503, data: "" });
    expect(await lire(CHAHARIT)).toBe("chaharit embarqué");
  });
});
