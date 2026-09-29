import { ref } from "vue";
import { isNativeApp } from "../composables/useNativeApp";

/**
 * Notifications des informations de l'équipe : l'app s'abonne au canal FCM
 * de sa langue (`announcements-fr`, `-en`, `-he`), et la Cloud Function
 * onAnnouncementWritten y publie. Aucun jeton à enregistrer ni compte à
 * ouvrir : l'abonnement est porté par l'appareil.
 *
 * Tout le monde est abonné, sauf qui l'a coupé dans les réglages. Le système
 * ne montre de toute façon rien sans la permission de notifier : on ne la
 * demande pas au lancement, seulement quand la personne touche l'interrupteur
 * ou le bouton « Être prévenu » de la page des informations.
 *
 * Abonnement refait à chaque lancement : c'est une seule requête, et elle
 * rattrape un jeton FCM renouvelé ou une réinstallation.
 */

/** Préfixe des canaux, partagé avec functions/src/announcementPush.ts. */
const TOPIC_PREFIX = "announcements-";
const LOCALES = ["fr", "en", "he"];

/** Coupé par la personne (« 1 ») ; absent, l'abonnement est actif. */
const OPT_OUT_KEY = "pj_announcements_push_off";
/** Le canal auquel l'appareil est abonné, pour s'en désabonner au changement de langue. */
const TOPIC_KEY = "pj_announcements_topic";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible : l'abonnement se refera au prochain lancement.
  }
}

export function topicFor(locale: string): string {
  return `${TOPIC_PREFIX}${LOCALES.includes(locale) ? locale : "fr"}`;
}

/** L'interrupteur des réglages. */
export const announcementsPushEnabled = ref(read(OPT_OUT_KEY) !== "1");

/**
 * Met l'abonnement en accord avec le réglage et la langue. Silencieux en cas
 * d'échec (hors ligne, jeton pas encore là) : le prochain lancement reprend.
 */
export async function syncAnnouncementTopic(locale: string): Promise<void> {
  if (!isNativeApp) return;
  const wanted = announcementsPushEnabled.value ? topicFor(locale) : null;
  const previous = read(TOPIC_KEY);
  try {
    // Plugin déstructuré sur place, jamais rendu par une fonction async
    // (voir la note de useZmanReminders sur les proxys Capacitor).
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
    if (previous && previous !== wanted) {
      await FirebaseMessaging.unsubscribeFromTopic({ topic: previous });
    }
    if (wanted) await FirebaseMessaging.subscribeToTopic({ topic: wanted });
    write(TOPIC_KEY, wanted);
  } catch (error) {
    console.warn("Abonnement aux informations non synchronisé:", error);
  }
}

export async function setAnnouncementsPush(enabled: boolean, locale: string): Promise<void> {
  announcementsPushEnabled.value = enabled;
  write(OPT_OUT_KEY, enabled ? null : "1");
  await syncAnnouncementTopic(locale);
}
