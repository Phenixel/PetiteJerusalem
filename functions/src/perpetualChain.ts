/**
 * La chaîne perpétuelle de Tehilim (voir docs/chaine-perpetuelle.md) : dès que
 * la dernière place d'un tour est marquée lue, la session repart à zéro et son
 * compteur avance d'un tour.
 *
 * Le trigger tourne avec le SDK admin : les règles Firestore ne laissent
 * personne d'autre vider les réservations d'une chaîne ni toucher à son
 * compteur. Il se déclenche sur toutes les sessions, mais sort aussitôt de
 * celles qui ne sont pas perpétuelles ; et c'est une transaction qui décide,
 * pour qu'un second déclenchement (sa propre écriture, une relance) ne compte
 * jamais deux fois le même tour.
 */
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { isRoundComplete, nextRound } from "./perpetualRound";

export const onPerpetualSessionUpdated = onDocumentUpdated(
  "sessions/{sessionId}",
  async (event) => {
    const after = event.data?.after;
    const data = after?.data();
    if (!after || data?.perpetual !== true) return;
    if (!isRoundComplete(data.reservations, data.slotCount)) return;

    const db = getFirestore();
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(after.ref);
      const current = snap.data();
      if (!current || current.perpetual !== true) return;
      if (!isRoundComplete(current.reservations, current.slotCount)) return;

      const update = nextRound<Timestamp>(current, Timestamp.now());
      transaction.update(after.ref, { ...update });
      console.log(
        `[perpetual] session ${event.params.sessionId} : tour ${update.cycle - 1} terminé ` +
          `(${update.lastCycleParticipants} lecteurs), le tour ${update.cycle} commence`,
      );
    });
  },
);
