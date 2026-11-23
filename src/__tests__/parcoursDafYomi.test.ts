import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import { DAF_YOMI_ID, createCycle, cycleObjectiveId } from "../services/parcours/create";
import { taskEntries } from "../services/parcours/entries";
import { CYCLE_CHOICES, emptyParcours, type Objective } from "../services/parcours/model";
import { scheduleContext, tasksForDay } from "../services/parcours/schedule";

/**
 * The Daf Yomi as a cycle of My journey: one daf a day, every day, opened in
 * the reader on its daf with the task at the bottom (`?objectif=`).
 */

vi.mock("../services/authService", () => ({
  authService: { onAuthChanged: () => () => {} },
}));

// Monday 23 November 2026, at noon in Paris.
const NOW = new Date("2026-11-23T11:00:00Z");
const TODAY = "2026-11-23";

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.resetModules();
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("the Daf Yomi cycle", () => {
  const daf = createCycle("daf-yomi", TODAY, 1);

  it("is offered with the cycles, under one id", () => {
    expect(CYCLE_CHOICES).toContain("daf-yomi");
    expect(cycleObjectiveId("daf-yomi")).toBe(DAF_YOMI_ID);
    expect(daf).toMatchObject({ id: DAF_YOMI_ID, kind: "cycle", cycle: "daf-yomi" });
    expect(daf.moment).toBe("evening");
  });

  it("gives a task every day, Chabbat included, not a weekly one", () => {
    const data = emptyParcours();
    data.objectives[daf.id] = daf;
    const ctx = scheduleContext(data, () => false);
    for (const day of ["2026-11-23", "2026-11-28"]) {
      const tasks = tasksForDay(data, day, ctx);
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({ id: DAF_YOMI_ID, weekly: false });
    }
  });

  it("asks for the tractate of the day's daf to be on the device", () => {
    const task = {
      id: daf.id,
      objectiveId: daf.id,
      kind: daf.kind,
      moment: daf.moment,
      weekly: false,
    };
    // 23 November 2026: Arakhin 6 (cycle 14, 196 days before Niddah 73 on 7 June 2027).
    const entries = taskEntries(task, daf, TODAY, false);
    expect(entries.map((entry) => entry.link)).toEqual(["https://www.sefaria.org/Arakhin"]);
  });

  it("is named Daf yomi, reads the day's daf, and opens it with the task", async () => {
    const { writeDeviceState } = await import("../services/parcours/deviceStore");
    const data = emptyParcours();
    data.objectives[daf.id] = daf as Objective;
    writeDeviceState({ data, owner: null, dirty: { objectives: [], days: [] } });

    const { useParcoursViews } = await import("../composables/useParcoursViews");
    const { useParcours } = await import("../composables/useParcours");
    let views: ReturnType<typeof useParcoursViews> | null = null;
    let store: ReturnType<typeof useParcours> | null = null;
    createApp(
      defineComponent({
        setup() {
          views = useParcoursViews();
          store = useParcours();
          return () => h("div");
        },
      }),
    )
      .use(createI18n({ legacy: false, locale: "fr", messages: { fr } }))
      .mount(document.createElement("div"));

    const task = store!.todayTasks.value.find((one) => one.objectiveId === DAF_YOMI_ID)!;
    const view = views!.taskView(task, TODAY);
    expect(view.title).toBe("Daf yomi");
    expect(view.meta).toBe("Arakhin 6");
    expect(view.route).toMatchObject({ query: { daf: "6a", objectif: DAF_YOMI_ID } });
    expect(views!.volumeOf(daf).lines).toEqual(["Talmud"]);
  });
});
