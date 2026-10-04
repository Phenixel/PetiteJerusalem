import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

/**
 * Les rappels d'entrée du Chabbat et des fêtes tombent une heure avant
 * l'allumage, et l'allumage se lit sur l'écart choisi (18, 20, 30 ou 40
 * minutes avant la chkia). Les rappels se reprogrammaient quand bougeaient
 * l'opinion, le lieu ou la langue, mais pas cet écart : passer de 18 à 40
 * laissait le rappel à l'ancienne heure, vingt-deux minutes trop tard,
 * jusqu'au prochain retour au premier plan.
 */

vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true, appPlatform: "android" }));
vi.mock("@capacitor/app", () => ({ App: { addListener: vi.fn() } }));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    addListener: vi.fn(),
    getPending: () => Promise.resolve({ notifications: [] }),
    cancel: vi.fn(),
    schedule: vi.fn(),
    checkPermissions: () => Promise.resolve({ display: "granted" }),
  },
}));

const { zmanReminderService } = await import("../services/zmanReminderService");
const { useCandleLighting } = await import("../composables/useCandleLighting");

describe("rappels et écart d'allumage", () => {
  it("se reprogramment quand l'écart change", async () => {
    const refresh = vi.spyOn(zmanReminderService, "refresh").mockResolvedValue();
    zmanReminderService.init({ push: vi.fn() } as never);
    await nextTick();
    refresh.mockClear();

    useCandleLighting().choose(40);
    await nextTick();

    expect(refresh).toHaveBeenCalled();
  });
});
