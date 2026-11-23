import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import { cycleEntries, markPsalm, psalmsRead } from "../services/parcours/dailyBook";

/**
 * The daily book (services/parcours/dailyBook.ts, useDailyBook): the daily
 * texts and the Tehilim of the day in one list, each psalm marked on its own,
 * a psalm given twice read once, the last psalm of a cycle marking its task,
 * and the cycle's card opening the daily book.
 */

vi.mock("../services/authService", () => ({
  authService: { onAuthChanged: () => () => {} },
}));

// Wednesday 14 October 2026 (3 Heshvan 5787), 9 a.m. in Paris: the week's
// psalms are 73 to 89, the month's 18 to 22.
const NOW = new Date("2026-10-14T07:00:00Z");
const TODAY = "2026-10-14";

type Book = ReturnType<typeof import("../composables/useDailyBook").useDailyBook>;
type Views = ReturnType<typeof import("../composables/useParcoursViews").useParcoursViews>;
type Store = ReturnType<typeof import("../composables/useParcours").useParcours>;

const idsOf = (cycle: "tehilim-month" | "tehilim-week"): number[] =>
  cycleEntries(cycle, TODAY).map((entry) => Number(entry.id));

/** Mounts the book with the week's cycle, and the texts given (catalog ids). */
async function mountBook(
  options: { month?: boolean; texts?: number[] } = {},
): Promise<{ book: Book; views: Views; store: Store }> {
  const { writeDeviceState } = await import("../services/parcours/deviceStore");
  const { emptyParcours } = await import("../services/parcours/model");
  const { createCycle, createText } = await import("../services/parcours/create");
  const data = emptyParcours();
  const week = createCycle("tehilim-week", TODAY, 10);
  data.objectives[week.id] = week;
  if (options.month) {
    const month = createCycle("tehilim-month", TODAY, 11);
    data.objectives[month.id] = month;
  }
  (options.texts ?? []).forEach((textId, i) => {
    const text = createText(textId, TODAY, 20 + i);
    data.objectives[text.id] = text;
  });
  writeDeviceState({ data, owner: null, dirty: { objectives: [], days: [] } });

  const { useDailyBook } = await import("../composables/useDailyBook");
  const { useParcoursViews } = await import("../composables/useParcoursViews");
  const { useParcours } = await import("../composables/useParcours");
  let book: Book | null = null;
  let views: Views | null = null;
  let store: Store | null = null;
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  createApp(
    defineComponent({
      setup() {
        book = useDailyBook();
        views = useParcoursViews();
        store = useParcours();
        return () => h("div");
      },
    }),
  )
    .use(i18n)
    .mount(document.createElement("div"));
  return { book: book!, views: views!, store: store! };
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.resetModules();
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("the psalms of a cycle marked one by one", () => {
  it("marks a psalm, and the last one marks the task", () => {
    expect(markPsalm([], 1, [1, 2], false, true)).toEqual({ read: [1], taskDone: false });
    expect(markPsalm([1], 2, [1, 2], false, true)).toEqual({ read: [1, 2], taskDone: true });
  });

  it("unmarks one psalm of a task done elsewhere, and keeps the others read", () => {
    expect(markPsalm([], 2, [1, 2, 3], true, false)).toEqual({ read: [1, 3], taskDone: false });
  });

  it("forgets psalms that are not the day's", () => {
    expect(markPsalm([40, 1], 2, [1, 2], false, true)).toEqual({ read: [1, 2], taskDone: true });
  });

  it("counts none read when every psalm was ticked but the task unmarked elsewhere", () => {
    expect(psalmsRead([1, 2], [1, 2], false)).toEqual([]);
    expect(psalmsRead([1], [1, 2], false)).toEqual([1]);
    expect(psalmsRead([], [1, 2], true)).toEqual([1, 2]);
  });
});

describe("the daily book", () => {
  it("lists the cycle's psalms among the daily texts, in the order of the book", async () => {
    const week = idsOf("tehilim-week");
    const month = idsOf("tehilim-month");
    // Psalm 23 taken as a text sits between the month's 18 to 22 and the week's 73 to 89.
    const psalm23 = 125;
    const { book } = await mountBook({ month: true, texts: [psalm23] });
    const listed = book.readings.value.map((reading) => Number(reading.entry.id));
    expect(listed).toEqual([...month, psalm23, ...week]);
    expect(book.objectives.value.map((objective) => objective.kind)).toEqual([
      "text",
      "cycle",
      "cycle",
    ]);
  });

  it("marks each psalm on its own, the last one marking the cycle's task", async () => {
    const { book } = await mountBook();
    const readings = book.readings.value;
    expect(readings).toHaveLength(17);
    for (const reading of readings.slice(0, -1)) book.setRead(reading, true, "test");
    expect(book.doneCount.value).toBe(16);
    expect(book.taskDone(book.tasks.value[0])).toBe(false);

    book.setRead(readings[readings.length - 1], true, "test");
    expect(book.taskDone(book.tasks.value[0])).toBe(true);
    expect(book.doneCount.value).toBe(17);

    // Unmarking one psalm unmarks the day; the others stay read.
    book.setRead(readings[3], false, "test");
    expect(book.taskDone(book.tasks.value[0])).toBe(false);
    expect(book.doneCount.value).toBe(16);
    expect(book.readings.value[3].done).toBe(false);
  });

  it("reads a psalm given twice once, and marking it marks it for both", async () => {
    const week = idsOf("tehilim-week");
    const { book } = await mountBook({ texts: [week[2]] });
    const twice = book.readings.value.filter((reading) => Number(reading.entry.id) === week[2]);
    expect(twice).toHaveLength(1);
    expect(book.readings.value).toHaveLength(17);
    const [reading] = twice;
    expect(reading.textTask).not.toBeNull();
    expect(reading.cycleTasks).toHaveLength(1);

    book.setRead(reading, true, "test");
    expect(book.taskDone(reading.textTask!)).toBe(true);
    expect(book.readings.value.find((one) => one.key === reading.key)?.done).toBe(true);
    expect(book.doneCount.value).toBe(1);
  });

  it("shows every psalm read once the cycle is marked from the home stack, and none once unmarked", async () => {
    const { book, store } = await mountBook();
    const task = book.tasks.value[0];
    book.setRead(book.readings.value[0], true, "test");
    store.setDone(task, TODAY, true, "test");
    expect(book.doneCount.value).toBe(17);
    store.setDone(task, TODAY, false, "test");
    expect(book.doneCount.value).toBe(1);
  });

  it("opens the daily book from the card of a Tehilim cycle", async () => {
    const { views, store } = await mountBook();
    const task = store.todayTasks.value[0];
    expect(views.taskView(task, TODAY).route).toBe("/bibliotheque/lecture-du-jour");
  });

  it("is named after what it holds", async () => {
    const { views, book } = await mountBook({ texts: [125] });
    expect(views.dailyName(book.objectives.value).title).toBe("Mes Tehilim journaliers");
    expect(views.dailyName(book.objectives.value.slice(1)).title).toBe("Tehilim de la semaine");
  });
});

describe("the mark at the bottom of the library's Tehilim of the day page", () => {
  async function mountMark(psalms: number[]): Promise<HTMLElement> {
    const { writeDeviceState } = await import("../services/parcours/deviceStore");
    const { emptyParcours } = await import("../services/parcours/model");
    const { createCycle } = await import("../services/parcours/create");
    const data = emptyParcours();
    const month = createCycle("tehilim-month", TODAY, 10);
    data.objectives[month.id] = month;
    writeDeviceState({ data, owner: null, dirty: { objectives: [], days: [] } });
    const { default: TehilimDayMark } = await import("../components/parcours/TehilimDayMark.vue");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
    const { createRouter, createMemoryHistory } = await import("vue-router");
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/:any(.*)", component: { render: () => null } }],
    });
    createApp(TehilimDayMark, { psalms }).use(i18n).use(router).mount(host);
    return host;
  }

  it("marks the day's psalms read, and the Tehilim of the day with them", async () => {
    const host = await mountMark(idsOf("tehilim-month"));
    const button = host.querySelector("button")!;
    expect(button.textContent).toContain(fr.parcours.daily.markRead);
    button.click();
    await Promise.resolve();
    const { useParcours } = await import("../composables/useParcours");
    const store = useParcours();
    expect(store.data.value.days[TODAY]?.done).toContain("daily-tehilim");
    expect(host.querySelector("button")!.textContent).toContain(fr.parcours.daily.readToday);
  });

  it("leads to the daily book when the page shows other psalms than Mon parcours (after sunset)", async () => {
    const host = await mountMark([1, 2, 3]);
    expect(host.querySelector("button")).toBeNull();
    expect(host.textContent).toContain("Tehilim 18 à 22");
    expect(host.textContent).toContain(fr.tehilimDay.markInBook);
  });
});
