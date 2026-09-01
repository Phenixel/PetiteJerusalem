import { ref } from "vue";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { Preferences } from "@capacitor/preferences";

/**
 * Stockage local des fichiers de textes (`/texts/**`).
 *
 * L'app native n'embarque pas les corpus volumineux (talmud, mishna, tanakh
 * retirés du bundle par `scripts/prune-native-bundle.mjs`) : ils se
 * téléchargent à la demande depuis le site, ce qui garde le binaire léger
 * pendant que la bibliothèque grandit.
 *
 * Deux backends selon la plateforme :
 * - natif : fichiers dans `Directory.Data` (téléchargés via FileTransfer,
 *   relus par la webview via `convertFileSrc`, jamais en base64, les
 *   fichiers font jusqu'à ~2 Mo) ;
 * - web : Cache Storage API (accélère la lecture, et prépare un futur
 *   service worker pour l'offline navigateur).
 *
 * L'index des téléchargements (manifest) vit dans Preferences.
 *
 * Ce qui est téléchargé doit rester ce que le site sert : voir les empreintes
 * plus bas (`loadRemoteHashes`, `outdatedDownloads`), sans quoi une correction
 * apportée à un texte n'atteindrait jamais qui l'a déjà sur son appareil.
 */

/** Origine du site, seule source des textes quand l'app native ne les embarque pas. */
const REMOTE_TEXTS_BASE = "https://petite-jerusalem.fr";
const MANIFEST_KEY = "offline-texts:manifest";
const WEB_CACHE_NAME = "pj-texts-v1";

/**
 * Version des données `/texts/**` : à incrémenter quand le format des fichiers
 * change (ex. v2 : montées + targoum des parachiot). Les fichiers sont servis
 * avec un cache HTTP d'une semaine ; le paramètre de version invalide ce cache
 * immédiatement. Les clés locales (manifest, disque, Cache API) restent le
 * chemin nu, mais chaque téléchargement enregistre sa version dans le
 * manifest : un fichier d'une version antérieure est considéré périmé, servi
 * seulement en dernier recours (hors ligne) et re-téléchargé par
 * syncDailyReadingDownloads.
 */
const TEXTS_VERSION = "2";

/**
 * L'URL d'un fichier de textes. La version invalide le cache HTTP d'une
 * semaine quand le format change ; l'empreinte, quand c'est le contenu du
 * fichier qui change, ce qu'aucune version globale ne saurait dire.
 */
function versionedUrl(url: string, hash?: string): string {
  const separateur = url.includes("?") ? "&" : "?";
  return `${url}${separateur}v=${TEXTS_VERSION}${hash ? `&h=${hash}` : ""}`;
}

