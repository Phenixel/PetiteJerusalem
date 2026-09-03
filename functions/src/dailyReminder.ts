/**
 * Rappels quotidiens de lecture par notification push (FCM).
 *
 * Toutes les 5 minutes (heure de Paris, audience du site), parcourt les
 * `userPreferences` dont `pushReminderEnabled` est vrai. Deux rappels
 * indépendants, tous deux conditionnés au fait que la liste de lecture du jour
 * ne soit pas terminée :
 *
 *  - à heure fixe (`pushReminderHour`/`pushReminderMinute`), le rappel
 *    historique ;
 *  - `SUNSET_OFFSET_MINUTES` avant la chkia (`pushSunsetReminderEnabled`), le
 *    dernier appel de qui n'a pas trouvé le temps de la journée. La chkia est
 *    calculée pour `pushReminderPlace`, le lieu (arrondi) que l'application a
 *    confié au moment de l'activation, à défaut, Paris.
 *
 * Les envois vont sur tous les appareils enregistrés (`fcmTokens`, alimentés
 * par l'app native via src/services/pushService.ts). Les tokens morts (app
 * désinstallée, rotation) sont purgés au fil des envois en échec.
 *
 * Prérequis hors code : clé APNs uploadée dans la console Firebase (iOS).
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { isInCurrentSlot, readPlace, SLOT_MINUTES, sunsetReminderAt } from "./sunsetReminder";

interface ReminderCopy {
  title: string;
  body: (remaining: number) => string;
}

// La langue est figée côté client au moment de l'activation (`pushLocale`).
const COPY: Record<string, { daily: ReminderCopy; sunset: ReminderCopy }> = {
  fr: {
    daily: {
      title: "Ta lecture du jour t'attend 📖",
      body: (n) =>
        n === 1
          ? "Il te reste 1 texte à lire aujourd'hui."
          : `Il te reste ${n} textes à lire aujourd'hui.`,
    },
    sunset: {
      title: "La chkia approche 🌅",
      body: (n) =>
        n === 1
          ? "Il te reste 1 texte à lire avant la fin du jour. N'oublie pas !"
          : `Il te reste ${n} textes à lire avant la fin du jour. N'oublie pas !`,
    },
  },
  en: {
    daily: {
      title: "Your daily reading is waiting 📖",
      body: (n) => (n === 1 ? "1 text left to read today." : `${n} texts left to read today.`),
    },
    sunset: {
      title: "Shkia is close 🌅",
      body: (n) =>
        n === 1
          ? "1 text left to read before the day ends. Don't forget!"
          : `${n} texts left to read before the day ends. Don't forget!`,
    },
  },
  he: {
    daily: {
      title: "הקריאה היומית שלך מחכה 📖",
      body: (n) => (n === 1 ? "נשאר לך טקסט אחד לקרוא היום." : `נשארו לך ${n} טקסטים לקרוא היום.`),
    },
    sunset: {
      title: "השקיעה מתקרבת 🌅",
      body: (n) =>
        n === 1
          ? "נשאר לך טקסט אחד לקרוא לפני סוף היום. אל תשכח!"
          : `נשארו לך ${n} טקסטים לקרוא לפני סוף היום. אל תשכח!`,
    },
  },
};

export const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

/**
 * Jour civil YYYY-MM-DD dans le fuseau du lieu de l'utilisateur : la même
 * convention que localDayKey() côté client, qui écrit la progression du jour
 * avec le jour LOCAL de l'appareil. Compter en heure de Paris jugeait périmée
 * la progression d'un lecteur en Israël ou en Amérique passé minuit à Paris,
 * et le rappel partait avec « il te reste N textes » alors que tout était lu.
 */
