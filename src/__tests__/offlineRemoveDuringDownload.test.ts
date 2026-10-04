import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La mise à jour de fond reprend un livre corrigé sur le site pendant que
 * l'utilisateur le supprime (« Tout supprimer » dans l'étude, ou le livre
 * seul). La suppression passait, puis le téléchargement s'achevait et
 * réinscrivait le livre : il réapparaissait comme téléchargé, et occupait de
 * nouveau la place que l'on venait de libérer.
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

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => "web",
    convertFileSrc: (uri: string) => uri,
  },
  CapacitorHttp: { get: vi.fn() },
}));
vi.mock("@capacitor/filesystem", () => ({ Directory: { Data: "DATA" }, Filesystem: {} }));
vi.mock("@capacitor/file-transfer", () => ({ FileTransfer: { downloadFile: vi.fn() } }));

const LIVRE = "/texts/tanakh/bereshit.json";

/** Les copies du Cache Storage. */
let copies: Record<string, string> = {};
/** Le téléchargement du livre, tenu jusqu'à ce que le test le laisse finir. */
let finirTelechargement: () => void = () => {};

const cache = {
  match: (path: string) =>
    Promise.resolve(copies[path] === undefined ? undefined : new Response(copies[path])),
  put: (path: string, res: Response) =>
    res.text().then((texte) => {
      copies[path] = texte;
    }),
  delete: (path: string) => {
    const avait = path in copies;
    delete copies[path];
    return Promise.resolve(avait);
  },
};

async function store() {
  vi.resetModules();
  return import("../services/offlineTextStore");
}

beforeEach(() => {
  preferences.clear();
  copies = {};
  vi.stubGlobal("caches", { open: () => Promise.resolve(cache) });
  vi.stubGlobal("fetch", (url: string) => {
    const path = String(url).split("?")[0];
    if (path === "/texts/manifest.json") {
      return Promise.resolve(new Response(JSON.stringify({ files: {} })));
    }
    return new Promise<Response>((resolve) => {
      finirTelechargement = () => resolve(new Response('{"texte":"corrigé"}'));
    });
  });
});

/** Laisse passer les promesses en attente. */
async function laisserFiler(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

describe("un livre supprimé pendant son téléchargement", () => {
  it("ne réapparaît pas quand le téléchargement s'achève", async () => {
    const { downloadFile, removeFile, isDownloaded } = await store();

    const telechargement = downloadFile(LIVRE);
    await laisserFiler();
    await removeFile(LIVRE);
    finirTelechargement();
    await telechargement;

    expect(isDownloaded(LIVRE)).toBe(false);
    expect(copies[LIVRE]).toBeUndefined();
    expect(preferences.get("offline-texts:manifest")).not.toContain(LIVRE);
  });

  it("reste inscrit quand rien ne l'a retiré", async () => {
    const { downloadFile, isDownloaded } = await store();

    const telechargement = downloadFile(LIVRE);
    await laisserFiler();
    finirTelechargement();
    await telechargement;

    expect(isDownloaded(LIVRE)).toBe(true);
    expect(copies[LIVRE]).toBe('{"texte":"corrigé"}');
  });

  it("se retélécharge normalement après la suppression", async () => {
    const { downloadFile, removeFile, isDownloaded } = await store();

    await removeFile(LIVRE);
    const telechargement = downloadFile(LIVRE);
    await laisserFiler();
    finirTelechargement();
    await telechargement;

    expect(isDownloaded(LIVRE)).toBe(true);
  });
});
