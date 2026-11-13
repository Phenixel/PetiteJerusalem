/**
 * Les messages des utilisateurs (« Nous écrire ») : chaque message ouvre un
 * fil dans Firestore (`support/{id}`), que le backoffice liste et où l'équipe
 * répond (/admin/messages, ou `node scripts/admin.mjs support:…`). La personne
 * retrouve ses fils et les réponses dans l'app ou sur le site (/contact).
 * Voir docs/feedback.md.
 *
 * Qui relit un fil :
 * - un compte connecté relit les siens (`uid`) ;
 * - l'app sans compte relit ceux de l'appareil, par une clé tirée au hasard
 *   et gardée sur le téléphone ; on n'en garde que l'empreinte.
 * Les fils ne se lisent jamais en direct : les règles Firestore les réservent
 * à l'admin, et ces callables ne rendent que ce que la personne peut voir
 * (pas la note de l'équipe).
 *
 * `submitFeedback` garde son nom et accepte ce qu'envoient les versions de
 * l'app d'avant les fils : leur message arrive dans le backoffice, la réponse
 * passe alors par le contact laissé.
 */
import { createHash } from "node:crypto";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import {
  FieldValue,
  getFirestore,
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import {
  buildReplyNotification,
  FeedbackValidationError,
  isTeamReplyTransition,
  KINDS,
  newThread,
  ownsThread,
  parseFeedback,
  parseGuestKey,
  parseReply,
  PLATFORMS,
  readScope,
  publicThread,
  sortThreads,
  SUPPORTS,
  userReplyPatch,
  type PublicThread,
  type SupportIdentity,
} from "./support";

const COLLECTION = "support";

// ---- Garde-fou : au plus N envois par adresse et par fenêtre, par instance.
// Suffisant contre un script qui boucle ; une vraie personne n'envoie pas
// dix messages en dix minutes.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 10;
const recentByIp = new Map<string, number[]>();

function assertNotRateLimited(ip: string | undefined): void {
  if (!ip) return;
  const now = Date.now();
  const recent = (recentByIp.get(ip) ?? []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    throw new HttpsError("resource-exhausted", "Trop d'envois, réessayez plus tard.");
  }
  recent.push(now);
  recentByIp.set(ip, recent);
  // Les adresses qu'on ne voit plus ne s'accumulent pas.
  if (recentByIp.size > 1000) {
    for (const [key, stamps] of recentByIp) {
      if (stamps.every((ts) => now - ts >= RATE_WINDOW_MS)) recentByIp.delete(key);
    }
  }
}

function hashKey(guestKey: string): string | null {
  return guestKey ? createHash("sha256").update(guestKey).digest("hex") : null;
}

function validated<T>(parse: () => T): T {
  try {
    return parse();
  } catch (err) {
    if (err instanceof FeedbackValidationError) {
      throw new HttpsError("invalid-argument", err.message);
    }
    throw err;
  }
}

function identityOf(request: CallableRequest<unknown>, guestKey: string): SupportIdentity {
  const token = request.auth?.token;
  return {
    uid: request.auth?.uid ?? null,
    accountEmail: typeof token?.email === "string" ? token.email : null,
    accountName: typeof token?.name === "string" ? token.name : null,
    guestKeyHash: hashKey(guestKey),
  };
}

export const submitFeedback = onCall<unknown, Promise<{ ok: true; id: string }>>(
  async (request) => {
    assertNotRateLimited(request.rawRequest.ip);
    const input = validated(() => parseFeedback(request.data));

    const ref = getFirestore().collection(COLLECTION).doc();
    const thread = newThread(input, identityOf(request, input.guestKey), new Date());
    await ref.set(thread);

    logger.info(
      `submitFeedback: ${KINDS[input.kind]} depuis ${SUPPORTS[input.support]} ${PLATFORMS[input.platform]}` +
        (input.version ? ` ${input.version}` : "") +
        (thread.uid ? " (compte)" : thread.guestKeyHash ? " (appareil)" : "") +
        (input.contact ? " (avec contact)" : "") +
        `, fil ${ref.id}.`,
    );
    return { ok: true, id: ref.id };
  },
);

/**
 * Les fils de l'appelant (son compte, et la clé de son appareil), le plus
 * récent en tête. `markRead` : la personne a sous les yeux tous ses fils
 * (`true`) ou l'un d'eux (son identifiant), ses réponses cessent d'être
 * « nouvelles ». La liste seule ne marque rien : la pastille reste jusqu'à
 * l'ouverture du fil.
 */
export const listSupportThreads = onCall<unknown, Promise<{ threads: PublicThread[] }>>(
  async (request) => {
    const uid = request.auth?.uid ?? null;
    const guestKeyHash = hashKey(validated(() => parseGuestKey(request.data)));
    if (!uid && !guestKeyHash) return { threads: [] };

    const col = getFirestore().collection(COLLECTION);
    const snaps = await Promise.all([
      uid ? col.where("uid", "==", uid).limit(100).get() : null,
      guestKeyHash ? col.where("guestKeyHash", "==", guestKeyHash).limit(100).get() : null,
    ]);
    const docs = new Map<string, QueryDocumentSnapshot>();
    for (const snap of snaps) snap?.docs.forEach((d) => docs.set(d.id, d));

    const threads = sortThreads([...docs.values()].map((d) => publicThread(d.id, d.data())));

    const scope = readScope((request.data as { markRead?: unknown } | null)?.markRead);
    const unread = [...docs.values()].filter(
      (d) => d.data().unreadByUser === true && (scope === "all" || d.id === scope),
    );
    if (scope && unread.length > 0) {
      const batch = getFirestore().batch();
      unread.forEach((d) => batch.update(d.ref, { unreadByUser: false }));
      await batch.commit();
    }
    return { threads };
  },
);

/** La personne relance un de ses fils. */
export const replySupportThread = onCall<unknown, Promise<{ thread: PublicThread }>>(
  async (request) => {
    assertNotRateLimited(request.rawRequest.ip);
    const input = validated(() => parseReply(request.data));
    const uid = request.auth?.uid ?? null;
    const guestKeyHash = hashKey(input.guestKey);
    const ref = getFirestore().collection(COLLECTION).doc(input.threadId);

    const updated = await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      // Un fil d'un autre se dit introuvable, comme un fil qui n'existe pas.
      if (!data || !ownsThread(data, uid, guestKeyHash)) {
        throw new HttpsError("not-found", "Fil introuvable.");
      }
      const patch = validated(() =>
        userReplyPatch(
          { status: data.status, messages: Array.isArray(data.messages) ? data.messages : [] },
          input.text,
          new Date(),
          input.pushToken,
          Array.isArray(data.pushTokens) ? data.pushTokens : [],
        ),
      );
      const message = { ...patch.message, at: Timestamp.fromDate(patch.message.at) };
      tx.update(ref, {
        messages: FieldValue.arrayUnion(message),
        status: patch.status,
        lastFrom: patch.lastFrom,
        updatedAt: Timestamp.fromDate(patch.updatedAt),
        unreadByUser: false,
        ...(patch.pushTokens ? { pushTokens: patch.pushTokens } : {}),
      });
      return {
        ...data,
        messages: [...(data.messages ?? []), message],
        status: patch.status,
        updatedAt: message.at,
        unreadByUser: false,
      };
    });
    logger.info(`replySupportThread: relance sur le fil ${input.threadId}.`);
    return { thread: publicThread(input.threadId, updated) };
  },
);

