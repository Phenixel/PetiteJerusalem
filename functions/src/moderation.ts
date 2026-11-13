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
 *
 * Its cost is bounded (see EXACT_RECOUNT_LIMIT in reportTally.ts): the open
 * reports are counted first, by an aggregation that reads no document, and
 * read back one by one only while they are few.
 */
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { EXACT_RECOUNT_LIMIT, tallyReporters, type ReportTally } from "./reportTally";

/** Nombre de signaleurs distincts à partir duquel la session est masquée. */
const AUTO_HIDE_THRESHOLD = 3;

export const onSessionReported = onDocumentCreated("reports/{reportId}", async (event) => {
  const report = event.data?.data();
  const sessionId = report?.sessionId;
  if (typeof sessionId !== "string" || !sessionId) {
    logger.warn(`[moderation] signalement sans sessionId, ignoré: ${event.params.reportId}`);
    return;
  }

  const db = getFirestore();
  const openReports = db
    .collection("reports")
    .where("sessionId", "==", sessionId)
    .where("status", "==", "open");

  // Counted before being read: an aggregation costs one read per thousand
  // reports, where reading them back cost one each, on every new report.
  const total = (await openReports.count().get()).data().count;

  // Signalements ouverts de la session, comptés par personne (uid ou
  // identifiant invité local) : trois signalements du même appareil ne
  // masquent pas la session. Seuls les comptes pèsent dans le masquage
  // automatique (tallyReporters).
  let tally: ReportTally | null;
  if (total <= EXACT_RECOUNT_LIMIT) {
    const snap = await openReports.select("reporterId", "reporterGuestId").get();
    tally = tallyReporters(snap.docs.map((doc) => doc.data()));
  } else if (typeof report?.reporterId === "string" && report.reporterId) {
    // A flood of reports, and this one comes from an account: the accounts
    // are read apart from the guests (an account's report carries
    // `reporterGuestId: null`, the rules require it), so that anonymous
    // reports cannot push the real ones out of the sample.
    const snap = await openReports
      .where("reporterGuestId", "==", null)
      .select("reporterId")
      .limit(EXACT_RECOUNT_LIMIT)
      .get();
    tally = { reporters: total, accounts: tallyReporters(snap.docs.map((d) => d.data())).accounts };
  } else {
    // A flood, and a guest's report: it weighs nothing in the hiding. The
    // counter follows the number of reports, which is all there is to know.
    tally = { reporters: total, accounts: 0 };
    logger.warn(`[moderation] session ${sessionId} : ${total} signalements ouverts, non recomptés`);
  }

  const sessionRef = db.collection("sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    // Session supprimée entre-temps : rien à dénormaliser.
    return;
  }

  const updates: Record<string, unknown> = { reportsCount: tally.reporters };
  // La chaîne perpétuelle ne se masque pas d'elle-même : trois comptes
  // suffiraient à retirer à tout le monde la chaîne de l'app, alors qu'un
  // signalement y vise un nom, que l'admin retire seul (`chaine:retirer-nom`).
  const isPerpetual = sessionSnap.data()?.perpetual === true;
  if (
    !isPerpetual &&
    tally.accounts >= AUTO_HIDE_THRESHOLD &&
    sessionSnap.data()?.hidden !== true
  ) {
    updates.hidden = true;
    updates.hiddenAt = FieldValue.serverTimestamp();
    updates.hiddenReason = "reports";
    logger.info(
      `[moderation] session ${sessionId} masquée automatiquement ` +
        `(${tally.accounts} comptes distincts)`,
    );
  }

  await sessionRef.update(updates);
});
