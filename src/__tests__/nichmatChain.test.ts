import { describe, expect, it, vi } from "vitest";
import type { ReservationRecord, Session, TextStudyReservation } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";
import {
  NICHMAT_DAYS,
  NICHMAT_PLACES,
  NICHMAT_TEXT_ID,
  addDays,
  dayOfRecord,
  dayRecordTextId,
  deadlineDayFor,
  firstFreePlace,
  isNichmatFinished,
  isPlaceRecord,
  jerusalemDayOf,
  lastTickableDay,
  phaseOf,
  progressOf,
  startDayOf,
  startToRecord,
} from "../services/nichmatChain";
import textStudiesJson from "../datas/textStudies.json";

/**
 * Nichmat 40 (docs/nichmat-40-jours.md): forty places, forty days, and a
 * start chosen at creation or the day after the fortieth place is taken.
 */

const store: { reservations: ReservationRecord[] } = { reservations: [] };

vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("../services/firestoreService", () => ({
  firestoreService: { invalidateSessionsCache: vi.fn() },
}));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, _collection: string, id: string) => id,
  runTransaction: async (
    _db: unknown,
    fn: (t: {
      get: () => Promise<{ exists: () => boolean; data: () => typeof store }>;
      update: (ref: string, data: { reservations: ReservationRecord[] }) => void;
    }) => Promise<unknown>,
  ) =>
    fn({
      get: async () => ({
        exists: () => true,
        data: () => ({ reservations: store.reservations.map((r) => ({ ...r })) }),
      }),
      update: (_ref, data) => {
        store.reservations = data.reservations;
      },
    }),
}));

import { reservationService, ReservationGoneError } from "../services/reservationService";

function place(section: number, createdAt = "2026-10-20T10:00:00Z"): TextStudyReservation {
  return {
    id: `place-${section}`,
    textStudyId: NICHMAT_TEXT_ID,
    section,
    chosenById: `user-${section}`,
    chosenByName: `Reader ${section}`,
    isCompleted: false,
    createdAt: createdAt as unknown as Date,
  };
}

function dayRead(section: number, day: number, isCompleted = true): TextStudyReservation {
  return {
    id: `day-${section}-${day}`,
    textStudyId: dayRecordTextId(day),
    section,
    isCompleted,
    createdAt: new Date(),
  };
}

function chain(fields: Partial<Session>): Session {
  return {
    id: "s",
    name: "Nichmat",
    type: EnumTypeTextStudy.Nichmat,
    description: "",
    dateLimit: new Date(),
    createdAt: new Date(),
    personId: "owner",
    creatorName: "Owner",
    reservations: [],
    ...fields,
  };
}

const fortyPlaces = (lastAt: string) =>
  Array.from({ length: NICHMAT_PLACES }, (_, i) =>
    place(i + 1, i === NICHMAT_PLACES - 1 ? lastAt : "2026-10-01T08:00:00Z"),
  );

describe("Nichmat 40: the entries", () => {
  it("points to the Nichmat page of the library", () => {
    const entry = textStudiesJson.textStudies.find((e) => String(e.id) === NICHMAT_TEXT_ID);
    expect(entry?.name).toContain("Nichmat");
  });

  it("tells a place from a day read", () => {
    expect(isPlaceRecord(place(1))).toBe(true);
    expect(isPlaceRecord(place(41))).toBe(false);
    expect(isPlaceRecord(dayRead(1, 3))).toBe(false);
    expect(dayOfRecord(dayRead(1, 3))).toBe(3);
    expect(dayOfRecord(place(1))).toBeNull();
    expect(dayOfRecord({ textStudyId: "686/41" })).toBeNull();
  });

  it("gives the first free place", () => {
    expect(firstFreePlace(chain({ reservations: [place(1), place(3)] }))).toBe(2);
    expect(firstFreePlace(chain({ reservations: fortyPlaces("2026-10-01T08:00:00Z") }))).toBeNull();
  });
});