/**
 * La suppression d'un compte efface ses fils (authService.deleteAccount) :
 * rien de la personne ne reste derrière elle.
 */
export const forgetSupportThreads = onCall<unknown, Promise<{ deleted: number }>>(
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");
    const snap = await getFirestore().collection(COLLECTION).where("uid", "==", uid).get();
    const batch = getFirestore().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return { deleted: snap.size };
  },
);

/**
 * L'équipe a répondu (backoffice ou ligne de commande) : une notification
 * part vers les appareils de la personne, ceux du fil et ceux de son compte.
 * Seulement à l'ajout d'une réponse (isTeamReplyTransition) ; un statut ou
 * une note changés n'envoient rien.
 */
export const onSupportThreadWritten = onDocumentWritten(
  `${COLLECTION}/{threadId}`,
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    if (!after?.exists) return;
    const data = after.data() ?? {};
    if (!isTeamReplyTransition(before?.exists ? before.data() : undefined, data)) return;

    let accountTokens: string[] = [];
    if (typeof data.uid === "string" && data.uid) {
      const prefs = await getFirestore().collection("userPreferences").doc(data.uid).get();
      const tokens = prefs.data()?.fcmTokens;
      if (Array.isArray(tokens)) accountTokens = tokens.filter((t) => typeof t === "string");
    }
    const id = event.params.threadId;
    const message = buildReplyNotification(id, data, accountTokens);
    if (!message) {
      logger.info(`onSupportThreadWritten: fil ${id}, aucun appareil à prévenir.`);
      return;
    }
    const result = await getMessaging().sendEachForMulticast(message);
    // Les jetons morts du fil s'oublient ; ceux du compte, la fonction des
    // rappels les purge déjà.
    const dead = message.tokens.filter((token, i) => {
      const code = result.responses[i]?.error?.code;
      return (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      );
    });
    if (dead.length > 0) {
      await after.ref.update({ pushTokens: FieldValue.arrayRemove(...dead) });
    }
    logger.info(
      `onSupportThreadWritten: fil ${id}, ${result.successCount}/${message.tokens.length} appareil(s) prévenu(s).`,
    );
  },
);
