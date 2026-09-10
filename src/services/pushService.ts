import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { arrayRemove, arrayUnion, doc, setDoc } from "firebase/firestore";
import type { Router } from "vue-router";
import { db } from "../firebase/firestore";
import { auth } from "../firebase/core";
import { isNativeApp } from "../composables/useNativeApp";
import { analyticsService } from "./analyticsService";
import { isOffline, userPreferencesService } from "./userPreferencesService";
import type { ReminderPlace } from "./zmanimService";

/**
 * Notifications push (app native uniquement, le site web n'en envoie pas).
 *
 * Côté client : permission + token FCM via `@capacitor-firebase/messaging`
 * (token unifié iOS/Android, le mapping APNs→FCM est géré par le plugin).
 * Les tokens sont stockés dans `userPreferences/{uid}.fcmTokens`, où la
 * Cloud Function planifiée `dailyReadingReminder` les lit pour envoyer le
 * rappel de lecture quotidienne (voir functions/src/dailyReminder.ts).
 *
 * Config hors code requise avant que cela fonctionne sur appareil :
 * clé APNs dans la console Firebase + capability Push dans Xcode (iOS),
 * google-services.json (Android), voir docs/app-native.md.
 */

/** Les rappels choisis par l'utilisateur, tels que la modale les remonte. */
export interface ReminderSettings {
  /** Rappel à heure fixe. */
  daily: boolean;
  /** Heure du rappel fixe (heure de Paris, minutes par pas de 5). */
  hour: number;
  minute: number;
  /** Rappel « dernier appel » 20 minutes avant la chkia. */
  sunset: boolean;
  /**
   * Lieu du calcul de la chkia (arrondi, voir coarsePlace) : requis pour le
   * rappel d'avant-chkia, `null` quand il n'est pas demandé, la position
   * n'est alors pas envoyée du tout.
   */
  place: ReminderPlace | null;
}

/** Dernier jeton FCM connu de cet appareil, pour le retirer à la rotation. */
const LAST_TOKEN_KEY = "pj_fcm_token";

/**
 * Marqueur des notifications locales rejouées ici (voir `init`) : le plugin de
 * notifications locales sert aussi aux rappels d'horaires, et son événement de
 * toucher est global. Chaque service reconnaît les siennes à ce champ.
 */
const PUSH_SOURCE = "push";

function rememberToken(token: string): void {
  try {
    localStorage.setItem(LAST_TOKEN_KEY, token);
  } catch {
    // Stockage indisponible : l'ancien jeton sera purgé par la Cloud Function.
  }
}

class PushService {
  /** Les push ne sont proposés que dans l'app native. */
  readonly isAvailable = isNativeApp;

  /**
   * Active les rappels : permission système (Android 13+ et iOS affichent le
   * prompt), token FCM, puis enregistrement dans les préférences utilisateur.
   * `locale` fige la langue des notifications ; `settings` dit quels rappels
   * envoyer, l'heure fixe (heure de Paris, minutes par pas de 5, cadence de
   * la Cloud Function dailyReadingReminder) et/ou le dernier appel d'avant-chkia.
   */
  async enable(userId: string, locale: string, settings: ReminderSettings): Promise<void> {
    const permission = await FirebaseMessaging.requestPermissions();
    if (permission.receive !== "granted") {
      throw new Error("PERMISSION_DENIED");
    }
    const token = await this.obtainToken();
    rememberToken(token);
    // Le jeton part dans l'écriture ci-dessous : plus rien à rattraper.
    this.pendingRotation = null;
    await setDoc(
      doc(db, "userPreferences", userId),
      {
        fcmTokens: arrayUnion(token),
        pushReminderEnabled: true,
        pushReminderDailyEnabled: settings.daily,
        pushReminderHour: settings.hour,
        pushReminderMinute: settings.minute,
        pushSunsetReminderEnabled: settings.sunset,
        // Rappel d'avant-chkia coupé : le lieu mémorisé est effacé plutôt que
        // laissé à traîner dans le document.
        pushReminderPlace: settings.sunset ? settings.place : null,
        pushLocale: locale,
      },
      { merge: true },
    );
  }

  /**
   * Coupe les rappels et retire le token de cet appareil. Le lieu de calcul de
   * la chkia part avec eux : plus de rappel, plus de raison de le conserver.
   */
  async disable(userId: string): Promise<void> {
    const off = { pushReminderEnabled: false, pushReminderPlace: null };
    try {
      const { token } = await FirebaseMessaging.getToken();
      await setDoc(
        doc(db, "userPreferences", userId),
        { fcmTokens: arrayRemove(token), ...off },
        { merge: true },
      );
    } catch {
      // Token irrécupérable (permission retirée depuis les réglages système) :
      // on coupe quand même le rappel ; le token mort sera purgé par la
      // Cloud Function au premier envoi en échec.
      await setDoc(doc(db, "userPreferences", userId), off, { merge: true });
    }
    await FirebaseMessaging.deleteToken().catch(() => {});
  }

