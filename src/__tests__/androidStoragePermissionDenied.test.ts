import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sous Android 10 et moins, `@capacitor/file-transfer` demande la permission
 * de stockage avant tout transfert, même vers l'espace privé de l'app
 * (docs/app-native.md, androidStoragePermissions.test.ts pour le manifest).
 *
 * Ce qui doit tenir :
 * - une mise à jour de fond (le Sidour embarqué vérifié auprès du site, les
 *   livres téléchargés repris au lancement) ne fait jamais surgir le dialogue
 *   de permission : sans permission déjà accordée, elle attend ;
 * - un refus se dit pour ce qu'il est, et non « Vérifiez votre connexion » ;
 * - au-delà d'Android 10, rien ne change : le plugin ne consulte plus rien.
 */

const { httpGet, transfers, permission } = vi.hoisted(() => ({
  httpGet: vi.fn(),
  transfers: [] as string[],
  permission: { state: "prompt", checks: 0 },
}));

const disque: Record<string, string> = {};
let index: string | null = null;

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: () => Promise.resolve({ value: index }),
    set: ({ value }: { value: string }) => {
      index = value;
      return Promise.resolve();
    },
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
vi.mock("@capacitor/filesystem", () => ({
  Directory: { Data: "DATA" },
  Filesystem: {
    mkdir: () => Promise.resolve(),
    getUri: ({ path }: { path: string }) => Promise.resolve({ uri: `file:///data/${path}` }),
    stat: ({ path }: { path: string }) =>
      Promise.resolve({ size: (disque[`file:///data/${path}`] ?? "").length }),
  },
}));
vi.mock("@capacitor/file-transfer", () => ({
  FileTransfer: {
    // Le vrai plugin demande la permission ici, sous Android 10 : chaque
    // transfert lancé sans elle est un dialogue qui surgit.
    downloadFile: ({ url, path }: { url: string; path: string }) => {
      transfers.push(url);
      disque[path] = "corrigé";
      return Promise.resolve();
    },
    checkPermissions: () => {
      permission.checks++;
      return Promise.resolve({ publicStorage: permission.state });
    },
  },
}));

const CHAHARIT = "/texts/tefila/chaharit.json";
const LIVRE = "/texts/torah/bereshit.json";

const ANDROID_10 =
  "Mozilla/5.0 (Linux; Android 10; SM-A205F Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36";
const ANDROID_14 =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A.240305.019; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36";

/** L'agent réduit des webviews récentes : le même sur tous les appareils. */
const ANDROID_REDUIT =
  "Mozilla/5.0 (Linux; Android 10; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36";

function surAndroid(userAgent: string, platformVersion?: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  // Les indications du client : la vraie version d'Android, quand la webview
  // les donne.
  Object.defineProperty(navigator, "userAgentData", {
    configurable: true,
    value:
      platformVersion === undefined
        ? undefined
        : { getHighEntropyValues: () => Promise.resolve({ platformVersion }) },
  });
}

/** Le site sert ces empreintes, différentes de ce que l'appareil a. */
function siteSert(files: Record<string, string>): void {
  httpGet.mockImplementation(({ url }: { url: string }) =>
    url.includes("/texts/manifest.json")
      ? Promise.resolve({ status: 200, data: JSON.stringify({ files }) })
      : Promise.reject(new Error(`inattendu : ${url}`)),
  );
}

async function lancer() {
  vi.resetModules();
  return await import("../services/offlineTextStore");
}

const tacheDeFond = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  httpGet.mockReset();
  transfers.length = 0;
  permission.state = "prompt";
  permission.checks = 0;
  index = null;
  for (const cle of Object.keys(disque)) delete disque[cle];
  vi.stubGlobal("fetch", (url: string) => {
    const adresse = String(url);
    if (adresse.startsWith("file://")) {
      const corps = disque[adresse];
      return Promise.resolve(
        corps === undefined ? new Response("", { status: 404 }) : new Response(corps),
      );
    }
    return Promise.resolve(
      adresse === CHAHARIT ? new Response("chaharit embarqué") : new Response("", { status: 404 }),
    );
  });
});
afterEach(() => vi.restoreAllMocks());

