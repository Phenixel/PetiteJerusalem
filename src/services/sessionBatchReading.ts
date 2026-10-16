import textStudiesJson from "../datas/textStudies.json";
import type {
  Session,
  TextStudiesJson,
  TextStudyJsonEntry,
  TextStudyReservation,
} from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";
import { isPerpetual } from "./perpetualChain";
import { RANDOM_RESERVATION_TTL_MS, reservationService } from "./reservationService";

/**
 * Reading every Tehilim you took in a chain at once
 * (`/share-reading/session/:slug/lecture`).
 *
 * Someone who takes five psalms in a chain used to open them one by one
 * from the list, read, come back, mark it read, open the next. Here they
 * follow each other on a single page, like the daily reading of Mon
 * parcours, and each one is marked read right where it is read.
 *
 * Nothing is kept in Mon parcours: this is the reading of one chain, for
 * now, not an objective on the shelf. What is checked is the reservation
 * itself, the same `isCompleted` as the switch of the chain's list.
 *
 * Tehilim chains only: a psalm is read whole, in a single slot. A chapter
 * reserved in a Talmud or Michna chain would need the reader to show that
 * chapter alone, which the shared reading (DailyReadingItem) does not do.
 */

/** From two Tehilim taken, the chain offers to read them at once. */
export const BATCH_READING_MIN = 2;

/**
 * The perpetual chain has no reservations, only readings: whoever picks
 * psalms there reads them right away. « Lire maintenant » ("Read now")
 * takes them and opens them at once on the reading page, without asking
 * for a name; a guest reads anonymously, as with the draw. Nobody owns the
 * chain to free a forgotten slot: a slot picked and not read goes back to
 * the chain after an hour (READ_NOW_TTL_MS), pushed back while the reading
 * page stays open, instead of the day the Cloud Function gives to what an
 * older version reserves (docs/chaine-perpetuelle.md).
 */
export function readsRightAway(session: Pick<Session, "perpetual"> | null | undefined): boolean {
  return isPerpetual(session);
}

/** How long a psalm picked to be read right away holds its slot: the draw's hour. */
export const READ_NOW_TTL_MS = RANDOM_RESERVATION_TTL_MS;

/** The expiry of a psalm picked now. */
export function readNowExpiry(now: number = Date.now()): string {
  return new Date(now + READ_NOW_TTL_MS).toISOString();
}

/**
 * Whether the reading page should push back a psalm's expiry: not read, and
 * expiring within half an hour. A longer hold (the day an older version
 * gets) is left alone: pushing it "back" would shorten it.
 */
export function needsRenewal(
  reservation: Pick<TextStudyReservation, "isCompleted" | "expiresAt">,
  now: number = Date.now(),
): boolean {
  if (reservation.isCompleted || reservation.expiresAt === undefined) return false;
  const expiresAt = new Date(reservation.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt - now < READ_NOW_TTL_MS / 2;
}

const entries = (textStudiesJson as TextStudiesJson).textStudies;
const entryById = new Map<string, TextStudyJsonEntry>(entries.map((e) => [String(e.id), e]));
/** The catalog order: Tehilim 1, 2, 3... */
const catalogRank = new Map<string, number>(entries.map((e, i) => [String(e.id), i]));

/** A psalm of the chain, reserved by the reader. */
export interface BatchReading {
  reservation: TextStudyReservation;
  entry: TextStudyJsonEntry;
}

/** Whether the chain lends itself to reading at once. */
export function supportsBatchReading(session: Pick<Session, "type"> | null | undefined): boolean {
  return session?.type === EnumTypeTextStudy.Tehilim;
}

/**
 * The reader's psalms in a chain, in the order of the book: their own
 * reservations that still hold their slot (an abandoned draw has expired and
 * is no longer theirs), read or not. A guest is recognized by this device's
 * guest identity, like everywhere else (`isOwnReservation`).
 */
export function batchReadings(
  session: Pick<Session, "type" | "reservations"> | null | undefined,
  user: { id: string; email: string } | null,
): BatchReading[] {
  if (!session || !supportsBatchReading(session)) return [];
  const seen = new Set<string>();
  const readings: BatchReading[] = [];
  for (const reservation of reservationService.activeReservations(session.reservations ?? [])) {
    if (!reservationService.isOwnReservation(reservation, user)) continue;
    const entry = entryById.get(reservation.textStudyId);
    if (!entry || seen.has(reservation.textStudyId)) continue;
    seen.add(reservation.textStudyId);
    readings.push({ reservation, entry });
  }
  return readings.sort(
    (a, b) =>
      (catalogRank.get(a.reservation.textStudyId) ?? Infinity) -
      (catalogRank.get(b.reservation.textStudyId) ?? Infinity),
  );
}

/**
 * Whether the chain shows « Tout lire maintenant » ("Read them all now"):
 * several psalms taken (`min`; one is enough on the perpetual chain, where
 * nothing is kept for later), and at least one still to read.
 */
export function offersBatchReading(
  readings: readonly BatchReading[],
  min: number = BATCH_READING_MIN,
): boolean {
  return readings.length >= min && readings.some((r) => !r.reservation.isCompleted);
}