describe("Nichmat 40: the start", () => {
  it("takes the day chosen at creation", () => {
    expect(startDayOf(chain({ startDay: "2026-11-01" }))).toBe("2026-11-01");
  });

  it("waits for the fortieth place", () => {
    const session = chain({ startsWhenFull: true, reservations: [place(1), place(2)] });
    expect(startDayOf(session)).toBeNull();
    expect(phaseOf(session, "2026-10-20")).toEqual({ kind: "waiting" });
  });

  it("starts the day after the fortieth place, in Jerusalem", () => {
    // 22:30 in Paris on 20 October is already the 21st in Jerusalem.
    const session = chain({
      startsWhenFull: true,
      reservations: fortyPlaces("2026-10-20T21:30:00Z"),
    });
    expect(jerusalemDayOf(new Date("2026-10-20T21:30:00Z"))).toBe("2026-10-21");
    expect(startDayOf(session)).toBe("2026-10-22");
    expect(startToRecord(session)).toBe("2026-10-22");
    expect(startToRecord({ ...session, startDay: "2026-10-22" })).toBeNull();
  });

  it("keeps a recorded start when a place is freed", () => {
    const places = fortyPlaces("2026-10-20T10:00:00Z").slice(1);
    const session = chain({ startsWhenFull: true, startDay: "2026-10-21", reservations: places });
    expect(startDayOf(session)).toBe("2026-10-21");
  });
});

describe("Nichmat 40: the days", () => {
  const session = chain({ startDay: "2026-10-20" });

  it("counts the forty days from the start", () => {
    expect(phaseOf(session, "2026-10-18")).toMatchObject({ kind: "upcoming", daysUntil: 2 });
    expect(phaseOf(session, "2026-10-20")).toMatchObject({ kind: "running", day: 1 });
    expect(phaseOf(session, "2026-11-28")).toMatchObject({ kind: "running", day: 40 });
    expect(phaseOf(session, "2026-11-29")).toMatchObject({ kind: "done", end: "2026-11-28" });
  });

  it("crosses a change of hour and of month", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("lets today and the days before be ticked, not the next ones", () => {
    expect(lastTickableDay(phaseOf(session, "2026-10-24"))).toBe(5);
    expect(lastTickableDay(phaseOf(session, "2026-10-19"))).toBe(0);
    expect(lastTickableDay(phaseOf(session, "2027-01-01"))).toBe(NICHMAT_DAYS);
  });

  it("ends with its forty days", () => {
    expect(isNichmatFinished(session, "2026-11-28")).toBe(false);
    expect(isNichmatFinished(session, "2026-11-29")).toBe(true);
    expect(isNichmatFinished(chain({ startsWhenFull: true }), "2030-01-01")).toBe(false);
  });

  it("carries the last day as its deadline, or a year while it waits", () => {
    expect(deadlineDayFor("2026-10-20")).toBe("2026-11-28");
    expect(deadlineDayFor(null, "2026-10-20")).toBe("2027-10-20");
  });
});

describe("Nichmat 40: the progress", () => {
  it("counts the ticked days of each place, not the unticked ones", () => {
    const session = chain({
      startDay: "2026-10-20",
      reservations: [place(1), place(2), dayRead(1, 1), dayRead(1, 2), dayRead(2, 1, false)],
    });
    const progress = progressOf(session, "2026-10-22");
    expect(progress.places.map((p) => p.read.size)).toEqual([2, 0]);
    expect(progress.reads).toBe(2);
    expect(progress.due).toBe(6);
    expect(progress.completedPlaces).toBe(0);
  });
});

describe("Nichmat 40: ticking a day", () => {
  it("adds a day read, then removes it", async () => {
    store.reservations = [place(4) as unknown as ReservationRecord];
    await reservationService.setNichmatDayRead("s", 4, 2, true);
    expect(store.reservations).toHaveLength(2);
    expect(store.reservations[1]).toMatchObject({
      textStudyId: "686/2",
      section: 4,
      isCompleted: true,
    });
    expect(store.reservations[1].chosenById).toBeUndefined();

    // Ticked twice: nothing more.
    await reservationService.setNichmatDayRead("s", 4, 2, true);
    expect(store.reservations).toHaveLength(2);

    await reservationService.setNichmatDayRead("s", 4, 2, false);
    expect(store.reservations).toHaveLength(1);
  });

  it("refuses a place no longer taken", async () => {
    store.reservations = [];
    await expect(reservationService.setNichmatDayRead("s", 4, 2, true)).rejects.toBeInstanceOf(
      ReservationGoneError,
    );
  });

  it("takes the day reads away with a place its creator frees", async () => {
    store.reservations = [place(1), place(2), dayRead(1, 1), dayRead(2, 1)].map(
      (r) => r as unknown as ReservationRecord,
    );
    await reservationService.deleteReservations("s", ["place-1"]);
    expect(store.reservations.map((r) => r.id)).toEqual(["place-2", "day-2-1"]);
  });
});
