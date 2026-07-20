/**
 * Rappel quotidien de lecture par notification push (FCM).
 *
 * Chaque soir à 18h (heure de Paris — audience du site), parcourt les
 * `userPreferences` dont `pushReminderEnabled` est vrai : si la liste de
 * lecture quotidienne du jour n'est pas terminée, envoie un rappel sur tous
 * les appareils enregistrés (`fcmTokens`, alimentés par l'app native via
 * src/services/pushService.ts). Les tokens morts (app désinstallée,
 * rotation) sont purgés au fil des envois en échec.
 *
 * Prérequis hors code : clé APNs uploadée dans la console Firebase (iOS).
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

interface ReminderCopy {
  title: string;
  body: (remaining: number) => string;
}

// La langue est figée côté client au moment de l'activation (`pushLocale`).
const COPY: Record<string, ReminderCopy> = {
  fr: {
    title: "Ta lecture du jour t'attend 📖",
    body: (n) =>
      n === 1 ? "Il te reste 1 texte à lire aujourd'hui." : `Il te reste ${n} textes à lire aujourd'hui.`,
  },
  en: {
    title: "Your daily reading is waiting 📖",
    body: (n) => (n === 1 ? "1 text left to read today." : `${n} texts left to read today.`),
  },
  he: {
    title: "הקריאה היומית שלך מחכה 📖",
    body: (n) => (n === 1 ? "נשאר לך טקסט אחד לקרוא היום." : `נשארו לך ${n} טקסטים לקרוא היום.`),
  },
};

export const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

/** Jour calendaire YYYY-MM-DD à Paris — même convention que todayKey() côté client. */
function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

/** Heure courante à Paris (0-23), pour respecter l'heure choisie par chacun. */
function currentParisHour(): number {
  return Number(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
}

const DEFAULT_REMINDER_HOUR = 18;

// Tourne toutes les heures : chaque utilisateur choisit son heure de rappel
// (`pushReminderHour`) dans l'app, on n'envoie qu'à ceux dont c'est l'heure.
export const dailyReadingReminder = onSchedule(
  { schedule: "0 * * * *", timeZone: "Europe/Paris" },
  async () => {
    const db = getFirestore();
    const snap = await db
      .collection("userPreferences")
      .where("pushReminderEnabled", "==", true)
      .get();
    if (snap.empty) return;

    const messaging = getMessaging();
    const today = todayKey();
    const hour = currentParisHour();
    let sent = 0;

    for (const docSnap of snap.docs) {
      const prefs = docSnap.data();
      const wantedHour =
        typeof prefs.pushReminderHour === "number" ? prefs.pushReminderHour : DEFAULT_REMINDER_HOUR;
      if (wantedHour !== hour) continue;
      const tokens: string[] = Array.isArray(prefs.fcmTokens)
        ? prefs.fcmTokens.filter((t: unknown): t is string => typeof t === "string" && t.length > 0)
        : [];
      const readingIds: unknown[] = Array.isArray(prefs.dailyReadingIds) ? prefs.dailyReadingIds : [];
      if (tokens.length === 0 || readingIds.length === 0) continue;

      const progress = prefs.dailyReadingProgress as
        | { date?: string; completedIds?: unknown[] }
        | undefined;
      const completedToday =
        progress?.date === today && Array.isArray(progress.completedIds)
          ? progress.completedIds.length
          : 0;
      const remaining = readingIds.length - completedToday;
      if (remaining <= 0) continue;

      const copy = COPY[typeof prefs.pushLocale === "string" ? prefs.pushLocale : "fr"] ?? COPY.fr;

      const result = await messaging.sendEachForMulticast({
        tokens,
        notification: { title: copy.title, body: copy.body(remaining) },
        // Deep-link géré par pushService.initDeepLinks côté app.
        data: { url: "/profile" },
        apns: { payload: { aps: { sound: "default" } } },
      });
      sent += result.successCount;

      const invalidTokens = result.responses
        .map((r, i) => (r.error && INVALID_TOKEN_CODES.has(r.error.code) ? tokens[i] : null))
        .filter((t): t is string => t !== null);
      if (invalidTokens.length > 0) {
        await docSnap.ref.update({ fcmTokens: FieldValue.arrayRemove(...invalidTokens) });
      }
    }

    logger.info(`dailyReadingReminder: ${sent} notification(s) envoyée(s) sur ${snap.size} profil(s).`);
  },
);
