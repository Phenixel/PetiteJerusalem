import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import type { Objective } from "../services/parcours/model";

/**
 * What has already been said (composables/useOfficesDone.ts), shared by the
 * home deck, the Sidour page and the end of a service's text: the window
 * under way is today's, as in the deck; past midnight, until 'hatsot of the
 * night, today is still the evening's day (parcours/days.ts, dayOfInstant).
 */

vi.mock("../services/authService", () => ({
  authService: { onAuthChanged: () => () => {} },
}));

const TEFILOT: Objective = {
  id: "tef",
  kind: "habit",
  preset: "tefilot",
  name: "",
  days: [0, 1, 2, 3, 4, 5, 6],
  moment: "morning",
  createdAt: 0,
  updatedAt: 0,
  since: "2026-10-01",
};

const CHEMA: Objective = {
  ...TEFILOT,
  id: "chema",
  preset: "chema-al-hamita",
  moment: "bedtime",
};

type Offices = ReturnType<typeof import("../composables/useOfficesDone").useOfficesDone>;
type Store = ReturnType<typeof import("../composables/useParcours").useParcours>;

async function mount(objectives: Objective[] = [TEFILOT]): Promise<{
  offices: Offices;
  store: Store;
}> {
  const { writeDeviceState } = await import("../services/parcours/deviceStore");
  const { emptyParcours } = await import("../services/parcours/model");
  const data = emptyParcours();
  for (const objective of objectives) data.objectives[objective.id] = objective;
  writeDeviceState({ data, owner: null, dirty: { objectives: [], days: [] } });
  const { useOfficesDone } = await import("../composables/useOfficesDone");
  const { useParcours } = await import("../composables/useParcours");
  let offices: Offices | null = null;
  let store: Store | null = null;
  createApp(
    defineComponent({
      setup() {
        offices = useOfficesDone();
        store = useParcours();
        return () => h("div");
      },
    }),
  ).mount(document.createElement("div"));
  return { offices: offices!, store: store! };
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("what has already been said", () => {
  it("counts Arvit after midnight on today's task, as the home deck does", async () => {
    // Wednesday 21 October 2026, 0:30 in Paris: yesterday's Arvit is under way.
    vi.useFakeTimers({ now: new Date("2026-10-20T22:30:00Z"), toFake: ["Date"] });
    const { offices, store } = await mount();
    const arvit = {
      tefila: "arvit" as const,
      start: new Date("2026-10-20T17:50:00Z"),
      end: new Date("2026-10-20T23:36:00Z"),
    };
    expect(offices.isOfficeDone(arvit)).toBe(false);
    offices.markOffice(arvit, true, "test");
    // The habit's task of the day the deck shows: today.
    const task = store.todayTasks.value.find((candidate) => candidate.step === "arvit");
    expect(store.data.value.days[store.today.value]?.done).toContain(task?.id);
    expect(offices.isOfficeDone(arvit)).toBe(true);
  });

  it("counts the bedtime Chema on its evening's day, after midnight too", async () => {
    // Wednesday 21 October 2026, 0:30 on the machine's clock: the night of the 20th.
    vi.useFakeTimers({ now: new Date(2026, 9, 21, 0, 30), toFake: ["Date"] });
    const { offices, store } = await mount([CHEMA]);
    const evening = new Date(2026, 9, 20, 12);
    const next = new Date(2026, 9, 21, 12);
    expect(offices.isChemaDone(evening)).toBe(false);
    offices.markChema(evening, true, "test");
    expect(store.data.value.days["2026-10-20"]?.done).toContain(CHEMA.id);
    expect(offices.isChemaDone(evening)).toBe(true);
    // The next evening's Chema is still to say.
    expect(offices.isChemaDone(next)).toBe(false);
  });

  it("without the habit, the device remembers the bedtime Chema", async () => {
    const { offices } = await mount([]);
    const evening = new Date(2026, 9, 20, 12);
    offices.markChema(evening, true, "test");
    expect(offices.isChemaDone(evening)).toBe(true);
    offices.markChema(evening, false, "test");
    expect(offices.isChemaDone(evening)).toBe(false);
  });
});
