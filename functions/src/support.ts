/**
 * Les messages des utilisateurs, la partie pure : valider ce que le client
 * envoie, composer le fil de discussion rangé dans Firestore (`support/{id}`),
 * en tirer ce que la personne a le droit de relire, et la notification qui
 * part quand l'équipe répond. Sans dépendance à firebase-functions, pour être
 * testée depuis les tests unitaires du site (src/__tests__/support.test.ts).
 *
 * Voir docs/feedback.md.
 */

/** Les valeurs acceptées du client, et leur libellé (journaux, backoffice). */
export const KINDS = {
  idea: "Nouvelle idée",
  bug: "Bug",
  error: "Erreur",
  other: "Autre",
} as const;
export const SUPPORTS = { web: "Web", app: "Application" } as const;
export const PLATFORMS = { web: "Web", ios: "iOS", android: "Android" } as const;
export const LOCALES = ["fr", "en", "he"] as const;

export type FeedbackKind = keyof typeof KINDS;
export type FeedbackSupport = keyof typeof SUPPORTS;
export type FeedbackPlatform = keyof typeof PLATFORMS;
export type SupportLocale = (typeof LOCALES)[number];

/**
 * Où en est un fil, comme les colonnes de l'ancienne base Notion :
 * - `new` : à traiter (un message arrivé, ou une relance de la personne) ;
 * - `in_progress` : en cours, l'équipe s'en occupe ;
 * - `answered` : l'équipe a répondu, la balle est chez la personne ;
 * - `done` : terminé (corrigé, ajouté, ou rien à faire).
 */
export const STATUSES = ["new", "in_progress", "answered", "done"] as const;
export type SupportStatus = (typeof STATUSES)[number];

/** Un message du fil : de la personne, ou de l'équipe. */
export interface SupportMessage<T = Date> {
  from: "user" | "team";
  text: string;
  at: T;
}

/** Le premier message, tel que le client l'envoie, une fois validé. */
export interface FeedbackInput {
  kind: FeedbackKind;
  /** Précision libre quand `kind` vaut « other ». */
  otherKind: string;
  details: string;
  /** Email ou numéro de téléphone, vide si la personne ne l'a pas laissé. */
  contact: string;
  support: FeedbackSupport;
  platform: FeedbackPlatform;
  version: string;
  /** Langue de l'app : celle de la notification de réponse. */
  locale: SupportLocale;
  /** La page d'où le message est parti (« /lire/tehilim »), vide si inconnue. */
  page: string;
  /**
   * La clé de l'appareil (app sans compte) : tirée au hasard et gardée sur
   * le téléphone, elle seule permet de relire le fil. Vide sur le site, et
   * dans les versions de l'app d'avant les fils.
   */
  guestKey: string;
  /** Le jeton FCM de l'appareil, pour prévenir de la réponse, vide sinon. */
  pushToken: string;
}

/** Une relance de la personne dans un fil existant. */
export interface ReplyInput {
  threadId: string;
  text: string;
  guestKey: string;
  pushToken: string;
}

/** Un message a droit à 2000 caractères (la borne de l'ancien formulaire). */
export const TEXT_MAX = 2000;
const OTHER_MAX = 200;
const CONTACT_MAX = 200;
const VERSION_MAX = 60;
const PAGE_MAX = 300;
const TOKEN_MAX = 4096;
/** Au-delà, le fil est clos : on en ouvre un autre (et le document reste petit). */
export const MESSAGES_MAX = 60;
/** Les jetons d'appareil gardés sur un fil (un même invité, plusieurs lancements). */
const PUSH_TOKENS_MAX = 5;

/** Un envoi refusé : le callable la traduit en `invalid-argument`. */
export class FeedbackValidationError extends Error {}

function asTrimmedString(value: unknown, field: string, max: number, required = false): string {
  if (value == null) {
    if (required) throw new FeedbackValidationError(`Champ requis : ${field}.`);
    return "";
  }
  if (typeof value !== "string" || value.length > max) {
    throw new FeedbackValidationError(`Champ invalide : ${field}.`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new FeedbackValidationError(`Champ requis : ${field}.`);
  }
  return trimmed;
}

function asKey<T extends Record<string, string>>(value: unknown, table: T, field: string): keyof T {
  if (typeof value !== "string" || !Object.prototype.hasOwnProperty.call(table, value)) {
    throw new FeedbackValidationError(`Champ invalide : ${field}.`);
  }
  return value;
}

/** La clé d'un appareil : de 32 à 128 caractères sans espace ni ponctuation. */
function asGuestKey(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(value)) {
    throw new FeedbackValidationError("Champ invalide : guestKey.");
  }
  return value;
}

