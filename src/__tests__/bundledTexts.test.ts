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
 * dans le binaire, qui fait foi. Le Sidour s'ouvre aussi dans le binaire, sans
 * rien attendre du réseau, mais l'app demande ensuite au site s'il en sert une
 * autre version (une correction de tefila n'attend pas une version de l'app) :
 * elle la télécharge, et c'est elle qui s'ouvre la fois suivante.
 */

const { httpGet, transfers } = vi.hoisted(() => ({
  httpGet: vi.fn(),
  transfers: [] as string[],
}));

/** Le disque de l'appareil, par adresse de fichier. */
const disque: Record<string, string> = {};
/** Ce que le téléchargement écrit : le texte du site, ou la page d'un portail captif. */
let recu = "";

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
vi.mock("@capacitor/filesystem", () => ({
  Directory: { Data: "DATA" },
  Filesystem: {
    mkdir: () => Promise.resolve(),
    getUri: ({ path }: { path: string }) => Promise.resolve({ uri: `file:///data/${path}` }),
    stat: ({ path }: { path: string }) =>
      Promise.resolve({ size: (disque[`file:///data/${path}`] ?? "").length }),
    deleteFile: ({ path }: { path: string }) => {
      delete disque[`file:///data/${path}`];
      return Promise.resolve();
    },
  },
}));
vi.mock("@capacitor/file-transfer", () => ({
  FileTransfer: {
    downloadFile: ({ url, path }: { url: string; path: string }) => {
      transfers.push(url);
      disque[path] = recu;
      return Promise.resolve();
    },
  },
}));

const CHAHARIT = "/texts/tefila/chaharit.json";
/** La version corrigée que sert le site : un texte est du JSON. */
const CORRIGE = '{"title":"Chaharit corrigé"}';
const TEHILIM = "/texts/tehilim.json";

/** Les fichiers du binaire, tels que la webview les sert. */
const embarques: Record<string, string> = {
  [CHAHARIT]: "chaharit embarqué",
  [TEHILIM]: "tehilim embarqués",
};

async function empreinte(contenu: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(contenu));
  return [...new Uint8Array(digest)]
    .map((octet) => octet.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

/** Le site répond au manifeste avec ces empreintes. */
function siteSert(files: Record<string, string>): void {
  httpGet.mockImplementation(({ url }: { url: string }) =>
    url.includes("/texts/manifest.json")
      ? Promise.resolve({ status: 200, data: JSON.stringify({ files }) })
      : Promise.reject(new Error(`inattendu : ${url}`)),
  );
}

/** Un lancement de l'app : le service repart de zéro. */
async function lancer() {
  vi.resetModules();
  const { fetchTextResponse } = await import("../services/offlineTextStore");
  return (path: string) => fetchTextResponse(path).then((res) => res.text());
}

/** Laisse finir la vérification de fond. */
const tacheDeFond = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  httpGet.mockReset();
  transfers.length = 0;
  for (const cle of Object.keys(disque)) delete disque[cle];
  recu = "";
  vi.stubGlobal("fetch", (url: string) => {
    const adresse = String(url);
    const corps = adresse.startsWith("file://") ? disque[adresse] : embarques[adresse];
    return Promise.resolve(
      corps === undefined ? new Response("", { status: 404 }) : new Response(corps),
    );
  });
});

describe("textes embarqués dans l'app", () => {
  it("existent tous dans public/texts, d'où le build les copie", () => {
    const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public");
    const manquants = [...bundledTexts.authoritative, ...bundledTexts.revalidated].filter(
      (path) => !existsSync(join(publicDir, path)),
    );
    expect(manquants).toEqual([]);
  });

  it("lit les Tehilim dans le binaire, sans rien demander au site", async () => {
    const lire = await lancer();
    expect(await lire(TEHILIM)).toBe("tehilim embarqués");
    await tacheDeFond();
    expect(httpGet).not.toHaveBeenCalled();
  });

  it("ouvre Cha'harit dans le binaire sans attendre le site, même s'il ne répond jamais", async () => {
    httpGet.mockReturnValue(new Promise(() => {}));
    const lire = await lancer();
    expect(await lire(CHAHARIT)).toBe("chaharit embarqué");
  });

  it("ouvre Cha'harit hors ligne, sans erreur", async () => {
    httpGet.mockRejectedValue(new Error("hors ligne"));
    const lire = await lancer();
    expect(await lire(CHAHARIT)).toBe("chaharit embarqué");
    await tacheDeFond();
    expect(transfers).toEqual([]);
  });

  it("ne télécharge rien quand le site sert la version embarquée", async () => {
    siteSert({ [CHAHARIT]: await empreinte("chaharit embarqué") });
    const lire = await lancer();
    await lire(CHAHARIT);
    await tacheDeFond();
    expect(httpGet).toHaveBeenCalled();
    expect(transfers).toEqual([]);
  });

  it("télécharge la version corrigée du site, qui s'ouvre la fois suivante", async () => {
    const corrigee = await empreinte(CORRIGE);
    siteSert({ [CHAHARIT]: corrigee });
    recu = CORRIGE;
    const lire = await lancer();

    // La lecture n'attend pas le site : la copie embarquée d'abord.
    expect(await lire(CHAHARIT)).toBe("chaharit embarqué");
    await vi.waitFor(() => expect(transfers).toHaveLength(1));
    // L'empreinte dans l'adresse : aucun cache HTTP ne rend l'ancien fichier.
    expect(transfers[0]).toContain(`h=${corrigee}`);

    await tacheDeFond();
    expect(await lire(CHAHARIT)).toBe(CORRIGE);
  });

  it("garde la copie embarquée quand le téléchargement rend autre chose (portail captif)", async () => {
    siteSert({ [CHAHARIT]: await empreinte(CORRIGE) });
    recu = "<html>Connectez-vous au Wi-Fi</html>";
    const lire = await lancer();

    await lire(CHAHARIT);
    await vi.waitFor(() => expect(transfers).toHaveLength(1));
    await tacheDeFond();
    expect(await lire(CHAHARIT)).toBe("chaharit embarqué");
    // La page reçue n'est ni gardée sur le disque, ni inscrite (la seconde
    // lecture a relancé la vérification : on la laisse finir).
    await tacheDeFond();
    expect(Object.values(disque)).not.toContain(recu);
    const { isDownloaded } = await import("../services/offlineTextStore");
    expect(isDownloaded(CHAHARIT)).toBe(false);
  });
});
