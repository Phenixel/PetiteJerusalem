/**
 * Modération des sessions (exigence App Store 1.2, contenu généré par les
 * utilisateurs) : à chaque signalement déposé dans `reports`, ce trigger
 * recompte les signalements OUVERTS de la session (personnes distinctes) et
 * dénormalise le compteur sur le document session. À partir de
 * AUTO_HIDE_THRESHOLD signaleurs distincts, la session est masquée
 * (`hidden: true`) jusqu'à ce que l'admin agisse dans le backoffice
 * (/admin/sessions) : démasquer résout les signalements et remet le compteur
 * à zéro.
 *
 * Le trigger tourne avec le SDK admin : il n'est pas soumis aux règles
 * Firestore, qui interdisent au créateur de toucher aux champs de modération.
 */
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

/** Nombre de signaleurs distincts à partir duquel la session est masquée. */
const AUTO_HIDE_THRESHOLD = 3;

export const onSessionReported = onDocumentCreated("reports/{reportId}", async (event) => {
  const report = event.data?.data();
  const sessionId = report?.sessionId;
  if (typeof sessionId !== "string" || !sessionId) {
    console.warn("[moderation] signalement sans sessionId, ignoré:", event.params.reportId);
    return;
  }

  const db = getFirestore();

  // Signalements ouverts de la session, comptés par personne (uid ou
  // identifiant invité local) : trois signalements du même appareil ne
  // masquent pas la session.
  const openReports = await db
    .collection("reports")
    .where("sessionId", "==", sessionId)
    .where("status", "==", "open")
    .get();

  const reporters = new Set(
    openReports.docs.map((doc) => {
      const data = doc.data();
      return (data.reporterId as string | null) ?? (data.reporterGuestId as string | null) ?? doc.id;
    }),
  );

  const sessionRef = db.collection("sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    // Session supprimée entre-temps : rien à dénormaliser.
    return;
  }

  const updates: Record<string, unknown> = { reportsCount: reporters.size };
  if (reporters.size >= AUTO_HIDE_THRESHOLD && sessionSnap.data()?.hidden !== true) {
    updates.hidden = true;
    updates.hiddenAt = FieldValue.serverTimestamp();
    updates.hiddenReason = "reports";
    console.log(
      `[moderation] session ${sessionId} masquée automatiquement ` +
        `(${reporters.size} signaleurs distincts)`,
    );
  }

  await sessionRef.update(updates);
});
