import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Un texte téléchargé reste sur l'appareil, et c'est de là qu'il se lit : une
 * correction publiée depuis (une bénédiction ajoutée au sidour, une coquille)
 * ne l'atteignait plus jamais.
 *
 * Le site publie donc l'empreinte de chaque texte (public/texts/manifest.json,
 * voir scripts/texts-manifest.mjs), et l'app compare. Ce qui se joue ici :
 * ne reprendre que ce qui a vraiment changé, ne rien décider quand le site est
 * injoignable, et traiter les copies d'avant les empreintes sans faire
 * retélécharger des mégaoctets pour rien.
 */

const preferences = new Map<string, string>();

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: ({ key }: { key: string }) => Promise.resolve({ value: preferences.get(key) ?? null }),
    set: ({ key, value }: { key: string; value: string }) => {
      preferences.set(key, value);
      return Promise.resolve();
    },
  },
}));

// Le web : les copies vivent dans le Cache Storage, pas sur un disque natif.
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false, convertFileSrc: (uri: string) => uri },
  CapacitorHttp: { get: vi.fn() },
}));
vi.mock("@capacitor/filesystem", () => ({ Directory: { Data: "DATA" }, Filesystem: {} }));
vi.mock("@capacitor/file-transfer", () => ({ FileTransfer: { downloadFile: vi.fn() } }));

const SIDOUR = "/texts/tefila/chaharit.json";
const TALMUD = "/texts/talmud/berakhot.json";

/** Le contenu que sert le site, par chemin. */
let servi: Record<string, string> = {};
/** Les empreintes publiées, ou null quand le site est injoignable. */
let manifesteDuSite: Record<string, string> | null = {};
/** Les copies locales, telles que le Cache Storage les rendrait. */
let copies: Record<string, string> = {};

async function empreinte(contenu: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(contenu));
  return [...new Uint8Array(digest)]
    .map((octet) => octet.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

const cache = {
  match: (path: string) =>
    Promise.resolve(copies[path] === undefined ? undefined : new Response(copies[path])),
  put: (path: string, res: Response) =>
    res.text().then((texte) => {
      copies[path] = texte;
    }),
  delete: () => Promise.resolve(true),
};

/** Le manifeste des téléchargements, tel que l'app l'a gardé d'une session à l'autre. */
function indexLocal(files: Record<string, { version?: string; hash?: string }>): void {
  preferences.set(
    "offline-texts:manifest",
    JSON.stringify({
      files: Object.fromEntries(
        Object.entries(files).map(([path, file]) => [
          path,
          { size: 10, downloadedAt: "2026-01-01T00:00:00.000Z", ...file },
        ]),
      ),
    }),
  );
}

async function store() {
  vi.resetModules();
  return import("../services/offlineTextStore");
}

beforeEach(() => {
  preferences.clear();
  copies = {};
  servi = {};
  manifesteDuSite = {};
  vi.stubGlobal("caches", { open: () => Promise.resolve(cache) });
  vi.stubGlobal("fetch", (url: string) => {
    const path = String(url).split("?")[0];
    if (path === "/texts/manifest.json") {
      if (!manifesteDuSite) return Promise.reject(new Error("hors ligne"));
      return Promise.resolve(new Response(JSON.stringify({ files: manifesteDuSite })));
    }
    const corps = servi[path];
    if (corps === undefined) return Promise.resolve(new Response("", { status: 404 }));
    return Promise.resolve(new Response(corps));
  });
});

describe("textes téléchargés et corrigés depuis", () => {
  it("reprend celui dont le site sert une autre version, et lui seul", async () => {
    manifesteDuSite = { [SIDOUR]: "aaaaaaaaaaaa", [TALMUD]: "bbbbbbbbbbbb" };
    indexLocal({
      [SIDOUR]: { version: "2", hash: "000000000000" },
      [TALMUD]: { version: "2", hash: "bbbbbbbbbbbb" },
    });
    const { outdatedDownloads } = await store();

    expect(await outdatedDownloads()).toEqual([SIDOUR]);
  });

  it("ne décide de rien quand le site est injoignable", async () => {
    manifesteDuSite = null;
    indexLocal({ [SIDOUR]: { version: "2", hash: "000000000000" } });
    const { outdatedDownloads, isDownloadCurrent } = await store();

    expect(await outdatedDownloads()).toEqual([]);
    // Et la copie en place reste bonne à lire : hors ligne, elle est tout ce
    // qu'il y a.
    expect(isDownloadCurrent(SIDOUR)).toBe(true);
  });

  it("garde la copie d'avant les empreintes qui est déjà la bonne, sans la retélécharger", async () => {
    const texte = '{"title":"Chaharit"}';
    copies[SIDOUR] = texte;
    manifesteDuSite = { [SIDOUR]: await empreinte(texte) };
    indexLocal({ [SIDOUR]: { version: "2" } });
    const { outdatedDownloads, downloadManifest } = await store();

    expect(await outdatedDownloads()).toEqual([]);
    // Elle adopte l'empreinte du site : la question ne se repose plus.
    expect(downloadManifest.value.files[SIDOUR].hash).toBe(manifesteDuSite[SIDOUR]);
    expect(JSON.parse(preferences.get("offline-texts:manifest")!).files[SIDOUR].hash).toBe(
      manifesteDuSite[SIDOUR],
    );
  });

  it("reprend la copie d'avant les empreintes qui n'est plus la bonne", async () => {
    copies[SIDOUR] = '{"title":"Chaharit, version d0"}';
    manifesteDuSite = { [SIDOUR]: await empreinte('{"title":"Chaharit"}') };
    indexLocal({ [SIDOUR]: { version: "2" } });
    const { outdatedDownloads } = await store();

    expect(await outdatedDownloads()).toEqual([SIDOUR]);
  });

  it("reprend le texte que l'index annonce mais que l'appareil n'a plus", async () => {
    manifesteDuSite = { [SIDOUR]: "aaaaaaaaaaaa" };
    indexLocal({ [SIDOUR]: { version: "2" } }); // Aucune copie dans le cache.
    const { outdatedDownloads } = await store();

    expect(await outdatedDownloads()).toEqual([SIDOUR]);
  });

  it("retient l'empreinte de ce qu'elle télécharge", async () => {
    const texte = '{"title":"Chaharit"}';
    servi[SIDOUR] = texte;
    manifesteDuSite = { [SIDOUR]: await empreinte(texte) };
    const { downloadFile, downloadManifest, isDownloadCurrent } = await store();

    await downloadFile(SIDOUR);

    expect(downloadManifest.value.files[SIDOUR].hash).toBe(manifesteDuSite[SIDOUR]);
    expect(isDownloadCurrent(SIDOUR)).toBe(true);
    // Le site publie une correction : la copie n'est plus celle qu'il sert.
    manifesteDuSite = { [SIDOUR]: "cccccccccccc" };
    const { outdatedDownloads } = await store();
    expect(await outdatedDownloads()).toEqual([SIDOUR]);
  });
});
