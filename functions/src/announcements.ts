/**
 * Les informations de l'équipe : à la publication d'une annonce dont la case
 * « envoyer une notification » est cochée, un message part sur le canal FCM
 * de chaque langue (`announcements-fr`, `-en`, `-he`), auquel l'app s'abonne
 * au lancement. Pas de jetons à parcourir : un envoi par langue touche tous
 * les appareils abonnés, avec ou sans compte.
 *
 * Seulement quand l'annonce devient publiée avec la case cochée (voir
 * isNotifyTransition) : une autre modification n'envoie rien.
 *
 * Une seule fois par annonce : `notifiedAt` est posé dans une transaction
 * AVANT l'envoi. Un trigger rejoué, ou l'écriture de `notifiedAt` elle-même
 * qui relance ce trigger, trouve le champ rempli et s'arrête. Mieux vaut une
 * notification perdue sur une panne de FCM qu'une annonce reçue deux fois.
 *
 * Prérequis hors code : ceux des rappels de lecture (clé APNs, voir
 * docs/app-native.md), et une version de l'app qui s'abonne aux canaux.
 */
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { buildAnnouncementMessages, isNotifyTransition, shouldNotify } from "./announcementPush";

export const onAnnouncementWritten = onDocumentWritten(
  "announcements/{announcementId}",
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    if (!after?.exists) return;
    if (!isNotifyTransition(before?.exists ? before.data() : undefined, after.data())) return;

    const id = event.params.announcementId;
    const ref = getFirestore().collection("announcements").doc(id);
    const claimed = await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!shouldNotify(snap.data())) return null;
      tx.update(ref, { notifiedAt: FieldValue.serverTimestamp() });
      return snap.data() ?? null;
    });
    if (!claimed) return;

    const messages = buildAnnouncementMessages(id, claimed);
    if (messages.length === 0) {
      logger.warn(`onAnnouncementWritten: annonce ${id} sans titre, rien d'envoyé.`);
      return;
    }
    const result = await getMessaging().sendEach(messages);
    const errors = result.responses
      .map((r, i) => (r.error ? `${messages[i].topic}: ${r.error.code}` : null))
      .filter((e): e is string => e !== null);
    logger.info(
      `onAnnouncementWritten: annonce ${id}, ${result.successCount} canal(aux) servi(s)` +
        (errors.length ? `, échecs : ${errors.join(", ")}` : "") +
        ".",
    );
  },
);
