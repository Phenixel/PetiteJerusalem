import { auth } from "../firebase/core";
import { i18n } from "../i18n";
import { guestService } from "./guestService";
import { analyticsService } from "./analyticsService";
import { BANNED_WORDS, BANNED_PHRASES } from "../datas/bannedWords";
import type { ReportReason, Session } from "../models/models";

/**
 * Modération du contenu généré par les utilisateurs (exigence App Store 1.2) :
 * - filtre de termes interdits sur tout texte saisi (titres, descriptions,
 *   pseudos, noms d'invités) ;
 * - signalement de sessions (collection Firestore `reports`, lue dans le
 *   backoffice ; au 3e signalement une Cloud Function masque la session) ;
 * - blocage local de créateurs (leurs sessions disparaissent des listes de
 *   l'appareil).
 *
 * Ce module fait partie du bundle initial (authService l'importe pour le
 * filtre, useToast pour ModerationError) : Firestore n'y est chargé qu'au
 * moment du signalement, par import dynamique. Un import statique ramènerait
 * tout le SDK Firestore (~170 kB gzip) dans le chargement de la première page.
 */

/** Texte refusé par le filtre : `word` est le terme en cause, le message est localisé. */
export class ModerationError extends Error {
  readonly word: string;

  constructor(word: string) {
    super(i18n.global.t("moderation.bannedWord", { word }));
    this.name = "ModerationError";
    this.word = word;
  }
}

// Chiffres et symboles utilisés pour contourner le filtre (« p0te », « m3rde »).
const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "!": "i",
};

/** Minuscules, sans accents ni niqqoud, chiffres « leet » convertis. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[0134578@$!]/g, (c) => LEET_MAP[c] ?? c);
}

const BANNED_WORD_SET = new Set(BANNED_WORDS.map(normalize));
const BANNED_PHRASE_TOKENS = BANNED_PHRASES.map((phrase) => normalize(phrase).split(/\s+/));

// Sessions déjà signalées et créateurs bloqués : mémorisés sur l'appareil
// (fonctionne aussi pour les invités sans compte).
const REPORTED_SESSIONS_KEY = "pj_reported_sessions";
const BLOCKED_CREATORS_KEY = "pj_blocked_creators";

function readLocalList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeLocalList(key: string, values: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Stockage indisponible (navigation privée…) : le marquage ne survivra pas.
  }
}

export class ModerationService {
  // === Filtre de termes interdits ===

  /**
   * Renvoie le premier terme interdit trouvé dans le texte, ou null.
   * Comparaison mot à mot sur le texte normalisé : un terme contenu dans un
   * mot plus long (« députée » / « pute ») ne déclenche pas.
   */
  findBannedWord(text: string): string | null {
    const tokens = normalize(text).match(/\p{L}+/gu);
    if (!tokens || tokens.length === 0) return null;

    for (const token of tokens) {
      if (BANNED_WORD_SET.has(token)) return token;
    }

    for (const phrase of BANNED_PHRASE_TOKENS) {
      for (let i = 0; i + phrase.length <= tokens.length; i++) {
        if (phrase.every((word, j) => tokens[i + j] === word)) {
          return phrase.join(" ");
        }
      }
    }

    return null;
  }

  /** Lève une ModerationError si l'un des textes contient un terme interdit. */
  assertClean(...texts: Array<string | undefined>): void {
    for (const text of texts) {
      if (!text) continue;
      const word = this.findBannedWord(text);
      if (word) {
        throw new ModerationError(word);
      }
    }
  }

  // === Signalement de sessions ===

  /**
   * Enregistre un signalement dans `reports`. L'identité du signaleur (uid ou
   * identifiant invité local) permet à la Cloud Function de compter les
   * signalements DISTINCTS avant le masquage automatique.
   */
  async reportSession(session: Session, reason: ReportReason, details: string): Promise<void> {
    const uid = auth.currentUser?.uid ?? null;
    const [{ addDoc, collection, Timestamp }, { db }] = await Promise.all([
      import("firebase/firestore"),
      import("../firebase/firestore"),
    ]);
    await addDoc(collection(db, "reports"), {
      sessionId: session.id,
      sessionName: session.name,
      reason,
      details: details.trim().slice(0, 1000),
      reporterId: uid,
      reporterGuestId: uid ? null : guestService.getOrCreateLocalGuestId(),
      status: "open",
      createdAt: Timestamp.now(),
    });

    this.markSessionReported(session.id);
    analyticsService.capture("session_reported", {
      session_id: session.id,
      reason,
      is_authenticated: uid != null,
    });
  }

  /** Déjà signalée depuis cet appareil : le bouton passe en « Signalé ». */
  hasReportedSession(sessionId: string): boolean {
    return readLocalList(REPORTED_SESSIONS_KEY).includes(sessionId);
  }

  private markSessionReported(sessionId: string): void {
    const reported = readLocalList(REPORTED_SESSIONS_KEY);
    if (!reported.includes(sessionId)) {
      writeLocalList(REPORTED_SESSIONS_KEY, [...reported, sessionId].slice(-200));
    }
  }

  // === Blocage de créateurs (local à l'appareil) ===

  getBlockedCreatorIds(): string[] {
    return readLocalList(BLOCKED_CREATORS_KEY);
  }

  isCreatorBlocked(personId: string | undefined): boolean {
    if (!personId) return false;
    return this.getBlockedCreatorIds().includes(personId);
  }

  blockCreator(personId: string): void {
    const blocked = this.getBlockedCreatorIds();
    if (!blocked.includes(personId)) {
      writeLocalList(BLOCKED_CREATORS_KEY, [...blocked, personId].slice(-200));
    }
    analyticsService.capture("creator_blocked");
  }

  unblockCreator(personId: string): void {
    writeLocalList(
      BLOCKED_CREATORS_KEY,
      this.getBlockedCreatorIds().filter((id) => id !== personId),
    );
    analyticsService.capture("creator_unblocked");
  }
}

export const moderationService = new ModerationService();
