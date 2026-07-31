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

/**
 * Version des données `/texts/**` : à incrémenter quand le format des fichiers
 * change (ex. v2 : montées + targoum des parachiot). Les fichiers sont servis
 * avec un cache HTTP d'une semaine ; le paramètre de version invalide ce cache
 * immédiatement. Les clés locales (manifest, disque, Cache API) restent le
 * chemin nu, mais chaque téléchargement enregistre sa version dans le
 * manifest : un fichier d'une version antérieure est considéré périmé — servi
 * seulement en dernier recours (hors ligne) et re-téléchargé par
 * syncDailyReadingDownloads.
 */
const TEXTS_VERSION = "2";

function versionedUrl(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}v=${TEXTS_VERSION}`;
}

export interface DownloadedFile {
  /** Taille en octets, mesurée après téléchargement. */
  size: number;
  downloadedAt: string;
  /** Version des données au téléchargement. Absente : fichier d'avant v2. */
  version?: string;
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

/** Copie locale au format courant (un fichier d'une version antérieure est périmé). */
export function isDownloadCurrent(webPath: string): boolean {
  return downloadManifest.value.files[webPath]?.version === TEXTS_VERSION;
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
/** Copie locale téléchargée (disque natif / Cache API), null si illisible. */
async function readLocalCopy(webPath: string): Promise<Response | null> {
  try {
    if (isNative) {
      const { uri } = await Filesystem.getUri({
        directory: Directory.Data,
        path: localPath(webPath),
      });
      const res = await fetch(Capacitor.convertFileSrc(uri));
      return res.ok ? res : null;
    }
    const cache = await webCache();
    return (await cache?.match(webPath)) ?? null;
  } catch {
    return null;
  }
}

export async function fetchTextResponse(webPath: string): Promise<Response> {
  await ensureManifestLoaded();

  // Copie locale à jour : on la sert directement. Une copie d'une version
  // antérieure (format différent) ne sert que de secours hors ligne.
  if (isDownloaded(webPath) && isDownloadCurrent(webPath)) {
    const local = await readLocalCopy(webPath);
    if (local) return local;
  }

  try {
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
        url: versionedUrl(remoteUrl(webPath)),
        responseType: "text",
        headers: { Accept: "application/json" },
      });
      const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
      if (res.status >= 200 && res.status < 300) {
        return new Response(body, {
          status: res.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      // Réseau en échec : la copie périmée vaut mieux que rien.
      const stale = isDownloaded(webPath) ? await readLocalCopy(webPath) : null;
      return (
        stale ??
        new Response(body, { status: res.status, headers: { "Content-Type": "application/json" } })
      );
    }

    const res = await fetch(versionedUrl(webPath));
    if (res.ok) return res;
    const stale = isDownloaded(webPath) ? await readLocalCopy(webPath) : null;
    return stale ?? res;
  } catch (error) {
    // Hors ligne : une copie périmée (ancien format, dégradé mais lisible)
    // vaut mieux qu'une erreur.
    const stale = isDownloaded(webPath) ? await readLocalCopy(webPath) : null;
    if (stale) return stale;
    throw error;
  }
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
    await FileTransfer.downloadFile({ url: versionedUrl(remoteUrl(webPath)), path: uri });
    const stat = await Filesystem.stat({ directory: Directory.Data, path });
    size = stat.size;
  } else {
    const cache = await webCache();
    if (!cache) throw new Error("Cache Storage indisponible dans ce navigateur");
    const res = await fetch(versionedUrl(webPath));
    if (!res.ok) throw new Error(`Téléchargement échoué (${res.status})`);
    size = (await res.clone().blob()).size;
    await cache.put(webPath, res);
  }

  downloadManifest.value = {
    files: {
      ...downloadManifest.value.files,
      [webPath]: { size, downloadedAt: new Date().toISOString(), version: TEXTS_VERSION },
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
