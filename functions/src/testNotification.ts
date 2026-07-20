/**
 * Notification de test à la demande, pour vérifier la chaîne push de bout en
 * bout (permission, token FCM, config APNs/google-services) sans attendre le
 * rappel quotidien planifié. Appelée depuis les réglages de notifications de
 * l'app (bouton « Envoyer une notification de test »).
 *
 * Contrairement à `dailyReadingReminder`, aucune condition métier : si un
 * token est enregistré, on envoie. Le résultat retourné au client détaille ce
 * qui s'est passé (tokens trouvés, envois réussis/échoués, codes d'erreur FCM)
 * pour diagnostiquer un rappel quotidien qui n'arrive pas.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { INVALID_TOKEN_CODES } from "./dailyReminder";

// La langue suit `pushLocale`, figée à l'activation comme pour le rappel.
const COPY: Record<string, { title: string; body: string }> = {
  fr: {
    title: "Notification de test 🔔",
    body: "Si vous voyez ce message, les notifications fonctionnent sur cet appareil.",
  },
  en: {
    title: "Test notification 🔔",
    body: "If you can see this message, notifications work on this device.",
  },
  he: {
    title: "התראת ניסיון 🔔",
    body: "אם אתם רואים הודעה זו, ההתראות פועלות במכשיר זה.",
  },
};

export interface TestNotificationResult {
  /** Tokens FCM enregistrés pour ce compte (0 = appareil jamais enregistré). */
  tokenCount: number;
  successCount: number;
  failureCount: number;
  /** Codes d'erreur FCM distincts, pour affichage/diagnostic côté client. */
  errorCodes: string[];
}

export const sendTestNotification = onCall<void, Promise<TestNotificationResult>>(
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign-in required.");
    }

    const db = getFirestore();
    const docRef = db.collection("userPreferences").doc(uid);
    const prefs = (await docRef.get()).data() ?? {};

    const tokens: string[] = Array.isArray(prefs.fcmTokens)
      ? prefs.fcmTokens.filter((t: unknown): t is string => typeof t === "string" && t.length > 0)
      : [];
    if (tokens.length === 0) {
      logger.info(`sendTestNotification: aucun token pour ${uid}.`);
      return { tokenCount: 0, successCount: 0, failureCount: 0, errorCodes: [] };
    }

    const copy = COPY[typeof prefs.pushLocale === "string" ? prefs.pushLocale : "fr"] ?? COPY.fr;
    const result = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: copy.title, body: copy.body },
      data: { url: "/profile" },
      apns: { payload: { aps: { sound: "default" } } },
    });

    const errorCodes = [
      ...new Set(
        result.responses
          .map((r) => r.error?.code)
          .filter((code): code is string => typeof code === "string"),
      ),
    ];

    // Même purge des tokens morts que le rappel quotidien.
    const invalidTokens = result.responses
      .map((r, i) => (r.error && INVALID_TOKEN_CODES.has(r.error.code) ? tokens[i] : null))
      .filter((t): t is string => t !== null);
    if (invalidTokens.length > 0) {
      await docRef.update({ fcmTokens: FieldValue.arrayRemove(...invalidTokens) });
    }

    logger.info(
      `sendTestNotification: ${uid} → ${result.successCount} ok, ${result.failureCount} échec(s)` +
        (errorCodes.length > 0 ? ` (${errorCodes.join(", ")})` : "") +
        ".",
    );
    return {
      tokenCount: tokens.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      errorCodes,
    };
  },
);
