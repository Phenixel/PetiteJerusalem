import { CapacitorHttp } from "@capacitor/core";
import { ref } from "vue";
import { appPlatform, isNativeApp } from "../composables/useNativeApp";
import { APP_BUNDLE_ID } from "../config/stores";
import { analyticsService } from "./analyticsService";

/**
 * Détection d'une version périmée de l'app native, pour proposer la mise à
 * jour vers le store (voir components/AppUpdateBanner.vue).
 *
 * Une app installée peut rester des mois en arrière (mises à jour
 * automatiques désactivées, appareil peu connecté au store) : les correctifs
 * ne l'atteignent jamais et les bugs remontés portent sur du code enterré.
 * D'où ce bandeau, informatif et refusable, il ne bloque rien.
 *
 * La règle, sur les deux plateformes : ne se fier qu'au store lui-même,
 * jamais au tag de release. Une release peut attendre des jours la revue
 * d'Apple ou de Google ; annoncer la mise à jour pendant cette fenêtre
 * enverrait vers une fiche qui ne la propose pas encore.
 *
 * - Android : l'API In-App Updates du Play Store, via
 *   @capawesome/capacitor-app-update. C'est la réponse du store pour cet
 *   appareil précis : revue Google passée, propagation faite, rollout
 *   progressif compris. L'ancienne source, `/app-version.json` émis par le
 *   build du site, annonçait la version dès la mise en ligne du site, donc
 *   pendant toute la revue Google ; vite.config.ts le publie toujours, pour
 *   les versions déjà installées qui le consultent encore.
 * - iOS : l'API publique de lookup de l'App Store, qui fait autorité (la
 *   publication iOS est manuelle et passe par une revue de plusieurs jours).
 *   Pas le plugin ici : son contrôle refait ce même lookup, et son
 *   `openAppStore` exige l'identifiant numérique Apple de la fiche, que le
 *   lookup fournit justement (trackViewUrl). Tant que l'app n'est pas
 *   publiée sur l'App Store, le lookup ne renvoie rien et le bandeau
 *   n'apparaît jamais.
 *
 * Silencieux en cas d'échec (hors ligne, store injoignable, build qui ne
 * vient pas du store) : pas de bandeau plutôt qu'un faux positif.
 */

const ITUNES_LOOKUP_URL = `https://itunes.apple.com/lookup?bundleId=${APP_BUNDLE_ID}`;

/** Version dont le bandeau a été refusé : la suivante le fera réapparaître. */
const DISMISSED_KEY = "pj_update_dismissed";

/** Un contrôle par lancement, puis au retour au premier plan passé ce délai. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Résultat d'un contrôle auprès du store de la plateforme courante. */
export interface StoreCheck {
  /** Le store distribue une version plus récente que celle installée. */
  outdated: boolean;
  /**
   * Identifiant de la version du store, pour l'analytics et la mémoire du
   * refus : versionName sur iOS, versionCode sur Android (l'API In-App
   * Updates n'expose pas de nom de version).
   */
  version: string | null;
  /** Version installée, pour l'analytics. */
  installed: string;
}

/**
 * Nombres de version d'un `CFBundleShortVersionString`.
 *
 * Tolérant sur ce qui suit : un build local est décrit par `git describe`
 * (`v3.4.0-7-gabc1234`, soit « 7 commits après v3.4.0 ») et vaut donc 3.4.0
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
 * Le bandeau s'affiche pour une mise à jour réellement disponible et non
 * refusée. Sans identifiant de version, le refus ne serait pas mémorisable
 * (le bandeau reviendrait à chaque lancement) : on s'abstient.
 */
export function shouldOfferUpdate(check: StoreCheck, dismissed: string | null): boolean {
  return check.outdated && check.version !== null && check.version !== dismissed;
}

