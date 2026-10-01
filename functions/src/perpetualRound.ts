/**
 * La règle du tour de la chaîne perpétuelle, sans Firestore : quand un tour
 * est-il fini, et que devient la session quand il l'est. La Cloud Function
 * onPerpetualSessionUpdated (perpetualChain.ts) l'applique ;
 * src/__tests__/perpetualChain.test.ts la tient.
 */

/** Une réservation telle que le document de session la garde. */
export interface RoundReservation {
  textStudyId?: unknown;
  isCompleted?: unknown;
  chosenById?: unknown;
  chosenByGuestId?: unknown;
}

/**
 * Le tour est fini quand chaque place a une réservation lue. Les places sont
 * des textes à une seule section (les 150 Tehilim) : une place, c'est un
 * texte, quelle que soit la section que la réservation nomme. Sans
 * `slotCount` valide, le tour ne finit jamais : mieux vaut une chaîne qui ne
 * repart pas qu'une chaîne vidée par erreur.
 */
export function isRoundComplete(reservations: unknown, slotCount: unknown): boolean {
  if (!Array.isArray(reservations)) return false;
  if (typeof slotCount !== "number" || !Number.isInteger(slotCount) || slotCount <= 0) {
    return false;
  }
  const read = new Set<string>();
  for (const r of reservations as RoundReservation[]) {
    if (r && r.isCompleted === true && typeof r.textStudyId === "string") {
      read.add(r.textStudyId);
    }
  }
  return read.size >= slotCount;
}

/** Lecteurs distincts du tour : comptes et invités, comme la barre d'avancement. */
export function roundParticipants(reservations: unknown): number {
  if (!Array.isArray(reservations)) return 0;
  const who = new Set<string>();
  for (const r of reservations as RoundReservation[]) {
    if (!r) continue;
    if (typeof r.chosenById === "string" && r.chosenById) who.add(`user:${r.chosenById}`);
    else if (typeof r.chosenByGuestId === "string" && r.chosenByGuestId) {
      who.add(`guest:${r.chosenByGuestId}`);
    }
  }
  return who.size;
}

/** Ce que la session devient, un tour fini : vide, et un tour de plus au compteur. */
export interface NextRound<T> {
  reservations: [];
  cycle: number;
  completedCycles: number;
  cycleStartedAt: T;
  lastCycleStartedAt: T;
  lastCycleEndedAt: T;
  lastCycleParticipants: number;
  updatedAt: T;
}

/**
 * `now` et le début du tour sont des Timestamp côté Cloud Function, des
 * dates dans les tests : la règle ne dépend pas de leur type.
 */
export function nextRound<T>(
  session: {
    cycle?: unknown;
    completedCycles?: unknown;
    cycleStartedAt?: T | null;
    createdAt?: T | null;
    reservations?: unknown;
  },
  now: T,
): NextRound<T> {
  const completed = typeof session.completedCycles === "number" ? session.completedCycles : 0;
  const cycle = typeof session.cycle === "number" ? session.cycle : completed + 1;
  return {
    reservations: [],
    cycle: cycle + 1,
    completedCycles: completed + 1,
    cycleStartedAt: now,
    lastCycleStartedAt: session.cycleStartedAt ?? session.createdAt ?? now,
    lastCycleEndedAt: now,
    lastCycleParticipants: roundParticipants(session.reservations),
    updatedAt: now,
  };
}