export interface DownloadedFile {
  /** Taille en octets, mesurée après téléchargement. */
  size: number;
  downloadedAt: string;
  /** Version des données au téléchargement. Absente : fichier d'avant v2. */
  version?: string;
  /**
   * Empreinte du contenu au téléchargement, telle que la donne le manifeste du
   * site (scripts/texts-manifest.mjs). Absente : copie d'avant les empreintes,
   * que la première synchronisation hache pour savoir quoi en faire.
   */
  hash?: string;
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

/** Le manifeste du site : chemin d'un texte, empreinte de son contenu. */
const HASHES_PATH = "/texts/manifest.json";
let remoteHashes: Record<string, string> | null = null;
let remoteHashesLoading: Promise<void> | null = null;

async function fetchRemoteHashes(): Promise<Record<string, string>> {
  const url = remoteUrl(HASHES_PATH);
  if (isNative) {
    // Même raison qu'ailleurs : l'origine de l'app n'est pas la nôtre, une
    // fetch de la webview serait refusée par CORS.
    const res = await CapacitorHttp.get({
      url,
      responseType: "text",
      headers: { Accept: "application/json" },
    });
    if (res.status < 200 || res.status >= 300)
      throw new Error(`Manifeste indisponible (${res.status})`);
    const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    return (data?.files ?? {}) as Record<string, string>;
  }
  // `no-cache` : le manifeste dit ce que le site sert maintenant, une réponse
  // gardée en cache dirait ce qu'il servait.
  const res = await fetch(HASHES_PATH, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Manifeste indisponible (${res.status})`);
  return ((await res.json())?.files ?? {}) as Record<string, string>;
}

/**
 * Charge les empreintes du site. Une fois suffit pour lire et télécharger,
 * mais pas pour vérifier : une app native vit des jours en arrière-plan, et
 * la resynchronisation au retour du réseau doit voir ce que le site sert à cet
 * instant, pas ce qu'il servait au lancement. `force` la lui redemande.
 *
 * Silencieux en cas d'échec (hors ligne, site injoignable) : sans elles, les
 * copies locales sont servies telles quelles, comme avant, plutôt qu'un texte
 * refusé. Un échec n'efface pas non plus les empreintes déjà connues.
 */
export function loadRemoteHashes(force = false): Promise<void> {
  if (force) remoteHashesLoading = null;
  if (!remoteHashesLoading) {
    remoteHashesLoading = fetchRemoteHashes()
      .then((hashes) => {
        remoteHashes = hashes;
      })
      .catch(() => {
        remoteHashesLoading = null;
      });
  }
  return remoteHashesLoading;
}

/**
 * Copie locale encore bonne à servir : au format courant, et telle que le site
 * la sert aujourd'hui quand on sait le dire. Une copie d'avant les empreintes
 * (`hash` absent) passe pour bonne : c'est la synchronisation qui la vérifie,
 * une lecture ne doit pas attendre le réseau pour ouvrir un texte.
 */
export function isDownloadCurrent(webPath: string): boolean {
  const file = downloadManifest.value.files[webPath];
  if (file?.version !== TEXTS_VERSION) return false;
  const attendu = remoteHashes?.[webPath];
  if (!attendu || !file.hash) return true;
  return file.hash === attendu;
}

/**
 * Empreinte d'un contenu, dans le format du manifeste du site (les fichiers
 * sont en UTF-8 sans BOM : les octets encodés ici sont les siens). Null là où
 * Web Crypto manque (contexte non sécurisé) : on ne conclut alors rien, ni
 * « à jour » ni « périmé », plutôt que de trancher à pile ou face.
 */
async function hashOf(contenu: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(contenu));
  return [...new Uint8Array(digest)]
    .map((octet) => octet.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

/**
 * Les textes gardés sur l'appareil qui ne sont plus ceux du site, à
 * retélécharger.
 *
 * Les copies d'avant les empreintes sont hachées une fois, ici, plutôt que
 * retéléchargées d'office : la plupart n'ont pas changé, et le Talmud entier
 * pèse une trentaine de mégaoctets qu'il serait malvenu de reprendre sur un
 * forfait mobile pour rien. Celles qui se révèlent identiques adoptent
 * l'empreinte du site, et la question ne se repose plus.
 *
 * Renvoie une liste vide quand le site est injoignable : on ne décide de rien
 * sans savoir.
 */
export async function outdatedDownloads(): Promise<string[]> {
  await ensureManifestLoaded();
  // Rien sur l'appareil : rien à comparer, et surtout pas de manifeste à aller
  // chercher. C'est le cas de tout visiteur du site, qui n'a rien demandé.
  if (Object.keys(downloadManifest.value.files).length === 0) return [];
  await loadRemoteHashes(true);
  if (!remoteHashes) return [];

  const perimes: string[] = [];
  const adoptees: Record<string, string> = {};
  for (const [webPath, file] of Object.entries(downloadManifest.value.files)) {
    const attendu = remoteHashes[webPath];
    if (!attendu) continue; // Fichier que le site ne sert plus, ou pas encore.
    if (file.version !== TEXTS_VERSION) {
      perimes.push(webPath);
    } else if (file.hash) {
      if (file.hash !== attendu) perimes.push(webPath);
    } else {
      const local = await readLocalCopy(webPath);
      const contenu = local ? await local.text().catch(() => null) : null;
      if (contenu === null) {
        // L'index annonce une copie que l'appareil n'a plus, ou ne sait plus
        // lire : elle est à reprendre, comme une copie périmée.
        perimes.push(webPath);
        continue;
      }
      const empreinte = await hashOf(contenu);
      // Empreinte impossible à calculer : on laisse la copie telle quelle,
      // sans rien inscrire. La question se reposera, elle ne se perdra pas.
      if (empreinte === null) continue;
      if (empreinte === attendu) adoptees[webPath] = attendu;
      else perimes.push(webPath);
    }
  }

  if (Object.keys(adoptees).length > 0) {
    const files = { ...downloadManifest.value.files };
    for (const [webPath, hash] of Object.entries(adoptees)) {
      files[webPath] = { ...files[webPath], hash };
    }
    downloadManifest.value = { files };
    await saveManifest();
  }
  return perimes;
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
        url: versionedUrl(remoteUrl(webPath), remoteHashes?.[webPath]),
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

    const res = await fetch(versionedUrl(webPath, remoteHashes?.[webPath]));
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
  // L'empreinte sert deux fois : dans l'URL, pour qu'aucun cache HTTP ne
  // rende l'ancien fichier, et dans l'index, pour reconnaître plus tard que
  // le site en sert un autre.
  await loadRemoteHashes();
  const attendue = remoteHashes?.[webPath];
  let size = 0;
  /** Ce qui a réellement été écrit, pour n'inscrire que l'empreinte du vrai. */
  let ecrit: string | null = null;

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
    await FileTransfer.downloadFile({ url: versionedUrl(remoteUrl(webPath), attendue), path: uri });
    const stat = await Filesystem.stat({ directory: Directory.Data, path });
    size = stat.size;
    const local = await readLocalCopy(webPath);
    ecrit = local ? await local.text().catch(() => null) : null;
  } else {
    const cache = await webCache();
    if (!cache) throw new Error("Cache Storage indisponible dans ce navigateur");
    const res = await fetch(versionedUrl(webPath, attendue));
    if (!res.ok) throw new Error(`Téléchargement échoué (${res.status})`);
    ecrit = await res.clone().text();
    size = new TextEncoder().encode(ecrit).length;
    await cache.put(webPath, res);
  }

  // L'empreinte inscrite est celle de ce qui a été écrit, jamais celle qu'on
  // attendait : un portail captif répond 200 avec sa page de connexion, et
  // inscrire l'empreinte espérée figerait cette page-là dans l'index, à jamais
  // « à jour ». Une empreinte inattendue se corrige d'elle-même à la
  // synchronisation suivante.
  const hash = ecrit === null ? undefined : ((await hashOf(ecrit)) ?? attendue);

  downloadManifest.value = {
    files: {
      ...downloadManifest.value.files,
      [webPath]: { size, downloadedAt: new Date().toISOString(), version: TEXTS_VERSION, hash },
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
