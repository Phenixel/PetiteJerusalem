import { isOutdated } from "./appUpdateService";
import { SITE_URL } from "../config/site";
import { isNativeApp } from "../composables/useNativeApp";
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

/** Un choix d'un sondage. Son `id` ne change pas : les votes le désignent. */
export interface PollOption {
  id: string;
  label: LocalizedText;
  /** Une image à montrer avec le choix (adresse publique), facultative. */
  image: string | null;
}

/**
 * Un sondage, porté par une information de nature « question ». Les versions
 * de l'app qui ne le connaissent pas lisent la question seule, avec le lien
 * vers la page du site où l'on vote (voir pollFallbackLink).
 */
export interface Poll {
  options: PollOption[];
  /** Plusieurs choix permis ; sinon un seul. */
  multiple: boolean;
  /** Clos : les choix restent lisibles, on ne vote plus. */
  closed: boolean;
}

/**
 * Le sondage tel qu'il s'enregistre : avec la liste de ses identifiants de
 * choix (`optionIds`), contre laquelle les règles Firestore vérifient chaque
 * vote. Les règles ne savent pas parcourir une liste d'objets ; sans cette
 * liste, un vote pourrait porter n'importe quoi.
 */
export function pollToStore(poll: Poll): Poll & { optionIds: string[] } {
  return { ...poll, optionIds: poll.options.map((o) => o.id) };
}

/** De quoi proposer un vrai choix, sans noyer la question. */
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 8;

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
  /**
   * Incident : la version de l'app qui le corrige. Un appareil qui l'a n'est
   * plus concerné (voir fixedOnDevice). Un champ à part, et non `version` :
   * les versions publiées avant lui l'ignorent sans rien afficher de faux.
   */
  fixedIn: string | null;
  /** Incident : réglé pour tous. Tant qu'il ne l'est pas, l'accueil le montre. */
  resolved: boolean;
  /** Question : les choix proposés, s'il y en a. */
  poll: Poll | null;
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
 *
 * Un incident corrigé sur cet appareil ne le concerne plus : il n'y est ni
 * nouveau, ni mis en avant.
 */
export function appliesToInstalled(a: Announcement, installed: string | null): boolean {
  if (fixedOnDevice(a, installed)) return false;
  if (a.kind !== "release" || !a.version || !installed) return true;
  return !isOutdated(installed, a.version);
}

/** Une version de l'app telle qu'un correctif se note : X.Y.Z, un « v » devant toléré. */
export const FIX_VERSION_PATTERN = /^v?\d+\.\d+\.\d+$/i;

/**
 * Un incident qui porte la version de son correctif est réglé là où cette
 * version est installée : qui a fait la mise à jour n'a plus à le lire sur
 * son accueil. Le site (`installed` nul) est toujours à la dernière version.
 *
 * Dans l'app, `installed` nul veut dire que la version n'est pas encore lue
 * (ou n'a pas pu l'être) : l'incident y reste en cours, c'est le côté sûr.
 * Une version de correctif illisible ne corrige rien : `isOutdated` la
 * dirait atteinte partout, et l'incident disparaîtrait chez tout le monde.
 */
export function fixedOnDevice(
  a: Announcement,
  installed: string | null,
  native: boolean = isNativeApp,
): boolean {
  if (a.kind !== "incident" || !a.fixedIn || !FIX_VERSION_PATTERN.test(a.fixedIn)) return false;
  if (!installed) return !native;
  return !isOutdated(installed, a.fixedIn);
}

/** Un incident encore en cours pour cet appareil : ni réglé pour tous, ni corrigé ici. */
export function isOngoingIncident(a: Announcement, installed: string | null): boolean {
  return a.kind === "incident" && !a.resolved && !fixedOnDevice(a, installed);
}

/** Publiée depuis la dernière visite de la liste ? */
export function isNew(a: Announcement, seenAt: number | null, now = Date.now()): boolean {
  if (!a.publishedAt) return false;
  const since = seenAt ?? now - FIRST_VISIT_WINDOW_MS;
  return a.publishedAt.getTime() > since;
}

/**
 * Une note de version publiée pendant la revue des stores est souvent vue
 * (la liste visitée) avant que sa version ne soit installée : la date de la
 * visite la dépassait, et la note ne revenait jamais comme nouvelle une fois
 * la version là. `seenVersion` est la version installée lors de la dernière
 * visite de la liste : une note d'une version plus récente, désormais
 * installée, est nouvelle quelle que soit sa date.
 */
function newSinceInstall(a: Announcement, installed: string | null, seenVersion: string | null) {
  return (
    a.kind === "release" &&
    !!a.version &&
    !!installed &&
    !!seenVersion &&
    isOutdated(seenVersion, a.version) &&
    appliesToInstalled(a, installed)
  );
}

