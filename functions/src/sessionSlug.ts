/**
 * À qui revient un slug porté par plusieurs sessions. L'app en génère un
 * unique, mais rien n'empêche un client d'écrire une session avec le slug
 * d'une autre : les règles ne voient pas les autres documents. La même règle
 * que l'app (src/services/firestoreService.ts, getSessionBySlug) : la chaîne
 * perpétuelle d'abord, dont le drapeau est réservé à l'admin par les règles,
 * sinon la session la plus ancienne.
 *
 * Module pur, sans Firebase : les tests de l'app l'importent.
 */

type SlugCandidate = { perpetual?: unknown; createdAt?: unknown };

/** Une date de création illisible ou absente passe après toutes les autres. */
function createdAtMillis(value: unknown): number {
  const stamp = value as { toMillis?: () => number } | null | undefined;
  if (typeof stamp?.toMillis !== "function") return Number.POSITIVE_INFINITY;
  const millis = stamp.toMillis();
  return Number.isFinite(millis) ? millis : Number.POSITIVE_INFINITY;
}

/** L'indice de la session à qui revient le slug, parmi celles qui le portent. */
export function slugOwnerIndex(candidates: SlugCandidate[]): number {
  const perpetual = candidates.findIndex((candidate) => candidate.perpetual === true);
  if (perpetual !== -1) return perpetual;
  let oldest = 0;
  for (let i = 1; i < candidates.length; i++) {
    if (createdAtMillis(candidates[i].createdAt) < createdAtMillis(candidates[oldest].createdAt)) {
      oldest = i;
    }
  }
  return oldest;
}