  /**
   * Jeton FCM de l'appareil. Sur iOS, il n'existe qu'une fois le jeton APNs
   * arrivé, parfois quelques secondes après la permission : un premier échec
   * (« No APNS token ») attend l'événement du plugin avant de conclure à un
   * refus, que l'écran affichait à tort comme une erreur.
   */
  private async obtainToken(): Promise<string> {
    try {
      return (await FirebaseMessaging.getToken()).token;
    } catch (error) {
      if (Capacitor.getPlatform() !== "ios") throw error;
      const received = await new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), 8000);
        void FirebaseMessaging.addListener("tokenReceived", ({ token }) => {
          clearTimeout(timer);
          resolve(token);
        }).then((handle) => setTimeout(() => void handle.remove(), 8500));
      });
      if (received) return received;
      return (await FirebaseMessaging.getToken()).token;
    }
  }

  /**
   * Rotation de jeton que le serveur n'a pas encore : sans réseau, ou
   * Firestore injoignable, on ne conclut rien (les préférences par défaut
   * diraient à tort « rappels coupés ») et on retente au retour du réseau.
   */
  private pendingRotation: { previous: string | null; token: string } | null = null;

  /**
   * Nouveau jeton FCM pour cet appareil : écrit dans le profil du compte
   * connecté si ses rappels sont actifs, l'ancien jeton retiré. Le dernier
   * jeton connu est gardé sur l'appareil pour cela.
   */
  private async onTokenRotated(token: string): Promise<void> {
    let previous: string | null = null;
    try {
      previous = localStorage.getItem(LAST_TOKEN_KEY);
    } catch {
      // Stockage indisponible : voir rememberToken.
    }
    rememberToken(token);
    if (previous === token) return;
    await this.syncRotatedToken({ previous, token });
  }

  private async syncRotatedToken(rotation: { previous: string | null; token: string }) {
    const user = auth.currentUser;
    if (!user) return;
    // Hors ligne, la lecture rendrait la copie locale et l'écriture partirait
    // en attente dans Firestore, avec un tableau peut-être périmé : on
    // attend plutôt le réseau, où la lecture est celle du serveur.
    if (isOffline()) {
      this.pendingRotation = rotation;
      return;
    }
    try {
      // getPreferencesOrThrow, et non getPreferences : celui-ci avale
      // l'échec et rend les valeurs par défaut, où les rappels sont coupés,
      // ce qui abandonnait la rotation pour de bon à la moindre coupure.
      const prefs = await userPreferencesService.getPreferencesOrThrow(user.uid);
      this.pendingRotation = null;
      if (!prefs.pushReminderEnabled) return;
      // Une seule écriture : Firestore refuse deux transformations
      // (arrayRemove puis arrayUnion) sur le même champ, on écrit donc le
      // tableau recalculé, l'ancien jeton retiré et le nouveau ajouté.
      const fcmTokens = (prefs.fcmTokens ?? []).filter(
        (known) => known !== rotation.previous && known !== rotation.token,
      );
      fcmTokens.push(rotation.token);
      await setDoc(doc(db, "userPreferences", user.uid), { fcmTokens }, { merge: true });
    } catch (e) {
      this.pendingRotation = rotation;
      console.warn("Jeton de notification pas encore synchronisé:", e);
    }
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

    // Rotation du jeton FCM (réinstallation, restauration, renouvellement
    // périodique) : le nouveau jeton remplace l'ancien dans le profil, sinon
    // les rappels s'éteignaient en silence jusqu'à une réactivation à la main.
    FirebaseMessaging.addListener("tokenReceived", ({ token }) => {
      void this.onTokenRotated(token);
    });
    // Rotation restée en attente (coupure au moment du renouvellement) :
    // elle repart avec le réseau.
    window.addEventListener("online", () => {
      const rotation = this.pendingRotation;
      if (rotation) void this.syncRotatedToken(rotation);
    });

    // Deep-link quand l'utilisateur touche une notification push (`data.url`).
    FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
      const url = (event.notification.data as { url?: string } | undefined)?.url;
      // Efficacité du rappel quotidien : combien de retours viennent des push.
      analyticsService.capture("push_notification_opened", { url: url ?? null });
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
            // `source` : les rappels d'horaires (zmanReminderService) passent
            // par le même plugin et le même événement. Chacun ne traite que
            // ses propres notifications, sinon les deux écouteurs
            // navigueraient pour la même.
            extra: { ...(data as Record<string, unknown> | undefined), source: PUSH_SOURCE },
          },
        ],
      }).catch((e) => console.error("Affichage de la notification en premier plan échoué:", e));
    });
    // Toucher la notification locale doit deep-linker comme la push d'origine.
    LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
      const extra = event.notification.extra as { url?: string; source?: string } | undefined;
      if (extra?.source !== PUSH_SOURCE) return;
      const url = extra.url;
      analyticsService.capture("push_notification_opened", { url: url ?? null });
      if (url) router.push(url);
    });
  }
}

export const pushService = new PushService();
