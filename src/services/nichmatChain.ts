import type { Session, TextStudyReservation } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";
import { localDayFrom, localDayKey } from "./dateService";

/**
 * Nichmat 40: forty people each say Nichmat kol 'hai every day for forty
 * days (see docs/nichmat-40-jours.md). What can be computed without the
 * network lives here; the writes go through reservationService.
 *
 * The session is an ordinary one, of type `Nichmat`, and everything it
 * stores lives in its `reservations` array, in two kinds of entries that a
 * published version of the app keeps as they are:
 *
 *  - a place: `textStudyId` "686" (the Nichmat page of the library),
 *    `section` 1 to 40, and the identity of whoever holds it;
 *  - a day read: `textStudyId` "686/<day>" (day 1 to 40), `section` the
 *    place, `isCompleted` true, and no identity: the place says whose it is.
 *
 * A day read is its own entry rather than a field of the place: a published
 * version rewrites a guest's reservations with the fields it knows when the
 * guest signs in, and would drop such a field.
 */

/** The Nichmat entry of the catalog (src/datas/textStudies.json). */
export const NICHMAT_TEXT_ID = "686";

/** Readers of a chain, and days each of them reads. */
export const NICHMAT_PLACES = 40;
export const NICHMAT_DAYS = 40;

const DAY_RECORD = /^686\/(\d{1,2})$/;

export function isNichmat(session: Pick<Session, "type"> | null | undefined): boolean {
  return session?.type === EnumTypeTextStudy.Nichmat;
}

/** The `textStudyId` of the reading of day `day` (1 to 40). */
export function dayRecordTextId(day: number): string {
  return `${NICHMAT_TEXT_ID}/${day}`;
}

/** The day a reading entry stands for, or null for any other entry. */
export function dayOfRecord(reservation: Pick<TextStudyReservation, "textStudyId">): number | null {
  const match = DAY_RECORD.exec(reservation.textStudyId);
  if (!match) return null;
  const day = Number(match[1]);
  return day >= 1 && day <= NICHMAT_DAYS ? day : null;
}

const isPlaceNumber = (section: number | undefined): section is number =>
  Number.isInteger(section) && section! >= 1 && section! <= NICHMAT_PLACES;

/** A place entry: the Nichmat text, one of the forty sections. */
export function isPlaceRecord(
  reservation: Pick<TextStudyReservation, "textStudyId" | "section">,
): boolean {
  return reservation.textStudyId === NICHMAT_TEXT_ID && isPlaceNumber(reservation.section);
}

/** The places taken, by number; the first entry wins if two share one. */
export function placesOf(
  session: Pick<Session, "reservations">,
): Map<number, TextStudyReservation> {
  const places = new Map<number, TextStudyReservation>();
  for (const r of session.reservations ?? []) {
    if (isPlaceRecord(r) && !places.has(r.section!)) places.set(r.section!, r);
  }
  return places;
}

/** The first free place, or null when the forty are taken. */
export function firstFreePlace(session: Pick<Session, "reservations">): number | null {
  const places = placesOf(session);
  for (let place = 1; place <= NICHMAT_PLACES; place++) {
    if (!places.has(place)) return place;
  }
  return null;
}

/** The days a place has read, ticked by its holder. */
export function readDaysOf(session: Pick<Session, "reservations">, place: number): Set<number> {
  const days = new Set<number>();
  for (const r of session.reservations ?? []) {
    if (r.section !== place || !r.isCompleted) continue;
    const day = dayOfRecord(r);
    if (day !== null) days.add(day);
  }
  return days;
}

/** The entry of a day read, to untick it. */
export function dayRecordOf(
  session: Pick<Session, "reservations">,
  place: number,
  day: number,
): TextStudyReservation | undefined {
  const textId = dayRecordTextId(day);
  return (session.reservations ?? []).find((r) => r.textStudyId === textId && r.section === place);
}

// ---------- Days ----------

/** `day` (YYYY-MM-DD) moved by `count` days, whatever the time zone. */
export function addDays(day: string, count: number): string {
  const date = localDayFrom(day);
  if (!date) return day;
  date.setDate(date.getDate() + count);
  return localDayKey(date);
}

/** Calendar days from `from` to `to` (both YYYY-MM-DD): 0 the same day. */
export function daysBetween(from: string, to: string): number {
  const a = localDayFrom(from);
  const b = localDayFrom(to);
  if (!a || !b) return 0;
  // Rounded: a change of hour makes a day of 23 or 25 hours.
  return Math.round((b.getTime() - a.getTime()) / (24 * 3600 * 1000));
}

/**
 * The day of an instant in Jerusalem (YYYY-MM-DD). A chain that starts once
 * it is full starts the day after its fortieth place was taken: read in each
 * reader's own time zone, that day would not be the same for everyone.
 */
