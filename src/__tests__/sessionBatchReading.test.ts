import { describe, it, expect, vi, beforeAll } from "vitest";
import type { TextStudyReservation } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";

vi.mock("../services/firestoreService");
vi.mock("../firebase/firestore", () => ({ db: {} }));

// Node >= 22 hides jsdom's localStorage: a minimal in-memory stub.
beforeAll(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  });
});

import { guestService } from "../services/guestService";
import {
  READ_NOW_TTL_MS,
  batchReadings,
  needsRenewal,
  offersBatchReading,
  readsRightAway,
  supportsBatchReading,
} from "../services/sessionBatchReading";

/** Tehilim 1, 2 and 3 in textStudies.json. */
const T1 = "103";
const T2 = "104";
const T3 = "105";
const user = { id: "u1", email: "u1@mail.fr" };

const reservation = (overrides: Partial<TextStudyReservation> = {}): TextStudyReservation => ({
  id: overrides.textStudyId ?? "r",
  textStudyId: T1,
  section: 1,
  chosenById: "u1",
  isCompleted: false,
  createdAt: new Date(),
  ...overrides,
});

const tehilim = (reservations: TextStudyReservation[]) => ({
  type: EnumTypeTextStudy.Tehilim,
  reservations,
});

describe("reading the Tehilim of a chain at once", () => {
  it("only applies to Tehilim chains", () => {
    expect(supportsBatchReading({ type: EnumTypeTextStudy.Tehilim })).toBe(true);
    expect(supportsBatchReading({ type: EnumTypeTextStudy.Mishna })).toBe(false);
    expect(
      batchReadings(
        { type: EnumTypeTextStudy.Mishna, reservations: [reservation({ textStudyId: "41" })] },
        user,
      ),
    ).toEqual([]);
  });

  it("keeps the reader's psalms, in the order of the book, read or not", () => {
    const readings = batchReadings(
      tehilim([
        reservation({ textStudyId: T3 }),
        reservation({ textStudyId: T1, isCompleted: true }),
        reservation({ textStudyId: T2, chosenById: "someone-else" }),
      ]),
      user,
    );
    expect(readings.map((r) => r.entry.name)).toEqual(["Tehilim 1", "Tehilim 3"]);
  });

  it("leaves out an abandoned draw, which is no longer the reader's", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const readings = batchReadings(
      tehilim([
        reservation({ textStudyId: T1 }),
        reservation({ textStudyId: T2, expiresAt: past }),
      ]),
      user,
    );
    expect(readings.map((r) => r.reservation.textStudyId)).toEqual([T1]);
  });

  it("recognizes a guest by this device's identity", () => {
    const localId = guestService.getOrCreateLocalGuestId();
    const readings = batchReadings(
      tehilim([
        reservation({ textStudyId: T1, chosenById: undefined, chosenByGuestId: localId }),
        reservation({ textStudyId: T2, chosenById: undefined, chosenByGuestId: "other" }),
      ]),
      null,
    );
    expect(readings.map((r) => r.reservation.textStudyId)).toEqual([T1]);
  });

  it("is offered from two psalms, as long as one is still to read", () => {
    const one = batchReadings(tehilim([reservation({ textStudyId: T1 })]), user);
    const two = batchReadings(
      tehilim([reservation({ textStudyId: T1 }), reservation({ textStudyId: T2 })]),
      user,
    );
    const allRead = batchReadings(
      tehilim([
        reservation({ textStudyId: T1, isCompleted: true }),
        reservation({ textStudyId: T2, isCompleted: true }),
      ]),
      user,
    );
    expect(offersBatchReading(one)).toBe(false);
    expect(offersBatchReading(two)).toBe(true);
    expect(offersBatchReading(allRead)).toBe(false);
  });

  it("on the perpetual chain, one psalm is enough: nothing is kept for later", () => {
    const one = batchReadings(tehilim([reservation({ textStudyId: T1 })]), user);
    expect(offersBatchReading(one, 1)).toBe(true);
  });
});

describe("the perpetual chain reads right away", () => {
  it("applies to the perpetual chain only", () => {
    expect(readsRightAway({ perpetual: true })).toBe(true);
    expect(readsRightAway({})).toBe(false);
    expect(readsRightAway(null)).toBe(false);
  });

  it("pushes back a psalm about to lose its slot, never a longer hold", () => {
    const now = Date.now();
    const at = (ms: number) => new Date(now + ms).toISOString();
    expect(needsRenewal({ isCompleted: false, expiresAt: at(10 * 60_000) }, now)).toBe(true);
    expect(needsRenewal({ isCompleted: false, expiresAt: at(READ_NOW_TTL_MS) }, now)).toBe(false);
    // The day an older version gets: "pushing it back" would shorten it.
    expect(needsRenewal({ isCompleted: false, expiresAt: at(24 * 3600_000) }, now)).toBe(false);
    expect(needsRenewal({ isCompleted: true, expiresAt: at(60_000) }, now)).toBe(false);
    expect(needsRenewal({ isCompleted: false }, now)).toBe(false);
    expect(needsRenewal({ isCompleted: false, expiresAt: "illisible" }, now)).toBe(false);
  });
});
