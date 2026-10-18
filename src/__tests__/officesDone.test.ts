import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import type { Objective } from "../services/parcours/model";

/**
 * What has already been said (composables/useOfficesDone.ts), shared by the
 * home deck, the Sidour page and the end of a service's text: the window
 * under way is today's, as in the deck, Arvit after midnight included.
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

type Offices = ReturnType<typeof import("../composables/useOfficesDone").useOfficesDone>;
type Store = ReturnType<typeof import("../composables/useParcours").useParcours>;

async function mount(): Promise<{ offices: Offices; store: Store }> {
  const { writeDeviceState } = await import("../services/parcours/deviceStore");
  const { emptyParcours } = await import("../services/parcours/model");
  const data = emptyParcours();
  data.objectives[TEFILOT.id] = TEFILOT;
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
});
