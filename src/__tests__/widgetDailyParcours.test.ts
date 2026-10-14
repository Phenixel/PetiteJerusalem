import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

/**
 * La lecture du jour des widgets et de la montre vient de Mon parcours, tel
 * que l'appareil le tient : sans compte aussi, puisque le parcours se tient
 * sans compte dans l'app. Elle venait du profil du compte, et un appareil
 * sans compte n'avait qu'un widget vide.
 */

const { setPayloads } = vi.hoisted(() => ({
  setPayloads: vi.fn<(payloads: Record<string, string>) => Promise<void>>(() => Promise.resolve()),
}));

vi.mock("@capacitor/core", async (original) => ({
  ...(await original<typeof import("@capacitor/core")>()),
  registerPlugin: () => ({ setPayloads }),
}));
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true, appPlatform: "android" }));
vi.mock("../composables/useTheme", () => ({
  useTheme: () => ({ appliedTheme: ref({ primary: "#1d4ed8" }) }),
}));
vi.mock("../services/authService", () => ({ authService: { onAuthChanged: vi.fn() } }));
vi.mock("../services/userPreferencesService", () => ({
  userPreferencesService: { getPreferencesOrThrow: vi.fn() },
}));
vi.mock("../services/watchService", () => ({
  watchService: { publish: () => Promise.resolve(), onRequest: vi.fn(), reset: vi.fn() },
}));

vi.stubGlobal("requestIdleCallback", (cb: () => void) => setTimeout(cb, 0));

const { localDayKey } = await import("../services/dateService");
const { writeDeviceState } = await import("../services/parcours/deviceStore");
const { legacyTextObjective } = await import("../services/parcours/legacyDailyReading");
const { emptyParcours } = await import("../services/parcours/model");
const { widgetService } = await import("../services/widgetService");

describe("la lecture du jour des widgets", () => {
  it("montre le parcours de l'appareil, sans compte", async () => {
    const today = localDayKey();
    const data = emptyParcours();
    const tehilim1 = legacyTextObjective(103, today, 1);
    data.objectives[tehilim1.id] = tehilim1;
    data.days[today] = { done: [tehilim1.id], at: 1 };
    writeDeviceState({ data, owner: null, dirty: { objectives: [], days: [] } });

    await widgetService.refresh();

    const daily = setPayloads.mock.calls.map(([payloads]) => payloads.daily).filter(Boolean);
    const payload = JSON.parse(daily.at(-1) ?? "{}") as {
      configured: boolean;
      items: { key: string; done: boolean }[];
    };
    expect(payload.configured).toBe(true);
    expect(payload.items).toEqual([expect.objectContaining({ key: "103", done: true })]);
  });
});
