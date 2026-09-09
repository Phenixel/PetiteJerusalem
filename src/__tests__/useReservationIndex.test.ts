import { describe, it, expect, vi } from "vitest";
import { ref } from "vue";
import type { Session, TextStudy, TextStudyReservation } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";

vi.mock("../services/firestoreService");
vi.mock("../firebase/firestore", () => ({ db: {} }));

import {
  chaptersOf,
  parseSlotKey,
  slotKey,
  useReservationIndex,
} from "../composables/useReservationIndex";

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

const session = (reservations: TextStudyReservation[]): Session =>
  ({ id: "s1", type: EnumTypeTextStudy.Mishna, reservations }) as unknown as Session;

describe("slotKey et parseSlotKey", () => {
  it("se répondent, pour une section comme pour le texte entier", () => {
    expect(slotKey("103", 4)).toBe("103#4");
    expect(parseSlotKey("103#4")).toEqual({ textStudyId: "103", section: 4 });
    expect(slotKey("103")).toBe("103#full");
    expect(parseSlotKey("103#full")).toEqual({ textStudyId: "103" });
  });

  it("chaptersOf numérote de 1 à n et réutilise le même tableau", () => {
    expect(chaptersOf(3)).toEqual([1, 2, 3]);
    expect(chaptersOf(3)).toBe(chaptersOf(3));
  });
});

describe("useReservationIndex", () => {
  it("indexe les réservations actives par emplacement et par texte", () => {
    const current = ref<Session | null>(
      session([
        reservation({ id: "a", section: 1 }),
        reservation({ id: "expire", section: 2, expiresAt: new Date(0).toISOString() }),
        reservation({ id: "entier", textStudyId: "104", section: undefined }),
      ]),
    );
    const texts = ref([text("103", 3), text("104", 2)]);
    const index = useReservationIndex(current, texts);

    expect(index.activeReservations.value.map((r) => r.id)).toEqual(["a", "entier"]);
    expect(index.reservationAt("103", 1)?.id).toBe("a");
    // Le tirage expiré ne tient plus sa place.
    expect(index.isSlotReserved("103", 2)).toBe(false);
    // Le texte entier couvre chacune de ses sections.
    expect(index.reservationAt("104", 2)?.id).toBe("entier");
    expect(index.statusIndex.value.get("103")?.status).toBe("partially_reserved");
    expect(index.statusIndex.value.get("104")?.status).toBe("fully_reserved");
    expect(index.availableSections(texts.value[0])).toEqual([2, 3]);
    expect(index.availableSections(texts.value[1])).toEqual([]);
  });

  it("suit les réservations ajoutées à la session", () => {
    const current = ref<Session | null>(session([]));
    const texts = ref([text("103", 2)]);
    const index = useReservationIndex(current, texts);

    expect(index.isSlotReserved("103", 1)).toBe(false);
    current.value!.reservations.push(reservation({ id: "b", section: 1 }));
    expect(index.isSlotReserved("103", 1)).toBe(true);
    expect(index.availableSections(texts.value[0])).toEqual([2]);
  });

  it("coche toutes les sections libres, puis les décoche", () => {
    const current = ref<Session | null>(session([reservation({ id: "a", section: 2 })]));
    const texts = ref([text("103", 3)]);
    const index = useReservationIndex(current, texts);
    const selected = new Set<string>();

    expect(index.selectAllAvailable(texts.value[0], selected)).toBe(true);
    expect([...selected].sort()).toEqual(["103#1", "103#3"]);
    expect(index.allAvailableSelected(texts.value[0], selected)).toBe(true);

    expect(index.selectAllAvailable(texts.value[0], selected)).toBe(false);
    expect(selected.size).toBe(0);
  });
});