/** Les annonces nouvelles pour cet appareil, la plus récente d'abord. */
export function unreadAnnouncements(
  items: Announcement[],
  seenAt: number | null,
  installed: string | null,
  now = Date.now(),
  seenVersion: string | null = null,
): Announcement[] {
  return items.filter(
    (a) =>
      (isNew(a, seenAt, now) && appliesToInstalled(a, installed)) ||
      newSinceInstall(a, installed, seenVersion),
  );
}

/**
 * Sur l'accueil, une annonce non lue se montre en aperçu (titre et début du
 * texte) pendant un mois au plus ; passé ce délai, elle n'a plus rien d'une
 * nouvelle et reste dans la liste. Un sondage ouvert sans réponse reste aussi
 * longtemps en une ligne, une fois lu.
 */
export const HOME_PREVIEW_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Une fois lue, une nouveauté ou une question reste une semaine sur
 * l'accueil, en une ligne : on sait que l'équipe a parlé, sans relire.
 */
export const HOME_RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Un sondage où l'on peut encore voter. */
export function isPollOpen(a: Announcement): boolean {
  return !!a.poll && !a.poll.closed;
}

/**
 * Ce qu'une information a encore à dire sur l'accueil de cet appareil,
 * selon sa nature :
 *
 * - un incident, tant qu'il est en cours ici (voir isOngoingIncident) ;
 * - un sondage, tant qu'il est ouvert et que l'appareil n'y a pas répondu ;
 * - le reste (nouveauté, note de version, question), toujours : c'est la
 *   lecture qui l'éteint, voir homeHighlights.
 */
function belongsOnHome(
  a: Announcement,
  installed: string | null,
  answered: ReadonlySet<string>,
): boolean {
  if (a.kind === "incident") return isOngoingIncident(a, installed);
  if (a.poll) return isPollOpen(a) && !answered.has(a.id);
  return true;
}

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
 * jusqu'à ce qu'il soit réglé (pour tous, ou sur cet appareil par la version
 * qui le corrige), c'est ce qui évite dix fois le même signalement. Non lu,
 * il est en aperçu et compte les autres nouveautés ; lu, il se réduit à une
 * ligne et laisse la place, dessous, à la dernière nouveauté non lue.
 *
 * Sans incident : la dernière annonce non lue en aperçu ; sinon, en une
 * ligne, un sondage ouvert pas encore répondu (un mois au plus), ou la
 * dernière nouveauté ou question de la semaine. Une note de version lue n'y
 * revient pas : elle n'a plus rien à dire à qui a la mise à jour. Un
 * sondage répondu ou clos, un incident réglé n'y paraissent plus du tout.
 */
export function homeHighlights(
  items: Announcement[],
  seenAt: number | null,
  installed: string | null,
  now = Date.now(),
  seenVersion: string | null = null,
  answered: ReadonlySet<string> = new Set(),
): HomeHighlight[] {
  const age = (a: Announcement) => now - (a.publishedAt?.getTime() ?? 0);
  const onHome = items.filter((a) => belongsOnHome(a, installed, answered));
  const unread = unreadAnnouncements(onHome, seenAt, installed, now, seenVersion).filter(
    (a) => age(a) <= HOME_PREVIEW_MAX_AGE_MS,
  );
  const unreadCount = unread.length;

  const incident = onHome.find((a) => a.kind === "incident");
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

  const recent = onHome.find(
    (a) =>
      a.kind !== "release" &&
      a.publishedAt &&
      age(a) <= (a.poll ? HOME_PREVIEW_MAX_AGE_MS : HOME_RECENT_WINDOW_MS) &&
      appliesToInstalled(a, installed),
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

/**
 * La page du site où voter, pour les versions de l'app qui ne savent pas
 * afficher un sondage. Hors des liens d'application (voir
 * scripts/lib/app-links.mjs, BROWSER_ONLY_PATHS) : sous `/informations`,
 * le lien rouvrirait l'app elle-même, sur une page sans les choix.
 */
export function pollPageUrl(id: string): string {
  return `${SITE_URL}/sondage/${id}`;
}

/** Le texte du bouton qui mène au vote, dans les trois langues. */
export const POLL_LINK_LABEL: LocalizedText = { fr: "Voter", en: "Vote", he: "להצבעה" };

/**
 * Le lien d'une information à enregistrer : un sondage sans lien reçoit celui
 * de sa page de vote, que liront les versions de l'app qui ne connaissent pas
 * les sondages ; ce lien retombe si le sondage est retiré. Un lien choisi par
 * l'équipe est gardé tel quel.
 */
export function linkWithPollPage(
  id: string,
  link: Announcement["link"],
  poll: Poll | null,
): Announcement["link"] {
  const own = link?.url === pollPageUrl(id);
  if (poll) return link && !own ? link : { url: pollPageUrl(id), label: POLL_LINK_LABEL };
  return own ? null : link;
}

/**
 * Le lien à montrer sous l'information : celui de la page de vote n'a pas
 * lieu d'être là où le sondage s'affiche déjà.
 */
export function visibleLink(a: Announcement): Announcement["link"] {
  return a.poll && a.link?.url === pollPageUrl(a.id) ? null : a.link;
}
