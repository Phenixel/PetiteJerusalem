/**
 * Nous écrire, côté client : la forme d'un fil (celle que rendent les Cloud
 * Functions, functions/src/support.ts, et celle que le backoffice lit dans
 * Firestore) et les petites règles qui s'en déduisent. Sans dépendance à
 * Firebase, pour être testé (src/__tests__/support.test.ts).
 */
import type { FeedbackKind } from "./feedbackService";

/**
 * Où en est un fil : à traiter, en cours, répondu, terminé. Les mêmes
 * colonnes que l'ancienne base Notion ; voir docs/feedback.md.
 */
export const SUPPORT_STATUSES = ["new", "in_progress", "answered", "done"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_KINDS: FeedbackKind[] = ["idea", "bug", "error", "other"];

export interface SupportMessageView {
  from: "user" | "team";
  text: string;
  /** En millisecondes. */
  at: number;
}

/** Un fil tel que la personne le relit : ni note de l'équipe, ni identifiants. */
export interface SupportThreadView {
  id: string;
  kind: FeedbackKind;
  otherKind: string;
  status: SupportStatus;
  /** Une réponse de l'équipe que la personne n'a pas encore ouverte. */
  unread: boolean;
  /** La personne a dit que c'était réglé (le fil est alors terminé). */
  resolvedByUser: boolean;
  createdAt: number;
  updatedAt: number;
  messages: SupportMessageView[];
  /** Ce que la personne a elle-même laissé ou envoyé, que sa fiche lui rappelle. */
  contact: string;
  support: "web" | "app";
  platform: "web" | "ios" | "android";
  version: string;
  page: string;
}

/** Un fil tel que le backoffice le lit : tout, la note de l'équipe comprise. */
export interface AdminSupportThread extends SupportThreadView {
  locale: string;
  uid: string | null;
  accountEmail: string | null;
  accountName: string | null;
  /** Écrit depuis l'app sans compte : seul l'appareil relit la réponse. */
  fromDevice: boolean;
  /** L'appareil sera prévenu de la réponse par une notification. */
  canNotify: boolean;
  note: string;
  lastFrom: "user" | "team";
}

/** Une date Firestore (Timestamp), une Date, un nombre : en millisecondes. */
export function millisOf(value: unknown): number {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  const maybe = value as { toMillis?: () => number } | null | undefined;
  if (typeof maybe?.toMillis === "function") return maybe.toMillis();
  return 0;
}

const str = (value: unknown): string => (typeof value === "string" ? value : "");

/** Lit un document `support/{id}` pour le backoffice ; un champ absent ne casse rien. */
export function parseAdminThread(id: string, doc: Record<string, unknown>): AdminSupportThread {
  const messages = Array.isArray(doc.messages) ? doc.messages : [];
  const status = (SUPPORT_STATUSES as readonly unknown[]).includes(doc.status)
    ? (doc.status as SupportStatus)
    : "new";
  const kind = (SUPPORT_KINDS as unknown[]).includes(doc.kind)
    ? (doc.kind as FeedbackKind)
    : "other";
  const pushTokens = Array.isArray(doc.pushTokens) ? doc.pushTokens : [];
  const uid = str(doc.uid) || null;
  return {
    id,
    kind,
    otherKind: str(doc.otherKind),
    status,
    unread: doc.unreadByUser === true,
    resolvedByUser: doc.resolvedByUser === true,
    createdAt: millisOf(doc.createdAt),
    updatedAt: millisOf(doc.updatedAt),
    messages: messages
      .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
      .map((m) => ({
        from: m.from === "team" ? "team" : "user",
        text: str(m.text),
        at: millisOf(m.at),
      })),
    contact: str(doc.contact),
    support: doc.support === "app" ? "app" : "web",
    platform: doc.platform === "ios" || doc.platform === "android" ? doc.platform : "web",
    version: str(doc.version),
    locale: str(doc.locale) || "fr",
    page: str(doc.page),
    uid,
    accountEmail: str(doc.accountEmail) || null,
    accountName: str(doc.accountName) || null,
    fromDevice: !uid && !!str(doc.guestKeyHash),
    canNotify: pushTokens.length > 0 || !!uid,
    note: str(doc.note),
    lastFrom: doc.lastFrom === "team" ? "team" : "user",
  };
}

/**
 * Le premier message : ce dont il s'agit, la ligne qu'on lit dans une liste.
 * Trop long, il se coupe sur le dernier mot entier, jamais au milieu d'un mot.
 */
export function threadSubject(thread: Pick<SupportThreadView, "messages">, max = 140): string {
  const first = thread.messages[0]?.text ?? "";
  const flat = first.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

/** Un email si la valeur en a la forme (un contact peut aussi être un téléphone). */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * L'adresse où répondre aussi par email : le contact laissé s'il en est un,
 * sinon l'email du compte. Rien pour un invité sans contact : la réponse ne
 * se lira que dans l'app.
 */
export function replyEmail(
  thread: Pick<AdminSupportThread, "contact" | "accountEmail">,
): string | null {
  if (isEmail(thread.contact)) return thread.contact;
  return thread.accountEmail && isEmail(thread.accountEmail) ? thread.accountEmail : null;
}

/** Le lien qui ouvre la messagerie, la réponse déjà écrite et le message cité. */
export function mailtoReply(
  email: string,
  subject: string,
  reply: string,
  original: string,
): string {
  const quoted = original
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  const body = reply ? `${reply}\n\n${quoted}` : quoted;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * L'ordre du backoffice : ce qui attend l'équipe d'abord (à traiter, puis en
 * cours), le plus récemment actif en tête de chaque groupe.
 */
export function sortForTeam<T extends Pick<SupportThreadView, "status" | "updatedAt">>(
  threads: T[],
): T[] {
  const rank: Record<SupportStatus, number> = { new: 0, in_progress: 1, answered: 2, done: 3 };
  return [...threads].sort((a, b) => rank[a.status] - rank[b.status] || b.updatedAt - a.updatedAt);
}

/** Le nombre de fils où une réponse de l'équipe attend la personne. */
export function unreadCount(threads: Pick<SupportThreadView, "unread">[]): number {
  return threads.filter((t) => t.unread).length;
}

/** Le dernier message de l'équipe, s'il y en a un : l'aperçu d'une carte. */
export function lastTeamMessage(
  thread: Pick<SupportThreadView, "messages">,
): SupportMessageView | null {
  return [...thread.messages].reverse().find((m) => m.from === "team") ?? null;
}