/** Le jeton FCM d'un appareil, facultatif : un jeton illisible est ignoré. */
function asPushToken(value: unknown): string {
  return typeof value === "string" && value.length <= TOKEN_MAX ? value.trim() : "";
}

/** La clé d'appareil passée à une lecture (`listSupportThreads`). */
export function parseGuestKey(data: unknown): string {
  const raw = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return asGuestKey(raw.guestKey);
}

/** Une langue inconnue n'est pas une erreur : le français, à défaut. */
function asLocale(value: unknown): SupportLocale {
  return (LOCALES as readonly unknown[]).includes(value) ? (value as SupportLocale) : "fr";
}

/** Un chemin de l'app, rien d'autre (pas d'adresse d'un autre site). */
function asPage(value: unknown): string {
  if (typeof value !== "string") return "";
  const page = value.trim().slice(0, PAGE_MAX);
  return page.startsWith("/") && !page.startsWith("//") ? page : "";
}

/**
 * Valide et normalise le premier message. Les champs apparus avec les fils
 * (`locale`, `page`, `guestKey`, `pushToken`) sont facultatifs : une app
 * installée avant eux continue d'envoyer sans.
 */
export function parseFeedback(data: unknown): FeedbackInput {
  const raw = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const kind = asKey(raw.kind, KINDS, "kind");
  const otherKind = kind === "other" ? asTrimmedString(raw.otherKind, "otherKind", OTHER_MAX) : "";
  const details = asTrimmedString(raw.details, "details", TEXT_MAX, true);
  const contact = asTrimmedString(raw.contact, "contact", CONTACT_MAX);
  const support = asKey(raw.support, SUPPORTS, "support");
  const platform = asKey(raw.platform, PLATFORMS, "platform");
  const version = asTrimmedString(raw.version, "version", VERSION_MAX);
  return {
    kind,
    otherKind,
    details,
    contact,
    support,
    platform,
    version,
    locale: asLocale(raw.locale),
    page: asPage(raw.page),
    guestKey: asGuestKey(raw.guestKey),
    pushToken: asPushToken(raw.pushToken),
  };
}

/** Valide une relance : le fil visé, le texte, et la clé de l'appareil s'il y en a une. */
export function parseReply(data: unknown): ReplyInput {
  const raw = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const threadId = asTrimmedString(raw.threadId, "threadId", 100, true);
  if (!/^[A-Za-z0-9_-]+$/.test(threadId)) {
    throw new FeedbackValidationError("Champ invalide : threadId.");
  }
  return {
    threadId,
    text: asTrimmedString(raw.text, "text", TEXT_MAX, true),
    guestKey: asGuestKey(raw.guestKey),
    pushToken: asPushToken(raw.pushToken),
  };
}

/** Le fil visé par la personne, et la clé de son appareil s'il y en a une. */
export function parseThreadRef(data: unknown): { threadId: string; guestKey: string } {
  const raw = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const threadId = asTrimmedString(raw.threadId, "threadId", 100, true);
  if (!/^[A-Za-z0-9_-]+$/.test(threadId)) {
    throw new FeedbackValidationError("Champ invalide : threadId.");
  }
  return { threadId, guestKey: asGuestKey(raw.guestKey) };
}

/** Un email si la valeur en a la forme ; sinon c'est un numéro de téléphone. */
export function isEmail(contact: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
}

/** Qui écrit : le compte connecté, ou l'appareil (empreinte de sa clé). */
export interface SupportIdentity {
  uid: string | null;
  accountEmail: string | null;
  accountName: string | null;
  /** L'empreinte SHA-256 de la clé de l'appareil : la clé elle-même n'est pas gardée. */
  guestKeyHash: string | null;
}

