import textStudiesJson from "../datas/textStudies.json";
import type {
  Session,
  TextStudiesJson,
  TextStudyJsonEntry,
  TextStudyReservation,
} from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";
import { reservationService } from "./reservationService";

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
 * Whether the chain shows « Lire mes Téhilim » ("Read my Tehilim"): several
 * psalms taken, and at least one still to read.
 */
export function offersBatchReading(readings: readonly BatchReading[]): boolean {
  return readings.length >= BATCH_READING_MIN && readings.some((r) => !r.reservation.isCompleted);
}
