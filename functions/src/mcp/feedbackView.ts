/**
 * The user messages (« Nous écrire », `support/{id}`, docs/feedback.md) as the
 * MCP tools hand them to an assistant: what was written, where from and where
 * it stands, and nothing that identifies the person. No contact, no account
 * email or name, no uid, no device key or push token: the assistant reads
 * them to find bugs and confusing screens, it never needs to reach anyone.
 * It only learns whether the person is signed in and left a contact, which
 * says whether the team can answer them.
 *
 * Pure module (no firebase-functions, no MCP SDK): the site's unit tests read
 * it (src/__tests__/mcpServer.test.ts).
 */
import {
  KINDS,
  millisOf,
  STATUSES,
  type FeedbackKind,
  type FeedbackPlatform,
  type FeedbackSupport,
  type SupportStatus,
} from "../support";

/** A document of the `support` collection, as read from Firestore. */
export interface SupportRow {
  id: string;
  data: Record<string, unknown>;
}

export interface FeedbackSummary {
  id: string;
  kind: FeedbackKind;
  /** The free-text kind, when `kind` is "other". */
  otherKind: string;
  status: SupportStatus;
  support: FeedbackSupport;
  platform: FeedbackPlatform;
  /** App version ("4.0.1 (701)") or site bundle version. */
  version: string;
  locale: string;
  /** The page the message was sent from ("/lire/tehilim"), empty if unknown. */
  page: string;
  createdAt: string | null;
  updatedAt: string | null;
  /** Who wrote last: "user" means the ball is in the team's court. */
  lastFrom: "user" | "team";
  messageCount: number;
  /** The start of the person's first message. */
  excerpt: string;
}

export interface FeedbackMessage {
  from: "user" | "team";
  text: string;
  at: string | null;
}

export interface FeedbackDetail extends FeedbackSummary {
  messages: FeedbackMessage[];
  /** The team's private note on the thread, never shown to the person. */
  teamNote: string;
  /** The person wrote while signed in. */
  signedIn: boolean;
  /** The person left an email or phone number (the value itself is withheld). */
  hasContact: boolean;
}

/** "open" is what still needs the team: new and in progress. */
export const STATUS_FILTERS = ["open", "all", ...STATUSES] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export interface FeedbackFilter {
  status: StatusFilter;
  kind: FeedbackKind | null;
  /** Only threads active since then (last message or status change). */
  since: Date | null;
  limit: number;
}

export const LIST_LIMIT_DEFAULT = 20;
export const LIST_LIMIT_MAX = 50;
const EXCERPT_MAX = 280;

function iso(value: unknown): string | null {
  const ms = millisOf(value);
  return ms > 0 ? new Date(ms).toISOString() : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= EXCERPT_MAX ? flat : `${flat.slice(0, EXCERPT_MAX - 1).trimEnd()}…`;
}

function asStatus(value: unknown): SupportStatus {
  return (STATUSES as readonly unknown[]).includes(value) ? (value as SupportStatus) : "new";
}

function asKind(value: unknown): FeedbackKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(KINDS, value)
    ? (value as FeedbackKind)
    : "other";
}

function messagesOf(data: Record<string, unknown>): FeedbackMessage[] {
  const raw = Array.isArray(data.messages) ? data.messages : [];
  return raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
    .map((m) => ({ from: m.from === "team" ? "team" : "user", text: str(m.text), at: iso(m.at) }));
}

export function toFeedbackSummary(row: SupportRow): FeedbackSummary {
  const { data } = row;
  const messages = messagesOf(data);
  const first = messages.find((m) => m.from === "user") ?? messages[0];
  return {
    id: row.id,
    kind: asKind(data.kind),
    otherKind: str(data.otherKind),
    status: asStatus(data.status),
    support: data.support === "app" ? "app" : "web",
    platform: data.platform === "ios" || data.platform === "android" ? data.platform : "web",
    version: str(data.version),
    locale: str(data.locale) || "fr",
    page: str(data.page),
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
    lastFrom: data.lastFrom === "team" ? "team" : "user",
    messageCount: messages.length,
    excerpt: excerpt(first?.text ?? ""),
  };
}

export function toFeedbackDetail(row: SupportRow): FeedbackDetail {
  const { data } = row;
  return {
    ...toFeedbackSummary(row),
    messages: messagesOf(data),
    teamNote: str(data.note),
    signedIn: typeof data.uid === "string" && data.uid.length > 0,
    hasContact: str(data.contact).trim().length > 0,
  };
}

/** A thread id as the back office writes them; anything else is not looked up. */
export function isThreadId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

/** The tool's arguments, already shaped by its schema, made safe and complete. */
export function feedbackFilter(input: {
  status?: string;
  kind?: string;
  since?: string;
  limit?: number;
}): FeedbackFilter {
  const status = (STATUS_FILTERS as readonly string[]).includes(input.status ?? "")
    ? (input.status as StatusFilter)
    : "open";
  const kind =
    input.kind && Object.prototype.hasOwnProperty.call(KINDS, input.kind)
      ? (input.kind as FeedbackKind)
      : null;
  const sinceMs = input.since ? Date.parse(input.since) : NaN;
  const limit = Number.isInteger(input.limit) ? (input.limit as number) : LIST_LIMIT_DEFAULT;
  return {
    status,
    kind,
    since: Number.isFinite(sinceMs) ? new Date(sinceMs) : null,
    limit: Math.min(Math.max(limit, 1), LIST_LIMIT_MAX),
  };
}

function matchesStatus(status: SupportStatus, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "open") return status === "new" || status === "in_progress";
  return status === filter;
}

/** The threads that match, most recently active first, at most `limit`. */
export function selectFeedback(rows: SupportRow[], filter: FeedbackFilter): FeedbackSummary[] {
  const since = filter.since?.getTime() ?? null;
  return rows
    .map((row) => ({ row, updated: millisOf(row.data.updatedAt) }))
    .filter(({ row, updated }) => {
      if (since !== null && updated < since) return false;
      if (!matchesStatus(asStatus(row.data.status), filter.status)) return false;
      return !filter.kind || asKind(row.data.kind) === filter.kind;
    })
    .sort((a, b) => b.updated - a.updated)
    .slice(0, filter.limit)
    .map(({ row }) => toFeedbackSummary(row));
}