/** Le document `support/{id}` tel qu'il est créé. `T` : le type des dates. */
export interface SupportThreadDoc<T = Date> {
  kind: FeedbackKind;
  otherKind: string;
  contact: string;
  support: FeedbackSupport;
  platform: FeedbackPlatform;
  version: string;
  locale: SupportLocale;
  page: string;
  uid: string | null;
  accountEmail: string | null;
  accountName: string | null;
  guestKeyHash: string | null;
  pushTokens: string[];
  status: SupportStatus;
  /** Note de l'équipe, jamais montrée à la personne. */
  note: string;
  messages: SupportMessage<T>[];
  lastFrom: "user" | "team";
  /** Une réponse de l'équipe que la personne n'a pas encore ouverte. */
  unreadByUser: boolean;
  /**
   * La personne a dit que c'était réglé (le fil est alors « terminé »). Une
   * nouvelle réponse, de l'équipe ou d'elle, l'efface. Absent des fils
   * d'avant : lu comme faux.
   */
  resolvedByUser: boolean;
  createdAt: T;
  updatedAt: T;
}

export function newThread(
  input: FeedbackInput,
  identity: SupportIdentity,
  now: Date,
): SupportThreadDoc {
  return {
    kind: input.kind,
    otherKind: input.otherKind,
    contact: input.contact,
    support: input.support,
    platform: input.platform,
    version: input.version,
    locale: input.locale,
    page: input.page,
    ...identity,
    pushTokens: input.pushToken ? [input.pushToken] : [],
    status: "new",
    note: "",
    messages: [{ from: "user", text: input.details, at: now }],
    lastFrom: "user",
    unreadByUser: false,
    resolvedByUser: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Ce que l'appelant a le droit de relire : son compte, ou la clé de son appareil. */
export function ownsThread(
  thread: { uid?: unknown; guestKeyHash?: unknown },
  uid: string | null,
  guestKeyHash: string | null,
): boolean {
  if (uid && thread.uid === uid) return true;
  return guestKeyHash !== null && thread.guestKeyHash === guestKeyHash;
}

/**
 * La relance de la personne : le message s'ajoute, et le fil revient « à
 * traiter », sauf s'il était déjà en cours. Un fil plein refuse.
 */
export function userReplyPatch(
  thread: Pick<SupportThreadDoc<unknown>, "status" | "messages">,
  text: string,
  now: Date,
  pushToken = "",
  knownTokens: string[] = [],
): {
  message: SupportMessage;
  status: SupportStatus;
  lastFrom: "user";
  updatedAt: Date;
  resolvedByUser: false;
  pushTokens?: string[];
} {
  if (thread.messages.length >= MESSAGES_MAX) {
    throw new FeedbackValidationError("Fil complet : écrivez un nouveau message.");
  }
  const tokens =
    pushToken && !knownTokens.includes(pushToken)
      ? [pushToken, ...knownTokens].slice(0, PUSH_TOKENS_MAX)
      : null;
  return {
    message: { from: "user", text, at: now },
    status: thread.status === "in_progress" ? "in_progress" : "new",
    lastFrom: "user",
    updatedAt: now,
    resolvedByUser: false,
    ...(tokens ? { pushTokens: tokens } : {}),
  };
}

/**
 * La personne dit que c'est réglé : le fil passe « terminé », et l'équipe voit
 * que c'est elle qui l'a clos. Rien ne s'ajoute au fil : écrire de nouveau le
 * rouvre (userReplyPatch).
 */
export function userResolvePatch(now: Date): {
  status: "done";
  resolvedByUser: true;
  resolvedAt: Date;
} {
  return { status: "done", resolvedByUser: true, resolvedAt: now };
}

/** Une date Firestore (Timestamp), une Date, ou rien : en millisecondes. */
export function millisOf(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  const maybe = value as { toMillis?: () => number } | null | undefined;
  if (typeof maybe?.toMillis === "function") return maybe.toMillis();
  return 0;
}

/** Un fil vu par la personne : ni la note de l'équipe, ni les clés, ni les jetons. */
export interface PublicThread {
  id: string;
  kind: FeedbackKind;
  otherKind: string;
  status: SupportStatus;
  unread: boolean;
  /** La personne a dit que c'était réglé. */
  resolvedByUser: boolean;
  createdAt: number;
  updatedAt: number;
  messages: SupportMessage<number>[];
  /** Ce que la personne a elle-même laissé ou envoyé : sa fiche le lui rappelle. */
  contact: string;
  support: FeedbackSupport;
  platform: FeedbackPlatform;
  version: string;
  page: string;
}

export function publicThread(id: string, doc: Record<string, unknown>): PublicThread {
  const messages = Array.isArray(doc.messages) ? doc.messages : [];
  const status = (STATUSES as readonly unknown[]).includes(doc.status)
    ? (doc.status as SupportStatus)
    : "new";
  return {
    id,
    kind: Object.prototype.hasOwnProperty.call(KINDS, doc.kind as string)
      ? (doc.kind as FeedbackKind)
      : "other",
    otherKind: typeof doc.otherKind === "string" ? doc.otherKind : "",
    status,
    unread: doc.unreadByUser === true,
    resolvedByUser: doc.resolvedByUser === true,
    createdAt: millisOf(doc.createdAt),
    updatedAt: millisOf(doc.updatedAt),
    messages: messages
      .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
      .map((m) => ({
        from: m.from === "team" ? "team" : "user",
        text: typeof m.text === "string" ? m.text : "",
        at: millisOf(m.at),
      })),
    contact: typeof doc.contact === "string" ? doc.contact : "",
    support: doc.support === "app" ? "app" : "web",
    platform: doc.platform === "ios" || doc.platform === "android" ? doc.platform : "web",
    version: typeof doc.version === "string" ? doc.version : "",
    page: typeof doc.page === "string" ? doc.page : "",
  };
}

/**
 * Ce que la lecture marque lu : tout (`true`), un seul fil (son identifiant,
 * celui que la personne ouvre), ou rien.
 */
export function readScope(value: unknown): "all" | string | null {
  if (value === true) return "all";
  if (typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value)) return value;
  return null;
}

/** Les fils d'une personne, le plus récemment actif en tête. */
export function sortThreads(threads: PublicThread[]): PublicThread[] {
  return [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
}

function teamMessageCount(doc: Record<string, unknown> | undefined): number {
  const messages = Array.isArray(doc?.messages) ? doc.messages : [];
  return messages.filter((m) => (m as { from?: unknown })?.from === "team").length;
}

/**
 * L'écriture qui prévient la personne : celle qui AJOUTE une réponse de
 * l'équipe. Changer un statut, une note, ou la relance de la personne
 * n'envoie rien.
 */
export function isTeamReplyTransition(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): boolean {
  if (!after) return false;
  return teamMessageCount(after) > teamMessageCount(before);
}

const REPLY_TITLES: Record<SupportLocale, string> = {
  fr: "Petite Jérusalem vous a répondu",
  en: "Petite Jérusalem replied to you",
  he: "פטיט ירושלים השיבו לך",
};

/** Longueur du texte d'une notification : au-delà, le système le coupe de toute façon. */
const BODY_MAX = 180;

function excerpt(text: string, max = BODY_MAX): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** La page de l'app où se lisent les fils ; chaque fil a la sienne dessous. */
export const SUPPORT_PAGE = "/contact";

/** La page d'un fil : la notification de réponse y mène tout droit. */
export function supportThreadPath(threadId: string): string {
  return `${SUPPORT_PAGE}/${encodeURIComponent(threadId)}`;
}

export interface ReplyNotification {
  tokens: string[];
  notification: { title: string; body: string };
  data: { url: string };
  apns: { payload: { aps: { sound: string } } };
}

/**
 * La notification de la dernière réponse de l'équipe, vers les appareils
 * connus (ceux du fil, ceux du compte), dans la langue du fil ; la toucher
 * ouvre la page du fil. Rien si aucun appareil n'est connu : la réponse
 * attend dans l'app.
 */
export function buildReplyNotification(
  threadId: string,
  doc: Record<string, unknown>,
  accountTokens: string[],
): ReplyNotification | null {
  const own = Array.isArray(doc.pushTokens)
    ? doc.pushTokens.filter((t): t is string => typeof t === "string" && t !== "")
    : [];
  const tokens = [...new Set([...own, ...accountTokens.filter((t) => t)])];
  if (tokens.length === 0) return null;
  const messages = Array.isArray(doc.messages) ? doc.messages : [];
  const last = [...messages].reverse().find((m) => (m as { from?: unknown })?.from === "team") as
    | { text?: unknown }
    | undefined;
  const locale = asLocale(doc.locale);
  return {
    tokens,
    notification: {
      title: REPLY_TITLES[locale],
      body: excerpt(typeof last?.text === "string" ? last.text : ""),
    },
    data: { url: supportThreadPath(threadId) },
    apns: { payload: { aps: { sound: "default" } } },
  };
}
