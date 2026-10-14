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

async function mountDeck(extra: Objective[] = []): Promise<{ deck: Deck; store: Store }> {
  const { writeDeviceState } = await import("../services/parcours/deviceStore");
  const { emptyParcours } = await import("../services/parcours/model");
  const data = emptyParcours();
  for (const objective of [...objectives, ...extra]) data.objectives[objective.id] = objective;
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
    expect(deck.top.value?.view?.task.step).toBe("chaharit");
    expect(deck.top.value?.kicker).toBe(fr.parcours.hub.now);
    expect(deck.top.value?.meta).toMatch(/^jusqu'à \d{1,2}:\d{2}$/);
    expect(deck.coversOffices.value).toBe(true);
  });

  it("passe dessous ce qu'on remet à plus tard, l'office compris", async () => {
    const { deck } = await mountDeck();
    const office = deck.top.value!;
    deck.postpone(office);
    expect(deck.top.value?.view?.objective.id).toBe("t23");
    expect(deck.pending.value.at(-1)?.key).toBe(office.key);
  });

  it("quitte le paquet ce qui est fait, et le garde dans la journée", async () => {
    const { deck, store } = await mountDeck();
    const office = deck.top.value!;
    store.setDone(office.view!.task, TODAY, true, "test");
    expect(deck.top.value?.view?.objective.id).toBe("t23");
    expect(deck.pending.value.some((card) => card.key === office.key)).toBe(false);
    expect(deck.day.value.map((card) => card.key)).toContain(office.key);
    expect(deck.day.value.find((card) => card.key === office.key)?.done).toBe(true);
  });

  it("dit à partir de quand un office qui vient, et le compte de la journée", async () => {
    const { deck } = await mountDeck();
    const arvit = deck.day.value.find((card) => card.view?.task.step === "arvit");
    expect(arvit?.meta).toMatch(/^à partir de \d{1,2}:\d{2}$/);
    expect(arvit?.kicker).toBe(fr.parcours.kicker.evening);
    // Les trois offices, le texte du jour, le Chema al hamita.
    expect(deck.count.value).toEqual({ done: 0, total: 5 });
  });

  it("range la journée du matin au coucher, dans le portefeuille", async () => {
    const { deck } = await mountDeck();
    const moments = deck.day.value.map((card) => card.moment);
    expect(moments).toEqual(["morning", "morning", "afternoon", "evening", "bedtime"]);
    const chema = deck.day.value.at(-1);
    expect(chema?.art).toEqual({ kind: "moon" });
    expect(chema?.meta).toBe(fr.parcours.hub.beforeSleep);
  });

  it("propose de rattraper un programme en retard, sans le compter dans la journée", async () => {
    const { createProgram } = await import("../services/parcours/create");
    const moed = createProgram(
      {
        corpus: "michna",
        parts: ["seder:moed"],
        rhythm: "daily",
        end: "2027-09-25",
        moment: "evening",
      },
      "2026-10-04",
      0,
    );
    const { deck } = await mountDeck([moed]);
    const catchUp = deck.day.value.at(-1);
    expect(catchUp?.catchUp?.id).toBe(moed.id);
    expect(catchUp?.extra).toBe(true);
    expect(catchUp?.title).toBe("Rattraper Moed");
    expect(catchUp?.kicker).toBe(fr.parcours.hub.catchUpKicker);
    // La journée compte les tâches seules : les trois offices, le texte, le
    // Chema, et la portion de Moed.
    expect(deck.count.value.total).toBe(6);
    // Il se range après les tâches, avant ce qu'on remet à plus tard.
    const top = deck.top.value!;
    deck.postpone(top);
    expect(deck.pending.value.at(-2)?.key).toBe(catchUp?.key);
  });

  it("met la carte du 'Omer dans la pile, le soir, et retient qu'il est compté", async () => {
    // Mercredi 5 mai 2027, 21 h 45 à Paris : la nuit du 'Omer.
    vi.setSystemTime(new Date("2027-05-05T19:45:00Z"));
    const { deck } = await mountDeck();
    const omer = deck.day.value.find((card) => card.occasion?.kind === "omer");
    expect(omer?.title).toMatch(/jour du 'Omer$/);
    expect(omer?.extra).toBe(true);
    expect(deck.pending.value.some((card) => card.key === omer?.key)).toBe(true);
    deck.markOccasion(omer!, true);
    expect(deck.day.value.find((card) => card.key === omer?.key)?.done).toBe(true);
    expect(deck.pending.value.some((card) => card.key === omer?.key)).toBe(false);
    expect(localStorage.getItem("pj_parcours_occasions")).toContain(omer!.occasion!.key);
  });
});