export function jerusalemDayOf(instant: Date): string {
  // en-CA writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The first of the forty days (YYYY-MM-DD), or null while the chain waits
 * for its readers.
 *
 * A start chosen at creation is stored (`startDay`). A chain that starts
 * once full has none until its creator's app records it (see
 * {@link startToRecord}): in the meantime, it is the day after the
 * fortieth place was taken, in Jerusalem.
 */
export function startDayOf(
  session: Pick<Session, "startDay" | "startsWhenFull" | "reservations">,
): string | null {
  if (session.startDay && DAY_KEY.test(session.startDay)) return session.startDay;
  if (!session.startsWhenFull) return null;
  const places = [...placesOf(session).values()];
  if (places.length < NICHMAT_PLACES) return null;
  const takenAt = places
    .map((r) => new Date(r.createdAt).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);
  const last = takenAt[NICHMAT_PLACES - 1];
  if (last === undefined) return null;
  return addDays(jerusalemDayOf(new Date(last)), 1);
}

/**
 * The start a chain that waited for its readers now has, for its creator
 * to record: once recorded, a place freed afterwards (a reader replaced by
 * the creator) no longer moves the forty days. Null when there is nothing
 * to record.
 */
export function startToRecord(
  session: Pick<Session, "startDay" | "startsWhenFull" | "reservations">,
): string | null {
  if (!session.startsWhenFull || session.startDay) return null;
  return startDayOf(session);
}

/** The last of the forty days. */
export function endDayOf(start: string): string {
  return addDays(start, NICHMAT_DAYS - 1);
}

export type NichmatPhase =
  /** Waiting for its forty readers. */
  | { kind: "waiting" }
  /** Its start is known and still to come. */
  | { kind: "upcoming"; start: string; end: string; daysUntil: number }
  /** Day `day` of the forty. */
  | { kind: "running"; start: string; end: string; day: number }
  /** The forty days are over. */
  | { kind: "done"; start: string; end: string };

/** Where the chain stands on `today` (the reader's day, YYYY-MM-DD). */
export function phaseOf(
  session: Pick<Session, "startDay" | "startsWhenFull" | "reservations">,
  today: string = localDayKey(),
): NichmatPhase {
  const start = startDayOf(session);
  if (!start) return { kind: "waiting" };
  const end = endDayOf(start);
  const offset = daysBetween(start, today);
  if (offset < 0) return { kind: "upcoming", start, end, daysUntil: -offset };
  if (offset >= NICHMAT_DAYS) return { kind: "done", start, end };
  return { kind: "running", start, end, day: offset + 1 };
}

/** The days that can be ticked on `today`: today's, and the ones before. */
export function lastTickableDay(phase: NichmatPhase): number {
  if (phase.kind === "running") return phase.day;
  if (phase.kind === "done") return NICHMAT_DAYS;
  return 0;
}

// ---------- Progress ----------

export interface NichmatPlaceProgress {
  place: number;
  reservation: TextStudyReservation;
  /** The days read, ticked by the holder. */
  read: Set<number>;
}

export interface NichmatProgress {
  places: NichmatPlaceProgress[];
  /** Readings ticked, out of 1,600. */
  reads: number;
  /** Readings due so far: the places taken, times the days already begun. */
  due: number;
  /** Places whose forty days are all read. */
  completedPlaces: number;
}

export function progressOf(
  session: Pick<Session, "startDay" | "startsWhenFull" | "reservations">,
  today: string = localDayKey(),
): NichmatProgress {
  const elapsed = lastTickableDay(phaseOf(session, today));
  const places = [...placesOf(session).entries()]
    .sort(([a], [b]) => a - b)
    .map(([place, reservation]) => ({ place, reservation, read: readDaysOf(session, place) }));
  return {
    places,
    reads: places.reduce((sum, p) => sum + p.read.size, 0),
    due: places.length * elapsed,
    completedPlaces: places.filter((p) => p.read.size >= NICHMAT_DAYS).length,
  };
}

/**
 * Over: closed by its creator, or its forty days past. A chain waiting for
 * its readers is not over, whatever the distant deadline it carries for the
 * published versions of the app.
 */
export function isNichmatFinished(
  session: Pick<Session, "isEnded" | "startDay" | "startsWhenFull" | "reservations">,
  today: string = localDayKey(),
): boolean {
  if (session.isEnded) return true;
  return phaseOf(session, today).kind === "done";
}

/**
 * The deadline a chain carries for the lists and for the published versions
 * of the app, which know nothing of the forty days: the last of them, or,
 * for a chain waiting for its readers, a year from its creation.
 */
export function deadlineDayFor(start: string | null, createdDay: string = localDayKey()): string {
  return start ? endDayOf(start) : addDays(createdDay, 365);
}
