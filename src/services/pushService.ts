import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { arrayRemove, arrayUnion, doc, setDoc } from "firebase/firestore";
import type { Router } from "vue-router";
import { db } from "../../firebase";
import { isNativeApp } from "../composables/useNativeApp";

/**
 * Notifications push (app native uniquement — le site web n'en envoie pas).
 *
 * Côté client : permission + token FCM via `@capacitor-firebase/messaging`
 * (token unifié iOS/Android, le mapping APNs→FCM est géré par le plugin).
 * Les tokens sont stockés dans `userPreferences/{uid}.fcmTokens`, où la
 * Cloud Function planifiée `dailyReadingReminder` les lit pour envoyer le
 * rappel de lecture quotidienne (voir functions/src/dailyReminder.ts).
 *
 * Config hors code requise avant que cela fonctionne sur appareil :
 * clé APNs dans la console Firebase + capability Push dans Xcode (iOS),
 * google-services.json (Android) — voir docs/capacitor-poc.md.
 */

export type PushPermission = "granted" | "denied" | "prompt";

class PushService {
  /** Les push ne sont proposés que dans l'app native. */
  readonly isAvailable = isNativeApp;

  async getPermissionStatus(): Promise<PushPermission> {
    if (!this.isAvailable) return "denied";
    const { receive } = await FirebaseMessaging.checkPermissions();
    if (receive === "granted") return "granted";
    if (receive === "denied") return "denied";
    return "prompt";
  }

  /**
   * Active les rappels : permission système (Android 13+ et iOS affichent le
   * prompt), token FCM, puis enregistrement dans les préférences utilisateur.
   * `locale` fige la langue des notifications ; `hour` l'heure d'envoi (0-23,
   * heure de Paris).
   */
  async enable(userId: string, locale: string, hour: number): Promise<void> {
    const permission = await FirebaseMessaging.requestPermissions();
    if (permission.receive !== "granted") {
      throw new Error("PERMISSION_DENIED");
    }
    const { token } = await FirebaseMessaging.getToken();
    await setDoc(
      doc(db, "userPreferences", userId),
      {
        fcmTokens: arrayUnion(token),
        pushReminderEnabled: true,
        pushReminderHour: hour,
        pushLocale: locale,
      },
      { merge: true },
    );
  }

  /** Change l'heure d'envoi du rappel (0-23, heure de Paris). */
  async setReminderHour(userId: string, hour: number): Promise<void> {
    await setDoc(doc(db, "userPreferences", userId), { pushReminderHour: hour }, { merge: true });
  }

  /** Coupe les rappels et retire le token de cet appareil. */
  async disable(userId: string): Promise<void> {
    try {
      const { token } = await FirebaseMessaging.getToken();
      await setDoc(
        doc(db, "userPreferences", userId),
        { fcmTokens: arrayRemove(token), pushReminderEnabled: false },
        { merge: true },
      );
    } catch {
      // Token irrécupérable (permission retirée depuis les réglages système) :
      // on coupe quand même le rappel ; le token mort sera purgé par la
      // Cloud Function au premier envoi en échec.
      await setDoc(doc(db, "userPreferences", userId), { pushReminderEnabled: false }, { merge: true });
    }
    await FirebaseMessaging.deleteToken().catch(() => {});
  }

  /** Navigation quand l'utilisateur touche une notification (deep-link `data.url`). */
  initDeepLinks(router: Router): void {
    if (!this.isAvailable) return;
    FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
      const url = (event.notification.data as { url?: string } | undefined)?.url;
      if (url) router.push(url);
    });
  }
}

export const pushService = new PushService();
