import { ref } from "vue";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { Preferences } from "@capacitor/preferences";

/**
 * Stockage local des fichiers de textes (`/texts/**`).
 *
 * L'app native n'embarque pas les corpus volumineux (talmud, mishna, tanakh —
 * retirés du bundle par `scripts/prune-native-bundle.mjs`) : ils se
 * téléchargent à la demande depuis le site, ce qui garde le binaire léger
 * pendant que la bibliothèque grandit.
 *
 * Deux backends selon la plateforme :
 * - natif : fichiers dans `Directory.Data` (téléchargés via FileTransfer,
 *   relus par la webview via `convertFileSrc` — jamais en base64, les
 *   fichiers font jusqu'à ~2 Mo) ;
 * - web : Cache Storage API (accélère la lecture, et prépare un futur
 *   service worker pour l'offline navigateur).
 *
 * L'index des téléchargements (manifest) vit dans Preferences.
 */

/** Origine du site — seule source des textes quand l'app native ne les embarque pas. */
const REMOTE_TEXTS_BASE = "https://petite-jerusalem.fr";
const MANIFEST_KEY = "offline-texts:manifest";
const WEB_CACHE_NAME = "pj-texts-v1";

export interface DownloadedFile {
  /** Taille en octets, mesurée après téléchargement. */
  size: number;
  downloadedAt: string;
}

export interface DownloadManifest {
  files: Record<string, DownloadedFile>;
}

const isNative = Capacitor.isNativePlatform();

/** Manifest réactif : l'UI (page Téléchargements, boutons) s'y abonne. */
export const downloadManifest = ref<DownloadManifest>({ files: {} });

let manifestLoaded: Promise<void> | null = null;

export function ensureManifestLoaded(): Promise<void> {
  if (!manifestLoaded) {
    manifestLoaded = Preferences.get({ key: MANIFEST_KEY }).then(({ value }) => {
      if (!value) return;
      try {
        downloadManifest.value = JSON.parse(value) as DownloadManifest;
      } catch {
        // Manifest corrompu : on repart d'un index vide, les fichiers
        // seront simplement re-téléchargeables.
      }
    });
  }
  return manifestLoaded;
}

async function saveManifest(): Promise<void> {
  await Preferences.set({ key: MANIFEST_KEY, value: JSON.stringify(downloadManifest.value) });
}

/** "/texts/talmud/berakhot.json" → "texts/talmud/berakhot.json" (chemin Filesystem). */
function localPath(webPath: string): string {
  return webPath.replace(/^\//, "");
}

function remoteUrl(webPath: string): string {
  return isNative ? `${REMOTE_TEXTS_BASE}${webPath}` : webPath;
}

export function isDownloaded(webPath: string): boolean {
  return webPath in downloadManifest.value.files;
}

async function webCache(): Promise<Cache | null> {
  // Absente en contexte non sécurisé ou environnement de test.
  if (typeof caches === "undefined") return null;
  return caches.open(WEB_CACHE_NAME);
}

/**
 * Réponse pour un fichier de texte : copie locale d'abord, réseau sinon.
 * Renvoie une `Response` pour que l'appelant garde la même gestion
 * ok/status qu'avec un `fetch` direct.
 */
export async function fetchTextResponse(webPath: string): Promise<Response> {
  await ensureManifestLoaded();

  if (isDownloaded(webPath)) {
    try {
      if (isNative) {
        const { uri } = await Filesystem.getUri({
          directory: Directory.Data,
          path: localPath(webPath),
        });
        const res = await fetch(Capacitor.convertFileSrc(uri));
        if (res.ok) return res;
      } else {
        const cache = await webCache();
        const hit = await cache?.match(webPath);
        if (hit) return hit;
      }
    } catch {
      // Copie locale illisible : on retombe sur le réseau ci-dessous.
    }
  }

  if (isNative) {
    // Les petits fichiers (tehilim, talmud-chapters) restent embarqués dans
    // le binaire : on tente d'abord l'asset local, puis le site.
    try {
      const local = await fetch(webPath);
      if (local.ok) return local;
    } catch {
      // Asset absent du bundle (corpus retiré) : réseau.
    }
    // HTTP natif (pas la fetch de la webview) : l'origine de l'app
    // (https://localhost) n'est pas autorisée par CORS sur le site, une
    // fetch JS serait bloquée alors que l'appareil est bien en ligne.
    const res = await CapacitorHttp.get({
      url: remoteUrl(webPath),
      responseType: "text",
      headers: { Accept: "application/json" },
    });
    const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    return new Response(body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return fetch(webPath);
}

/** Télécharge un fichier et l'enregistre localement (natif : disque, web : Cache API). */
export async function downloadFile(webPath: string): Promise<void> {
  await ensureManifestLoaded();
  let size = 0;

  if (isNative) {
    const path = localPath(webPath);
    const dir = path.split("/").slice(0, -1).join("/");
    if (dir) {
      await Filesystem.mkdir({ directory: Directory.Data, path: dir, recursive: true }).catch(
        () => {
          // Dossier déjà présent.
        },
      );
    }
    const { uri } = await Filesystem.getUri({ directory: Directory.Data, path });
    await FileTransfer.downloadFile({ url: remoteUrl(webPath), path: uri });
    const stat = await Filesystem.stat({ directory: Directory.Data, path });
    size = stat.size;
  } else {
    const cache = await webCache();
    if (!cache) throw new Error("Cache Storage indisponible dans ce navigateur");
    const res = await fetch(webPath);
    if (!res.ok) throw new Error(`Téléchargement échoué (${res.status})`);
    size = (await res.clone().blob()).size;
    await cache.put(webPath, res);
  }

  downloadManifest.value = {
    files: {
      ...downloadManifest.value.files,
      [webPath]: { size, downloadedAt: new Date().toISOString() },
    },
  };
  await saveManifest();
}

/** Supprime la copie locale d'un fichier. */
export async function removeFile(webPath: string): Promise<void> {
  await ensureManifestLoaded();

  if (isNative) {
    await Filesystem.deleteFile({ directory: Directory.Data, path: localPath(webPath) }).catch(
      () => {
        // Déjà supprimé du disque : on nettoie quand même le manifest.
      },
    );
  } else {
    const cache = await webCache();
    await cache?.delete(webPath);
  }

  const files = { ...downloadManifest.value.files };
  delete files[webPath];
  downloadManifest.value = { files };
  await saveManifest();
}
