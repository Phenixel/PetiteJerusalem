import { httpsCallable } from "firebase/functions";
import { appPlatform, isNativeApp } from "../composables/useNativeApp";
import { i18n } from "../i18n";
import type { SupportThreadView } from "./support";

/**
 * Nous écrire : chaque message ouvre un fil (Cloud Function `submitFeedback`)
 * que l'équipe traite dans le backoffice ; ses réponses reviennent dans la
 * page /contact. Ce service ajoute ce que la personne n'a pas à dire
 * elle-même : le support (site ou app), la plateforme (web, iOS, Android), la
 * version, la langue et la page d'où elle écrit. Voir docs/feedback.md.
 *
 * Qui relit les fils : le compte connecté, et, dans l'app, l'appareil, par
 * une clé tirée au hasard et gardée sur le téléphone (on peut écrire et lire
 * les réponses sans compte). Le site, lui, exige un compte : sans lui, la
 * réponse n'aurait nulle part où arriver.
 */

export type FeedbackKind = "idea" | "bug" | "error" | "other";

export interface FeedbackMessage {
  kind: FeedbackKind;
  /** Précision libre quand `kind` vaut « other ». */
  otherKind: string;
  details: string;
  /** Email ou téléphone ; vide si la personne n'en laisse pas. */
  contact: string;
}

export interface FeedbackContext {
  support: "web" | "app";
  platform: "web" | "ios" | "android";
  /** « 1.4.2 (37) » dans l'app (version et build), la version du bundle sur le site. */
  version: string;
}

function platformOf(value: string): FeedbackContext["platform"] {
  return value === "ios" || value === "android" ? value : "web";
}

/**
 * Version installée : dans l'app, celle du binaire (`App.getInfo()`), pas
 * celle du bundle web, qui peut venir d'un serveur de dev (voir
 * appUpdateService). Sur le site, la version du bundle servi.
 */
async function installedVersion(): Promise<string> {
  if (!isNativeApp) return __APP_VERSION__;
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return info.build ? `${info.version} (${info.build})` : info.version;
  } catch {
    return __APP_VERSION__;
  }
}

export async function feedbackContext(): Promise<FeedbackContext> {
  return {
    support: isNativeApp ? "app" : "web",
    platform: platformOf(appPlatform),
    version: await installedVersion(),
  };
}

// ---- La clé de l'appareil (app seulement) --------------------------------------

/** La clé qui ouvre les fils de cet appareil : 32 octets aléatoires. */
const DEVICE_KEY = "pj_support_key";
/** Posé au premier message : l'appareil a des fils à relire (voir hasSupportHistory). */
const SENT_KEY = "pj_support_sent";

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible : la copie des préférences natives suffit.
  }
}

function randomKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

let deviceKey: Promise<string | null> | null = null;

/**
 * La clé de l'appareil, créée au premier message. Gardée en double, dans le
 * stockage de la page et dans les préférences natives : perdre la clé, c'est
 * perdre l'accès aux réponses.
 */
export function supportDeviceKey(create = false): Promise<string | null> {
  if (!isNativeApp) return Promise.resolve(null);
  if (deviceKey && !create) return deviceKey;
  const pending = (async () => {
    const { Preferences } = await import("@capacitor/preferences");
    let key = readLocal(DEVICE_KEY);
    if (!key) {
      key = (await Preferences.get({ key: DEVICE_KEY }).catch(() => null))?.value ?? null;
      if (key) writeLocal(DEVICE_KEY, key);
    }
    if (!key && create) {
      key = randomKey();
      writeLocal(DEVICE_KEY, key);
      await Preferences.set({ key: DEVICE_KEY, value: key }).catch(() => {});
    }
    return key;
  })();
  deviceKey = pending;
  return pending;
}

/** Cet appareil a déjà écrit : ses fils valent d'être relus (pastille du profil). */
export function hasSupportHistory(): boolean {
  return readLocal(SENT_KEY) === "1";
}

/**
 * Le jeton de notification de l'appareil, s'il a déjà la permission : la
 * réponse de l'équipe le préviendra. On ne demande jamais la permission ici.
 */
async function pushToken(): Promise<string> {
  if (!isNativeApp) return "";
  try {
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
    const { receive } = await FirebaseMessaging.checkPermissions();
    if (receive !== "granted") return "";
    return (await FirebaseMessaging.getToken()).token;
  } catch {
    return "";
  }
}

// ---- Les appels --------------------------------------------------------------------

async function callable<In, Out>(name: string) {
  // Le module des Cloud Functions n'est pas dans le bundle initial : chargé
  // au moment d'écrire ou de relire, pas à l'ouverture du site.
  const { functions } = await import("../firebase/functions");
  return httpsCallable<In, Out>(functions, name);
}

function currentPage(): string {
  try {
    return window.location.pathname;
  } catch {
    return "";
  }
}

export async function sendFeedback(message: FeedbackMessage): Promise<void> {
  const [call, context, guestKey, token] = await Promise.all([
    callable<Record<string, string>, { ok: true; id?: string }>("submitFeedback"),
    feedbackContext(),
    supportDeviceKey(true),
    pushToken(),
  ]);
  await call({
    ...message,
    ...context,
    locale: i18n.global.locale.value,
    page: currentPage(),
    guestKey: guestKey ?? "",
    pushToken: token,
  });
  writeLocal(SENT_KEY, "1");
}

/**
 * Les fils de la personne (son compte, et cet appareil dans l'app), le plus
 * récent en tête. `markRead` : elle les a sous les yeux, les réponses cessent
 * d'être nouvelles.
 */
export async function listSupportThreads(markRead = false): Promise<SupportThreadView[]> {
  const [call, guestKey] = await Promise.all([
    callable<{ guestKey: string; markRead: boolean }, { threads: SupportThreadView[] }>(
      "listSupportThreads",
    ),
    supportDeviceKey(),
  ]);
  const { data } = await call({ guestKey: guestKey ?? "", markRead });
  return data.threads;
}

/** La personne relance un de ses fils ; renvoie le fil à jour. */
export async function replyToSupportThread(
  threadId: string,
  text: string,
): Promise<SupportThreadView> {
  const [call, guestKey, token] = await Promise.all([
    callable<Record<string, string>, { thread: SupportThreadView }>("replySupportThread"),
    supportDeviceKey(),
    pushToken(),
  ]);
  const { data } = await call({ threadId, text, guestKey: guestKey ?? "", pushToken: token });
  return data.thread;
}

/** Suppression du compte : ses fils partent avec lui. */
export async function forgetSupportThreads(): Promise<void> {
  const call = await callable<Record<string, never>, { deleted: number }>("forgetSupportThreads");
  await call({});
}