function todayKey(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

/** Heure courante ({ hour, minute }) dans le fuseau du lieu de l'utilisateur. */
function currentTime(timeZone: string, now: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    // h23, pas hour12: false : selon la version ICU, ce dernier peut donner
    // « 24 » à minuit, et un rappel réglé entre 00:00 et 00:55 ne partait jamais.
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { hour: get("hour"), minute: get("minute") };
}

const DEFAULT_REMINDER_HOUR = 18;
const DEFAULT_REMINDER_MINUTE = 0;

/** Cale une minute sur le créneau de 5 min en cours (17 → 15), pas du scheduler. */
function toSlot(minute: number): number {
  return Math.floor(minute / SLOT_MINUTES) * SLOT_MINUTES;
}

export const dailyReadingReminder = onSchedule(
  // Cinq minutes de marge : au créneau de 18 h, le plus choisi, quelques
  // centaines de profils dépassaient les 60 s par défaut, et les suivants
  // n'étaient jamais servis.
  { schedule: "*/5 * * * *", timeZone: "Europe/Paris", timeoutSeconds: 300 },
  async () => {
    const db = getFirestore();
    const snap = await db
      .collection("userPreferences")
      .where("pushReminderEnabled", "==", true)
      .get();
    if (snap.empty) return;

    const messaging = getMessaging();
    const nowDate = new Date();
    let sent = 0;

    for (const docSnap of snap.docs) {
      // Un profil en échec (FCM, réseau) ne doit pas priver tous les suivants.
      try {
        sent += await remindProfile(docSnap, messaging, nowDate);
      } catch (error) {
        logger.error(`dailyReadingReminder: profil ${docSnap.id} en échec`, error);
      }
    }

    logger.info(
      `dailyReadingReminder: ${sent} notification(s) envoyée(s) sur ${snap.size} profil(s).`,
    );
  },
);

/** Envoie le rappel dû à un profil, s'il y en a un ; renvoie le nombre d'envois réussis. */
async function remindProfile(
  docSnap: FirebaseFirestore.QueryDocumentSnapshot,
  messaging: ReturnType<typeof getMessaging>,
  nowDate: Date,
): Promise<number> {
  const prefs = docSnap.data();
  const place = readPlace(prefs.pushReminderPlace);
  const today = todayKey(place.tzid, nowDate);
  const now = currentTime(place.tzid, nowDate);
  const currentSlot = toSlot(now.minute);

  // Rappel à heure fixe. Absent des profils antérieurs au rappel
  // d'avant-chkia, où il était le seul : son absence vaut « activé ».
  const wantedHour =
    typeof prefs.pushReminderHour === "number" ? prefs.pushReminderHour : DEFAULT_REMINDER_HOUR;
  const wantedMinute =
    typeof prefs.pushReminderMinute === "number"
      ? toSlot(prefs.pushReminderMinute)
      : DEFAULT_REMINDER_MINUTE;
  const dailyDue =
    prefs.pushReminderDailyEnabled !== false &&
    wantedHour === now.hour &&
    wantedMinute === currentSlot;

  // Dernier appel avant la chkia du lieu de l'utilisateur.
  let sunsetDue = false;
  if (prefs.pushSunsetReminderEnabled === true) {
    const target = sunsetReminderAt(place, nowDate);
    sunsetDue = target !== null && isInCurrentSlot(target, nowDate);
  }

  if (!dailyDue && !sunsetDue) return 0;

  const tokens: string[] = Array.isArray(prefs.fcmTokens)
    ? prefs.fcmTokens.filter((t: unknown): t is string => typeof t === "string" && t.length > 0)
    : [];
  const readingIds = (Array.isArray(prefs.dailyReadingIds) ? prefs.dailyReadingIds : []).map(
    String,
  );
  // Lectures du moment quotidiennes : comptent comme les textes. La paracha
  // (chnei mikra) est un suivi hebdomadaire, hors du décompte du jour.
  const readingOptions: unknown[] = (
    Array.isArray(prefs.dailyReadingOptions) ? prefs.dailyReadingOptions : []
  ).filter((k: unknown) => k !== "parasha");
  const totalReadings = readingIds.length + readingOptions.length;
  if (tokens.length === 0 || totalReadings === 0) return 0;

  const progress = prefs.dailyReadingProgress as
    | { date?: string; completedIds?: unknown[]; completedOptions?: unknown[] }
    | undefined;
  const isToday = progress?.date === today;
  // Même règle que countDailyProgress (src/services/userPreferencesService.ts) :
  // on intersecte les complétions avec les listes actives, une entrée
  // obsolète (texte retiré, option désactivée) ne doit pas annuler le rappel.
  const completedIds = new Set(
    (isToday && Array.isArray(progress.completedIds) ? progress.completedIds : []).map(String),
  );
  const completedOptions = new Set(
    isToday && Array.isArray(progress.completedOptions) ? progress.completedOptions : [],
  );
  const completedToday =
    readingIds.filter((id) => completedIds.has(id)).length +
    readingOptions.filter((k) => completedOptions.has(k)).length;
  const remaining = totalReadings - completedToday;
  if (remaining <= 0) return 0;

  const locale = COPY[typeof prefs.pushLocale === "string" ? prefs.pushLocale : "fr"] ?? COPY.fr;
  // Les deux rappels dans le même créneau : c'est l'échéance de la chkia
  // qui a quelque chose de plus à dire, et une seule notification part.
  const copy = sunsetDue ? locale.sunset : locale.daily;

  const result = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: copy.title, body: copy.body(remaining) },
    // Deep-link géré par pushService.initDeepLinks côté app.
    data: { url: "/bibliotheque/lecture-du-jour" },
    apns: { payload: { aps: { sound: "default" } } },
  });
  const invalidTokens = result.responses
    .map((r, i) => (r.error && INVALID_TOKEN_CODES.has(r.error.code) ? tokens[i] : null))
    .filter((t): t is string => t !== null);
  if (invalidTokens.length > 0) {
    await docSnap.ref.update({ fcmTokens: FieldValue.arrayRemove(...invalidTokens) });
  }
  return result.successCount;
}
