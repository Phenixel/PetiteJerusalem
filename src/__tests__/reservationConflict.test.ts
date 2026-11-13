import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import type { Session, TextStudy, TextStudyReservation } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";

/**
 * A reservation refused by the transaction (SlotTakenError): somebody else
 * took the section between the moment the page read the chain and the moment
 * the reader confirmed. The chain was not re-read afterwards, so the section
 * kept showing as free: the reader pressed again, and got the same refusal.
 * Seen on 16 October 2026, `reservation_failed` with `reason: "conflict"`,
 * four attempts in one minute from the same person, four people that day.
 */

vi.mock("../services/firestoreService");
vi.mock("../firebase/firestore", () => ({ db: {} }));

import { sessionService } from "../services/sessionService";
import { firestoreService } from "../services/firestoreService";
import { slotKey, useReservationIndex } from "../composables/useReservationIndex";

const reservation = (overrides: Partial<TextStudyReservation> = {}): TextStudyReservation => ({
  id: "r1",
  textStudyId: "103",
  section: 1,
  chosenByName: "Sarah",
  chosenByGuestId: "guest-1",
  isCompleted: false,
  createdAt: new Date(),
  ...overrides,
});

const chain = (reservations: TextStudyReservation[]): Session =>
  ({ id: "s1", type: EnumTypeTextStudy.Mishna, reservations }) as unknown as Session;

const text = (id: string, totalSections: number): TextStudy =>
  ({
    id,
    name: `Texte ${id}`,
    livre: "Livre",
    link: "",
    totalSections,
    type: EnumTypeTextStudy.Mishna,
    createdAt: new Date(),
  }) as unknown as TextStudy;

describe("sessionService.refreshReservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("brings in the reservation that the transaction refused the slot for", async () => {
    const taken = reservation({ id: "theirs", section: 2, chosenByName: "David" });
    const local = chain([reservation({ id: "mine", section: 1 })]);
    vi.mocked(firestoreService.getSessionById).mockResolvedValue(
      chain([reservation({ id: "mine", section: 1 }), taken]),
    );

    await sessionService.refreshReservations(local);

    expect(firestoreService.getSessionById).toHaveBeenCalledWith("s1");
    expect(local.reservations.map((r) => r.id)).toEqual(["mine", "theirs"]);
  });

  it("gives an empty array to a chain whose document carries no reservations", async () => {
    const local = chain([reservation()]);
    vi.mocked(firestoreService.getSessionById).mockResolvedValue({
      id: "s1",
    } as unknown as Session);

    await sessionService.refreshReservations(local);

    expect(local.reservations).toEqual([]);
  });

  it("leaves the local state alone when the chain has disappeared", async () => {
    const local = chain([reservation({ id: "mine" })]);
    vi.mocked(firestoreService.getSessionById).mockResolvedValue(null);

    await sessionService.refreshReservations(local);

    expect(local.reservations.map((r) => r.id)).toEqual(["mine"]);
  });
});

describe("dropReservedFrom", () => {
  it("drops the slots taken meanwhile and keeps the ones still free", () => {
    const current = ref<Session | null>(chain([]));
    const texts = ref([text("103", 3)]);
    const index = useReservationIndex(current, texts);
    const selected = new Set([slotKey("103", 1), slotKey("103", 2), slotKey("103", 3)]);

    // The chain comes back from the re-read with sections 1 and 3 taken.
    current.value = chain([
      reservation({ id: "a", section: 1 }),
      reservation({ id: "b", section: 3 }),
    ]);

    expect(index.dropReservedFrom(selected)).toBe(2);
    expect([...selected]).toEqual([slotKey("103", 2)]);
  });

  it("keeps a selection that nobody has taken", () => {
    const current = ref<Session | null>(
      chain([reservation({ id: "expired", section: 2, expiresAt: new Date(0).toISOString() })]),
    );
    const texts = ref([text("103", 2)]);
    const index = useReservationIndex(current, texts);
    const selected = new Set([slotKey("103", 1), slotKey("103", 2)]);

    // An abandoned draw holds nothing: its section stays selectable.
    expect(index.dropReservedFrom(selected)).toBe(0);
    expect(selected.size).toBe(2);
  });
});
