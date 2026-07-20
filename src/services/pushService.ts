import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { arrayRemove, arrayUnion, doc, setDoc } from "firebase/firestore";
import type { Router } from "vue-router";
import { app, db } from "../../firebase";
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

/** Résultat de la Cloud Function `sendTestNotification` (functions/src/testNotification.ts). */
export interface TestNotificationResult {
  tokenCount: number;
  successCount: number;
  failureCount: number;
  errorCodes: string[];
}

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

  /**
   * Envoie immédiatement une notification de test sur tous les appareils du
   * compte, via la Cloud Function `sendTestNotification`. Import dynamique :
   * `firebase/functions` ne rentre pas dans le bundle web, qui n'en a pas besoin.
   */
  async sendTest(): Promise<TestNotificationResult> {
    const { getFunctions, httpsCallable } = await import("firebase/functions");
    const call = httpsCallable<void, TestNotificationResult>(
      getFunctions(app),
      "sendTestNotification",
    );
    const { data } = await call();
    return data;
  }

  /**
   * Écouteurs de notifications, à appeler une fois au démarrage :
   * deep-links au toucher, et affichage quand l'app est au premier plan.
   *
   * Premier plan : le système n'affiche pas les push quand l'app est ouverte.
   * Sur iOS, `presentationOptions` dans capacitor.config.ts suffit. Sur
   * Android, rien n'existe nativement : on rejoue la notification reçue via
   * une notification locale (@capacitor/local-notifications), qui partage la
   * permission POST_NOTIFICATIONS déjà accordée pour les push.
   */
  init(router: Router): void {
    if (!this.isAvailable) return;

    // Deep-link quand l'utilisateur touche une notification push (`data.url`).
    FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
      const url = (event.notification.data as { url?: string } | undefined)?.url;
      if (url) router.push(url);
    });

    if (Capacitor.getPlatform() !== "android") return;
    // `notificationReceived` n'est émis qu'app au premier plan sur Android :
    // pas de risque de doublon avec l'affichage système en arrière-plan.
    FirebaseMessaging.addListener("notificationReceived", (event) => {
      const { title, body, data } = event.notification;
      if (!title && !body) return;
      void LocalNotifications.schedule({
        notifications: [
          {
            // Id 32 bits requis par Android ; les millisecondes tronquées
            // suffisent à éviter les collisions entre deux rappels.
            id: Date.now() % 2147483647,
            title: title ?? "",
            body: body ?? "",
            extra: data,
          },
        ],
      }).catch((e) => console.error("Affichage de la notification en premier plan échoué:", e));
    });
    // Toucher la notification locale doit deep-linker comme la push d'origine.
    LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
      const url = (event.notification.extra as { url?: string } | undefined)?.url;
      if (url) router.push(url);
    });
  }
}

export const pushService = new PushService();
