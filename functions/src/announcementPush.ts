/**
 * Les informations de l'équipe, la partie pure : décider si une annonce doit
 * partir en notification, et composer un message par langue. Sans dépendance
 * à firebase-functions, pour être testée depuis les tests unitaires du site
 * (src/__tests__), comme feedbackNotion.
 */

/** Les langues de l'app, chacune avec son canal FCM (voir src/services/announcementTopics.ts). */
export const ANNOUNCEMENT_LOCALES = ["fr", "en", "he"] as const;
export type AnnouncementLocale = (typeof ANNOUNCEMENT_LOCALES)[number];

/** Le canal FCM d'une langue : l'app s'y abonne au lancement. */
export function announcementTopic(locale: AnnouncementLocale): string {
  return `announcements-${locale}`;
}

/** Longueur du texte d'une notification : au-delà, le système le coupe de toute façon. */
const BODY_MAX = 180;

/** Ce que la fonction lit du document ; tout le reste est ignoré. */
export interface AnnouncementPushData {
  published?: unknown;
  notify?: unknown;
  notifiedAt?: unknown;
  title?: unknown;
  body?: unknown;
}

/**
 * Une annonce part en notification une fois, quand elle est publiée avec la
 * case cochée. `notifiedAt` est posé avant l'envoi (voir announcements.ts) :
 * une annonce corrigée ensuite ne repart pas.
 */
export function shouldNotify(data: AnnouncementPushData | undefined): boolean {
  if (!data) return false;
  return data.published === true && data.notify === true && data.notifiedAt == null;
}

/** Le texte d'une langue, le français à défaut : il est le seul obligatoire. */
function pick(text: unknown, locale: AnnouncementLocale): string {
  if (!text || typeof text !== "object") return "";
  const map = text as Record<string, unknown>;
  const own = map[locale];
  if (typeof own === "string" && own.trim()) return own.trim();
  const fr = map.fr;
  return typeof fr === "string" ? fr.trim() : "";
}

/** Le début du texte, sur une ligne, coupé au dernier mot entier. */
export function excerpt(text: string, max = BODY_MAX): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export interface AnnouncementMessage {
  topic: string;
  notification: { title: string; body: string };
  data: { url: string };
  apns: { payload: { aps: { sound: string } } };
}

/**
 * Un message par langue, vers son canal. Une langue sans traduction reçoit le
 * texte français : l'annonce est de toute façon lisible en français dans
 * l'app, mieux vaut prévenir que se taire. Toucher la notification ouvre
 * l'annonce (pushService suit `data.url`).
 */
export function buildAnnouncementMessages(
  id: string,
  data: AnnouncementPushData,
): AnnouncementMessage[] {
  const url = `/informations/${encodeURIComponent(id)}`;
  return ANNOUNCEMENT_LOCALES.flatMap((locale) => {
    const title = pick(data.title, locale);
    if (!title) return [];
    return [
      {
        topic: announcementTopic(locale),
        notification: { title, body: excerpt(pick(data.body, locale)) },
        data: { url },
        apns: { payload: { aps: { sound: "default" } } },
      },
    ];
  });
}
