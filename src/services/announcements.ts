import { isOutdated } from "./appUpdateService";
import type { IconName } from "../components/icons/registry";

/**
 * Les informations de l'équipe : nouveautés, notes de version, incidents en
 * cours, questions posées aux utilisateurs. Elles vivent dans Firestore
 * (`announcements`), s'écrivent depuis le backoffice (/admin/informations)
 * et se lisent sans mise à jour de l'app (voir docs/informations.md).
 *
 * Ce module ne tient que la partie pure : les types, le choix de la langue,
 * ce qui est nouveau et ce que l'accueil met en avant. Pas d'import de
 * Firestore ici : l'accueil s'en sert, et le bundle initial n'en veut pas
 * (voir initialBundle.test.ts). La lecture vit dans announcementService.
 */

export type AnnouncementKind = "news" | "release" | "incident" | "question";
export const ANNOUNCEMENT_KINDS: AnnouncementKind[] = ["news", "release", "incident", "question"];

/** Le dessin de chaque nature, le même dans la liste, l'accueil et le backoffice. */
export const ANNOUNCEMENT_ICONS: Record<AnnouncementKind, IconName> = {
  news: "lightbulb",
  release: "rocket",
  incident: "alert-triangle",
  question: "help",
};

/** Un texte par langue ; seul le français est obligatoire, il sert de repli. */
export type LocalizedText = { fr: string } & Partial<Record<"en" | "he", string>>;

export interface Announcement {
  id: string;
  kind: AnnouncementKind;
  title: LocalizedText;
  body: LocalizedText;
  published: boolean;
  /** Posée à la première publication, elle ordonne la liste. */
  publishedAt: Date | null;
  updatedAt: Date | null;
  /** Une page de l'app où aller (« /bibliotheque/sidour »), ou une adresse externe. */
  link: { url: string; label: LocalizedText } | null;
  /** Notes de version : la version de l'app qu'elles décrivent (« 3.11.0 »). */
  version: string | null;
  /** Incident : réglé. Tant qu'il ne l'est pas, l'accueil le montre. */
  resolved: boolean;
  /** Partir en notification à la publication (une fois, voir functions/src/announcements.ts). */
  notify: boolean;
  /** Posée par la Cloud Function au moment de l'envoi. */
  notifiedAt: Date | null;
}

/** Le texte dans la langue de l'interface, le français à défaut. */
export function localized(text: LocalizedText | null | undefined, locale: string): string {
  if (!text) return "";
  const own = (text as Record<string, string | undefined>)[locale];
  return own?.trim() ? own : text.fr;
}

/**
 * Sans trace de visite (premier lancement, stockage effacé), seules les
 * annonces de ces derniers jours comptent comme nouvelles : un nouvel
 * utilisateur n'a pas à trouver deux ans d'annonces « non lues ».
 */
export const FIRST_VISIT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Des notes de version ne concernent l'appareil qu'une fois la version
 * installée : annoncées pendant la revue des stores, elles décriraient ce que
 * l'app ne fait pas encore. Sur le site (`installed` nul), toujours.
 */
export function appliesToInstalled(a: Announcement, installed: string | null): boolean {
  if (a.kind !== "release" || !a.version || !installed) return true;
  return !isOutdated(installed, a.version);
}

/** Publiée depuis la dernière visite de la liste ? */
export function isNew(a: Announcement, seenAt: number | null, now = Date.now()): boolean {
  if (!a.publishedAt) return false;
  const since = seenAt ?? now - FIRST_VISIT_WINDOW_MS;
  return a.publishedAt.getTime() > since;
}

/** Les annonces nouvelles pour cet appareil, la plus récente d'abord. */
export function unreadAnnouncements(
  items: Announcement[],
  seenAt: number | null,
  installed: string | null,
  now = Date.now(),
): Announcement[] {
  return items.filter((a) => isNew(a, seenAt, now) && appliesToInstalled(a, installed));
}

/**
 * Sur l'accueil, une annonce non lue se montre en aperçu (titre et début du
 * texte) pendant un mois au plus ; passé ce délai, elle n'a plus rien d'une
 * nouvelle et reste dans la liste.
 */
export const HOME_PREVIEW_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Une fois lue, une annonce récente reste une semaine sur l'accueil, en une
 * ligne : on sait que l'équipe a parlé, sans relire.
 */
export const HOME_RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Ce que l'accueil montre des informations, et sous quelle forme. */
export interface HomeHighlight {
  announcement: Announcement;
  /** « preview » : titre et début du texte ; « compact » : une ligne. */
  mode: "preview" | "compact";
  /** Annonces non lues (celle-ci comprise si elle l'est). */
  unreadCount: number;
}

/**
 * Ce que l'accueil montre, dans l'ordre (au plus deux cartes).
 *
 * Un incident en cours passe avant tout, lu ou non : il reste sur l'accueil
 * jusqu'à ce qu'il soit réglé, c'est ce qui évite dix fois le même
 * signalement. Non lu, il est en aperçu et compte les autres nouveautés ;
 * lu, il se réduit à une ligne et laisse la place, dessous, à la dernière
 * nouveauté non lue. Sans incident : la dernière annonce non lue en aperçu,
 * sinon la dernière de la semaine en une ligne, sinon rien.
 */
export function homeHighlights(
  items: Announcement[],
  seenAt: number | null,
  installed: string | null,
  now = Date.now(),
): HomeHighlight[] {
  const age = (a: Announcement) => now - (a.publishedAt?.getTime() ?? 0);
  const unread = unreadAnnouncements(items, seenAt, installed, now).filter(
    (a) => age(a) <= HOME_PREVIEW_MAX_AGE_MS,
  );
  const unreadCount = unread.length;

  const incident = items.find((a) => a.kind === "incident" && !a.resolved);
  if (incident) {
    if (unread.includes(incident))
      return [{ announcement: incident, mode: "preview", unreadCount }];
    const other = unread[0];
    return [
      { announcement: incident, mode: "compact", unreadCount },
      ...(other ? [{ announcement: other, mode: "preview" as const, unreadCount }] : []),
    ];
  }
  if (unread.length > 0) return [{ announcement: unread[0], mode: "preview", unreadCount }];

  const recent = items.find(
    (a) => a.publishedAt && age(a) <= HOME_RECENT_WINDOW_MS && appliesToInstalled(a, installed),
  );
  return recent ? [{ announcement: recent, mode: "compact", unreadCount: 0 }] : [];
}

/** Du plus récent au plus ancien ; une annonce sans date (brouillon) en tête. */
export function sortAnnouncements(items: Announcement[]): Announcement[] {
  const time = (a: Announcement) => a.publishedAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return [...items].sort((a, b) => time(b) - time(a));
}

/** Un lien de l'app (chemin) ou une adresse externe ? */
export function isExternalLink(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