/**
 * GET JSON par la couche HTTP native : la webview sert le bundle depuis
 * `https://localhost`, un `fetch` vers l'App Store serait soumis au CORS.
 * Rend `null` sur tout échec, l'appelant n'affiche alors rien.
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

/**
 * Version installée : `App.getInfo()` (CFBundleShortVersionString), et pas
 * `__APP_VERSION__`, qui décrit le bundle web servi et vaudrait la version du
 * serveur de dev en itération rapide (capacitor.config.ts, `server.url`).
 */
async function installedVersion(): Promise<string | null> {
  try {
    const { App } = await import("@capacitor/app");
    return (await App.getInfo()).version;
  } catch {
    return null;
  }
}

/**
 * iOS : lookup de l'App Store, comparaison de versions à notre charge. Le
 * lookup donne aussi l'URL de la fiche, que « Mettre à jour » ouvre.
 */
async function checkAppStore(): Promise<StoreCheck | null> {
  const [installed, payload] = await Promise.all([
    installedVersion(),
    getJson(ITUNES_LOOKUP_URL) as Promise<{
      results?: { version?: string; trackViewUrl?: string }[];
    } | null>,
  ]);
  // Aucun résultat : app pas (encore) publiée sur l'App Store.
  const entry = payload?.results?.[0];
  if (!installed || !entry?.version || !entry.trackViewUrl) return null;
  storeUrl = entry.trackViewUrl;
  return { outdated: isOutdated(installed, entry.version), version: entry.version, installed };
}

/**
 * Android : l'API In-App Updates répond pour l'appareil lui-même, la
 * comparaison de versions est faite côté Play Store. L'appel échoue quand
 * l'app ne vient pas du Play Store (build de dev installé à la main,
 * services Play absents) : silence, comme tout échec.
 */
async function checkPlayStore(): Promise<StoreCheck | null> {
  try {
    const { AppUpdate, AppUpdateAvailability } = await import("@capawesome/capacitor-app-update");
    const info = await AppUpdate.getAppUpdateInfo();
    return {
      outdated: info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE,
      version: info.availableVersionCode ?? null,
      installed: info.currentVersionName,
    };
  } catch {
    return null;
  }
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

/** Identifiant de la version du store, une fois le contrôle passé. */
let latestVersion: string | null = null;

/** Fiche App Store (trackViewUrl du lookup), rempli sur iOS seulement. */
let storeUrl: string | null = null;

let lastCheckAt = 0;
let announced = false;

async function check(): Promise<void> {
  if (!isNativeApp) return;
  if (lastCheckAt && Date.now() - lastCheckAt < CHECK_INTERVAL_MS) return;

  const result = appPlatform === "ios" ? await checkAppStore() : await checkPlayStore();
  // Échec (hors ligne, store injoignable) : on ne marque pas le contrôle comme
  // fait, le prochain retour au premier plan réessaiera.
  if (!result) return;
  lastCheckAt = Date.now();

  latestVersion = result.version;
  updateAvailable.value = shouldOfferUpdate(result, readDismissed());

  if (updateAvailable.value && !announced) {
    announced = true;
    analyticsService.capture("app_update_available", {
      installed_version: result.installed,
      store_version: result.version,
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
    analyticsService.capture("app_update_store_opened", { store_version: latestVersion });
    if (appPlatform === "ios") {
      if (storeUrl) window.open(storeUrl, "_blank");
      return;
    }
    // Android : le plugin ouvre la fiche Play de l'app courante.
    import("@capawesome/capacitor-app-update")
      .then(({ AppUpdate }) => AppUpdate.openAppStore())
      .catch(() => {});
  },

  /** Refus : le bandeau ne revient qu'à la prochaine version publiée. */
  dismiss(): void {
    updateAvailable.value = false;
    analyticsService.capture("app_update_dismissed", { store_version: latestVersion });
    try {
      if (latestVersion) localStorage.setItem(DISMISSED_KEY, latestVersion);
    } catch {
      // Stockage indisponible : le refus ne vaut que pour la session en cours.
    }
  },
};
