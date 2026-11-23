import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import { togglePsalm } from "../composables/useTehilimCycleTask";

/**
 * A Tehilim cycle of Mon parcours read on the Tehilim of the day page
 * (useTehilimCycleTask): each psalm is marked on its own, the last one marks
 * the day's task, and the card of the cycle opens that page with its
 * objective.
 */

vi.mock("../services/authService", () => ({
  authService: { onAuthChanged: () => () => {} },
}));

// Wednesday 14 October 2026, 9 a.m. in Paris: the week's psalms are 73 to 89.
const NOW = new Date("2026-10-14T07:00:00Z");
const TODAY = "2026-10-14";

type Tracked = ReturnType<typeof import("../composables/useTehilimCycleTask").useTehilimCycleTask>;
type Views = ReturnType<typeof import("../composables/useParcoursViews").useParcoursViews>;
type Store = ReturnType<typeof import("../composables/useParcours").useParcours>;

async function mountWeekCycle(): Promise<{
  tracked: Tracked;
  views: Views;
  store: Store;
  id: string;
}> {
  const { writeDeviceState } = await import("../services/parcours/deviceStore");
  const { emptyParcours } = await import("../services/parcours/model");
  const { createCycle } = await import("../services/parcours/create");
  const week = createCycle("tehilim-week", TODAY, 10);
  const data = emptyParcours();
  data.objectives[week.id] = week;
  writeDeviceState({ data, owner: null, dirty: { objectives: [], days: [] } });

  const { useTehilimCycleTask } = await import("../composables/useTehilimCycleTask");
  const { useParcoursViews } = await import("../composables/useParcoursViews");
  const { useParcours } = await import("../composables/useParcours");
  let tracked: Tracked | null = null;
  let views: Views | null = null;
  let store: Store | null = null;
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  createApp(
    defineComponent({
      setup() {
        tracked = useTehilimCycleTask(() => week.id);
        views = useParcoursViews();
        store = useParcours();
        return () => h("div");
      },
    }),
  )
    .use(i18n)
    .mount(document.createElement("div"));
  return { tracked: tracked!, views: views!, store: store!, id: week.id };
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.resetModules();
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("togglePsalm", () => {
  it("marks a psalm, and the last one marks the task", () => {
    expect(togglePsalm([], 1, [1, 2], false)).toEqual({ read: [1], taskDone: false });
    expect(togglePsalm([1], 2, [1, 2], false)).toEqual({ read: [1, 2], taskDone: true });
  });

  it("unmarks one psalm of a task done elsewhere, and keeps the others read", () => {
    expect(togglePsalm([], 2, [1, 2, 3], true)).toEqual({ read: [1, 3], taskDone: false });
  });

  it("forgets psalms that are not the day's", () => {
    expect(togglePsalm([40, 1], 2, [1, 2], false)).toEqual({ read: [1, 2], taskDone: true });
  });
});

describe("a Tehilim cycle on the Tehilim of the day page", () => {
  it("opens from its card on that page, with its objective", async () => {
    const { views, store, id } = await mountWeekCycle();
    const task = store.todayTasks.value.find((one) => one.objectiveId === id)!;
    expect(views.taskView(task, TODAY).route).toEqual({
      path: "/bibliotheque/tehilim-du-jour",
      query: { objectif: id },
    });
  });

  it("gives the week's psalms of the day, each marked on its own, the last marking the task", async () => {
    const { tracked } = await mountWeekCycle();
    expect(tracked.cycle.value?.psalms).toEqual(Array.from({ length: 17 }, (_, i) => 73 + i));
    const ids = tracked.cycle.value!.entries.map((entry) => Number(entry.id));
    expect(ids).toHaveLength(17);

    for (const id of ids.slice(0, -1)) expect(tracked.toggle(id)).toBe(true);
    expect(tracked.readCount.value).toBe(16);
    expect(tracked.taskDone.value).toBe(false);

    tracked.toggle(ids[ids.length - 1]);
    expect(tracked.taskDone.value).toBe(true);
    expect(tracked.readCount.value).toBe(17);

    // Unmarking one psalm unmarks the day, the others stay read.
    expect(tracked.toggle(ids[3])).toBe(false);
    expect(tracked.taskDone.value).toBe(false);
    expect(tracked.readCount.value).toBe(16);
    expect(tracked.isRead(ids[3])).toBe(false);
  });
});