describe("Android 10 et moins : la permission de stockage", () => {
  it("lit la version d'Android dans l'agent utilisateur de la webview", async () => {
    const { androidMajorVersion } = await lancer();
    expect(androidMajorVersion(ANDROID_10)).toBe(10);
    expect(androidMajorVersion(ANDROID_14)).toBe(14);
    expect(
      androidMajorVersion("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"),
    ).toBeNull();
  });

  it("n'ouvre pas le dialogue en ouvrant un office : la mise à jour du Sidour attend", async () => {
    surAndroid(ANDROID_10);
    siteSert({ [CHAHARIT]: "autre-version" });
    const { fetchTextResponse } = await lancer();
    expect(await (await fetchTextResponse(CHAHARIT)).text()).toBe("chaharit embarqué");
    await tacheDeFond();
    expect(permission.checks).toBeGreaterThan(0);
    expect(transfers).toEqual([]);
  });

  it("met à jour le Sidour en fond quand la permission est déjà accordée", async () => {
    surAndroid(ANDROID_10);
    permission.state = "granted";
    siteSert({ [CHAHARIT]: "autre-version" });
    const { fetchTextResponse } = await lancer();
    await fetchTextResponse(CHAHARIT);
    await vi.waitFor(() => expect(transfers).toHaveLength(1));
  });

  it("ne reprend pas en fond les livres téléchargés sans la permission", async () => {
    surAndroid(ANDROID_10);
    index = JSON.stringify({
      files: { [LIVRE]: { size: 1, downloadedAt: "2026-01-01", version: 0, hash: "ancienne" } },
    });
    siteSert({ [LIVRE]: "nouvelle" });
    vi.resetModules();
    const { refreshStaleDownloads } = await import("../services/offlineLibraryService");
    await refreshStaleDownloads();
    expect(transfers).toEqual([]);
  });

  it("agent réduit sur un téléphone récent : la mise à jour part, sans rien vérifier", async () => {
    // « Android 10; K » sur un Android 16 : la permission n'y est jamais
    // accordée, s'y fier coupait les mises à jour de fond pour de bon.
    surAndroid(ANDROID_REDUIT, "16.0.0");
    siteSert({ [CHAHARIT]: "autre-version" });
    const { fetchTextResponse } = await lancer();
    await fetchTextResponse(CHAHARIT);
    await vi.waitFor(() => expect(transfers).toHaveLength(1));
    expect(permission.checks).toBe(0);
  });

  it("agent réduit sur un vrai Android 10 : la mise à jour attend la permission", async () => {
    surAndroid(ANDROID_REDUIT, "10.0.0");
    siteSert({ [CHAHARIT]: "autre-version" });
    const { fetchTextResponse } = await lancer();
    await fetchTextResponse(CHAHARIT);
    await tacheDeFond();
    expect(permission.checks).toBeGreaterThan(0);
    expect(transfers).toEqual([]);
  });

  it("agent réduit sans indications du client : version inconnue, la mise à jour part", async () => {
    surAndroid(ANDROID_REDUIT);
    siteSert({ [CHAHARIT]: "autre-version" });
    const { fetchTextResponse } = await lancer();
    await fetchTextResponse(CHAHARIT);
    await vi.waitFor(() => expect(transfers).toHaveLength(1));
    expect(permission.checks).toBe(0);
  });

  it("ne vérifie rien au-delà d'Android 10 : la mise à jour part comme avant", async () => {
    surAndroid(ANDROID_14);
    siteSert({ [CHAHARIT]: "autre-version" });
    const { fetchTextResponse } = await lancer();
    await fetchTextResponse(CHAHARIT);
    await vi.waitFor(() => expect(transfers).toHaveLength(1));
    expect(permission.checks).toBe(0);
  });

  it("dit le refus pour ce qu'il est, pas comme une connexion coupée", async () => {
    const { isStoragePermissionDenied } = await lancer();
    const { downloadErrorKey } = await import("../composables/useBookDownload");
    const refus = Object.assign(
      new Error("Unable to perform operation, user denied permission request."),
      { code: "OS-PLUG-FLTR-0006" },
    );
    expect(isStoragePermissionDenied(refus)).toBe(true);
    expect(downloadErrorKey(refus)).toBe("downloads.permissionDenied");
    expect(downloadErrorKey(new Error("Failed to connect"))).toBe("downloads.error");
    expect(downloadErrorKey(null)).toBe("downloads.error");
  });

  it("a son message dans les trois langues", async () => {
    const [fr, en, he] = await Promise.all([
      import("../locales/fr"),
      import("../locales/en"),
      import("../locales/he"),
    ]);
    for (const locale of [fr.default, en.default, he.default]) {
      expect(locale.downloads.permissionDenied).toBeTruthy();
    }
  });
});
