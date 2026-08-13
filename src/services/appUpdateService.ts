import { CapacitorHttp } from "@capacitor/core";
import { ref } from "vue";
import { appPlatform, isNativeApp } from "../composables/useNativeApp";
import { analyticsService } from "./analyticsService";

/**
 * Détection d'une version périmée de l'app native, pour proposer la mise à
 * jour vers le store (voir components/AppUpdateBanner.vue).
 *
 * Une app installée peut rester des mois en arrière (mises à jour
 * automatiques désactivées, appareil peu connecté au store) : les correctifs
 * ne l'atteignent jamais et les bugs remontés portent sur du code enterré.
 * D'où ce bandeau, informatif et refusable — il ne bloque rien.
 *
 * Version installée : `App.getInfo()` (versionName Android /
 * CFBundleShortVersionString iOS), et pas `__APP_VERSION__`, qui décrit le
 * bundle web servi et vaudrait la version du serveur de dev en itération
 * rapide (capacitor.config.ts, `server.url`).
 *
 * Version publiée, par plateforme — deux sources, parce qu'aucune ne couvre
 * les deux stores :
 * - iOS : l'API publique de lookup de l'App Store, qui fait autorité (la
 *   publication iOS est manuelle et passe par une revue de plusieurs jours :
 *   se fier au tag de release annoncerait une mise à jour introuvable). Tant
 *   que l'app n'y est pas publiée, le lookup ne renvoie rien et le bandeau
 *   n'apparaît jamais.
 * - Android : `/app-version.json`, publié par le build du site (voir
 *   vite.config.ts). Le Play Store n'expose aucune API publique de version, et
 *   le tag qui déploie le site déclenche aussi la publication Play
 *   (deploy-android.yml) : les deux versions ne divergent que le temps de la
 *   revue Google, quelques heures.
 *
 * Silencieux en cas d'échec (hors ligne, store injoignable, réponse
 * inattendue) : pas de bandeau plutôt qu'un faux positif.
 */

const APP_ID = "fr.petitejerusalem.app";
const VERSION_MANIFEST_URL = "https://petite-jerusalem.fr/app-version.json";
const ITUNES_LOOKUP_URL = `https://itunes.apple.com/lookup?bundleId=${APP_ID}`;
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${APP_ID}`;

/** Version dont le bandeau a été refusé : la suivante le fera réapparaître. */
const DISMISSED_KEY = "pj_update_dismissed";

/** Un contrôle par lancement, puis au retour au premier plan passé ce délai. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Release disponible sur le store de la plateforme courante. */
interface StoreRelease {
  version: string;
  /** Fiche du store, ouverte par le bouton « Mettre à jour ». */
  url: string;
}

/**
 * Nombres de version d'un `versionName` / `CFBundleShortVersionString`.
 *
 * Tolérant sur ce qui suit : un build local est décrit par `git describe`
 * (`v3.4.0-7-gabc1234`, soit « 7 commits après v3.4.0 ») et vaut donc 3.4.0 —
 * un build de dev entre deux tags ne doit pas se croire périmé.
 */
function parseVersion(raw: string): number[] | null {
  const match = /^\s*v?(\d+(?:\.\d+)*)/.exec(raw);
  return match ? match[1].split(".").map(Number) : null;
}

/** `installed` est-elle antérieure à `latest` ? Faux si l'une est illisible. */
export function isOutdated(installed: string, latest: string): boolean {
  const current = parseVersion(installed);
  const published = parseVersion(latest);
  if (!current || !published) return false;
  for (let i = 0; i < Math.max(current.length, published.length); i++) {
    const diff = (published[i] ?? 0) - (current[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/**
 * GET JSON par la couche HTTP native : la webview sert le bundle depuis
 * `https://localhost`, un `fetch` vers le site ou l'App Store serait soumis au
 * CORS. Rend `null` sur tout échec — l'appelant n'affiche alors rien.
 */
async function getJson(url: string): Promise<unknown | null> {
  try {
    const response = await CapacitorHttp.get({ url, headers: { Accept: "application/json" } });
    if (response.status < 200 || response.status >= 300) return null;
    return typeof response.data === "string" ? JSON.parse(response.data) : response.data;
  } catch {
    return null;
  }
}

async function fetchStoreRelease(): Promise<StoreRelease | null> {
  if (appPlatform === "ios") {
    const payload = (await getJson(ITUNES_LOOKUP_URL)) as {
      results?: { version?: string; trackViewUrl?: string }[];
    } | null;
    // Aucun résultat : app pas (encore) publiée sur l'App Store.
    const entry = payload?.results?.[0];
    if (!entry?.version || !entry.trackViewUrl) return null;
    return { version: entry.version, url: entry.trackViewUrl };
  }
  const payload = (await getJson(VERSION_MANIFEST_URL)) as { version?: string } | null;
  if (!payload?.version) return null;
  return { version: payload.version, url: PLAY_STORE_URL };
}

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

/** Une mise à jour est disponible et n'a pas été refusée : bandeau affiché. */
export const updateAvailable = ref(false);

/** Version publiée sur le store, une fois le contrôle passé. */
export const latestVersion = ref<string | null>(null);

let storeUrl: string | null = null;
let lastCheckAt = 0;
let announced = false;

async function installedVersion(): Promise<string | null> {
  try {
    const { App } = await import("@capacitor/app");
    return (await App.getInfo()).version;
  } catch {
    return null;
  }
}

async function check(): Promise<void> {
  if (!isNativeApp) return;
  if (lastCheckAt && Date.now() - lastCheckAt < CHECK_INTERVAL_MS) return;

  const [installed, release] = await Promise.all([installedVersion(), fetchStoreRelease()]);
  // Échec (hors ligne, store injoignable) : on ne marque pas le contrôle comme
  // fait, le prochain retour au premier plan réessaiera.
  if (!installed || !release) return;
  lastCheckAt = Date.now();

  latestVersion.value = release.version;
  storeUrl = release.url;
  updateAvailable.value =
    isOutdated(installed, release.version) && readDismissed() !== release.version;

  if (updateAvailable.value && !announced) {
    announced = true;
    analyticsService.capture("app_update_available", {
      installed_version: installed,
      store_version: release.version,
    });
  }
}

export const appUpdateService = {
  /** À appeler une fois au démarrage de l'app native (no-op sur le web). */
  init(): void {
    if (!isNativeApp) return;
    void check();
    // Retour au premier plan : l'app peut être restée ouverte des jours, et
    // c'est le moment où l'utilisateur revient d'une visite au store.
    import("@capacitor/app")
      .then(({ App }) => App.addListener("resume", () => void check()))
      .catch(() => {});
  },

  /** Ouvre la fiche du store (Play Store / App Store) dans l'app dédiée. */
  openStore(): void {
    if (!storeUrl) return;
    analyticsService.capture("app_update_store_opened", { store_version: latestVersion.value });
    window.open(storeUrl, "_blank");
  },

  /** Refus : le bandeau ne revient qu'à la prochaine version publiée. */
  dismiss(): void {
    updateAvailable.value = false;
    analyticsService.capture("app_update_dismissed", { store_version: latestVersion.value });
    try {
      if (latestVersion.value) localStorage.setItem(DISMISSED_KEY, latestVersion.value);
    } catch {
      // Stockage indisponible : le refus ne vaut que pour la session en cours.
    }
  },
};
