import { httpsCallable } from "firebase/functions";
import { appPlatform, isNativeApp } from "../composables/useNativeApp";

/**
 * Formulaire de support : le message part vers la Cloud Function
 * `submitFeedback`, qui le dépose dans la base Notion « Formulaire de
 * support ». Ce service ajoute ce que la personne n'a pas à dire elle-même :
 * le support (site ou app), la plateforme (web, iOS, Android) et la version.
 */

export type FeedbackKind = "idea" | "bug" | "error" | "other";

export interface FeedbackMessage {
  kind: FeedbackKind;
  /** Précision libre quand `kind` vaut « other ». */
  otherKind: string;
  details: string;
  /** Email ou téléphone ; vide si la personne ne souhaite pas de réponse. */
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

export async function sendFeedback(message: FeedbackMessage): Promise<void> {
  // Le module des Cloud Functions n'est pas dans le bundle initial (seul le
  // studio l'importe) : chargé au moment d'envoyer, pas à l'ouverture du site.
  const [{ functions }, context] = await Promise.all([
    import("../firebase/functions"),
    feedbackContext(),
  ]);
  const call = httpsCallable<FeedbackMessage & FeedbackContext, { ok: true }>(
    functions,
    "submitFeedback",
  );
  await call({ ...message, ...context });
}
