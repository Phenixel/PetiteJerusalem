import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import type { ParcoursStore } from "../composables/useParcours";
import { emptyParcours } from "../services/parcours/model";
import type { HabitObjective, ParcoursData } from "../services/parcours/model";

/**
 * Mon parcours avec et sans compte (composables/useParcours.ts).
 *
 * Sans compte, tout vit sur l'appareil, et c'est complet : rien n'attend une
 * connexion. À la connexion, ce qui a été fait sans compte le rejoint, et
 * part vers lui entrée par entrée. Un autre compte qui se connecte sur le
 * même appareil ne reçoit pas ce que le premier y a laissé, seulement ce qui
 * a été fait depuis son départ.
 */

type Listener = (user: { id: string } | null) => void;
let listener: Listener = () => {};

vi.mock("../services/authService", () => ({
  authService: {
    onAuthChanged: (cb: Listener) => {
      listener = cb;
      return () => {};
    },
  },
}));

let accounts: Record<string, ParcoursData> = {};
const writes = vi.fn<(uid: string, objectives: string[], days: string[]) => void>();

vi.mock("../services/parcours/cloud", () => ({
  fetchAccountParcours: (uid: string) => Promise.resolve(accounts[uid] ?? emptyParcours()),
  writeAccountEntries: (
    uid: string,
    data: ParcoursData,
    entries: { objectives: string[]; days: string[] },
  ) => {
    writes(uid, entries.objectives, entries.days);
    const account = (accounts[uid] ??= emptyParcours());
    for (const id of entries.objectives) account.objectives[id] = data.objectives[id];
    for (const day of entries.days) account.days[day] = data.days[day];
    return Promise.resolve();
  },
}));

vi.mock("../services/userPreferencesService", () => ({
  userPreferencesService: {
    getPreferencesFromServer: () =>
      Promise.resolve({
        dailyReadingIds: [],
        dailyReadingOptions: [],
        dailyReadingProgress: { date: "", completedIds: [] },
      }),
    savePreferences: vi.fn(() => Promise.resolve()),
    saveDailyProgress: vi.fn(() => Promise.resolve("saved")),
  },
}));

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await vi.advanceTimersByTimeAsync(2000);
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

async function mountStore(): Promise<ParcoursStore> {
  const { useParcours } = await import("../composables/useParcours");
  let store: ParcoursStore | null = null;
  createApp(
    defineComponent({
      setup() {
        store = useParcours();
        return () => h("div");
      },
    }),
  ).mount(document.createElement("div"));
  await settle();
  return store!;
}

const habit = (id: string): HabitObjective => ({
  id,
  kind: "habit",
  preset: "tefilin",
  name: "",
  days: [0, 1, 2, 3, 4, 5],
  moment: "morning",
  since: "2026-10-11",
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date(2026, 9, 14, 9));
  localStorage.clear();
  accounts = {};
  writes.mockClear();
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Mon parcours, avec ou sans compte", () => {
  it("sert sans compte, puis verse tout dans le compte qui se connecte", async () => {
    const store = await mountStore();
    listener(null);
    store.saveObjective(habit("tefilin"));
    await settle();
    expect(store.data.value.objectives.tefilin).toBeDefined();
    expect(writes).not.toHaveBeenCalled();

    listener({ id: "u1" });
    await settle();
    expect(accounts.u1.objectives.tefilin).toBeDefined();
  });

  it("ne verse pas dans un second compte ce que le premier a laissé", async () => {
    const store = await mountStore();
    listener({ id: "u1" });
    await settle();
    store.saveObjective(habit("du-premier"));
    await settle();
    expect(accounts.u1.objectives["du-premier"]).toBeDefined();

    listener(null);
    vi.advanceTimersByTime(60_000);
    store.saveObjective(habit("sans-compte"));
    await settle();

    listener({ id: "u2" });
    await settle();
    expect(Object.keys(store.data.value.objectives)).toEqual(["sans-compte"]);
    expect(accounts.u2.objectives["du-premier"]).toBeUndefined();
    expect(accounts.u2.objectives["sans-compte"]).toBeDefined();
  });
});
