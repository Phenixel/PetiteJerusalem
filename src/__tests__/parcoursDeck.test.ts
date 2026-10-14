import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import type { Objective } from "../services/parcours/model";

/**
 * Le paquet de l'accueil (composables/useTodayDeck.ts) : l'office dont c'est
 * l'heure en tête quand le parcours le porte, puis le moment présent ; ce
 * qu'on remet « plus tard » passe dessous, même l'office ; ce qui est fait
 * quitte le paquet.
 */

vi.mock("../services/authService", () => ({
  authService: { onAuthChanged: () => () => {} },
}));

// Mercredi 14 octobre 2026, 9 h à Paris : l'heure de Cha'harit.
const NOW = new Date("2026-10-14T07:00:00Z");
const TODAY = "2026-10-14";

const base = { createdAt: 0, updatedAt: 0, since: TODAY };
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];
const objectives: Objective[] = [
  {
    ...base,
    id: "tef",
    kind: "habit",
    preset: "tefilot",
    name: "",
    days: ALL_WEEK,
    moment: "morning",
  },
  {
    ...base,
    id: "t23",
    kind: "text",
    textId: 125,
    days: ALL_WEEK,
    moment: "morning",
    createdAt: 1,
  },
  {
    ...base,
    id: "chema",
    kind: "habit",
    preset: "chema-al-hamita",
    name: "",
    days: ALL_WEEK,
    moment: "bedtime",
    createdAt: 2,
  },
];

type Deck = ReturnType<typeof import("../composables/useTodayDeck").useTodayDeck>;
type Store = ReturnType<typeof import("../composables/useParcours").useParcours>;

async function mountDeck(): Promise<{ deck: Deck; store: Store }> {
  const { writeDeviceState } = await import("../services/parcours/deviceStore");
  const { emptyParcours } = await import("../services/parcours/model");
  const data = emptyParcours();
  for (const objective of objectives) data.objectives[objective.id] = objective;
  writeDeviceState({ data, owner: null, dirty: { objectives: [], days: [] } });

  const { useTodayDeck } = await import("../composables/useTodayDeck");
  const { useParcours } = await import("../composables/useParcours");
  let deck: Deck | null = null;
  let store: Store | null = null;
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  createApp(
    defineComponent({
      setup() {
        deck = useTodayDeck();
        store = useParcours();
        return () => h("div");
      },
    }),
  )
    .use(i18n)
    .mount(document.createElement("div"));
  return { deck: deck!, store: store! };
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.resetModules();
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("le paquet de l'accueil", () => {
  it("met en tête l'office dont c'est l'heure, avec jusqu'à quand", async () => {
    const { deck } = await mountDeck();
    expect(deck.top.value?.task.step).toBe("chaharit");
    expect(deck.top.value?.kicker).toBe(fr.parcours.hub.now);
    expect(deck.top.value?.meta).toMatch(/^jusqu'à \d{1,2}:\d{2}$/);
    expect(deck.coversOffices.value).toBe(true);
  });

  it("passe dessous ce qu'on remet à plus tard, l'office compris", async () => {
    const { deck } = await mountDeck();
    const office = deck.top.value!;
    deck.postpone(office);
    expect(deck.top.value?.objective.id).toBe("t23");
    expect(deck.pending.value.at(-1)?.key).toBe(office.key);
  });

  it("quitte le paquet ce qui est fait, et le garde dans la journée", async () => {
    const { deck, store } = await mountDeck();
    const office = deck.top.value!;
    store.setDone(office.task, TODAY, true, "test");
    expect(deck.top.value?.objective.id).toBe("t23");
    expect(deck.pending.value.some((view) => view.key === office.key)).toBe(false);
    expect(deck.day.value.map((view) => view.task.id)).toContain(office.task.id);
  });
});
