import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import type { Objective } from "../services/parcours/model";

/**
 * Le paquet de l'accueil (composables/useTodayDeck.ts) : l'office dont c'est
 * l'heure en tête quand le parcours le porte, puis le moment présent ; ce
 * qu'on remet « plus tard » passe dessous, même l'office ; ce qui est fait
 * quitte le paquet. Un office dont l'heure n'est pas venue attend après tout
 * le reste, en retrait (« Pas encore l'heure »), comme une habitude dont le
 * repère n'est pas venu (le Chema du coucher, avant la nuit).
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

async function mountDeck(
  extra: Objective[] = [],
  base: Objective[] = objectives,
): Promise<{ deck: Deck; store: Store }> {
  const { writeDeviceState } = await import("../services/parcours/deviceStore");
  const { emptyParcours } = await import("../services/parcours/model");
  const data = emptyParcours();
  for (const objective of [...base, ...extra]) data.objectives[objective.id] = objective;
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
    // The habit carries the service: no second card for it.
    expect(deck.day.value.some((card) => card.occasion?.kind === "tefila")).toBe(false);
  });

  it("puts the service whose time it is in the stack without the habit, outside the day's count", async () => {
    const { deck } = await mountDeck(
      [],
      objectives.filter((objective) => objective.id !== "tef"),
    );
    const office = deck.top.value!;
    expect(office.occasion).toMatchObject({ kind: "tefila", tefila: "chaharit" });
    expect(office.kicker).toBe(fr.parcours.hub.now);
    expect(office.meta).toMatch(/^jusqu'à \d{1,2}:\d{2}$/);
    expect(office.extra).toBe(true);
    // The daily text and the bedtime Chema: the service does not count.
    expect(deck.count.value).toEqual({ done: 0, total: 2 });
    // Swiped done, it leaves the stack and the device remembers it.
    deck.markOccasion(office, true);
    expect(deck.top.value?.view?.objective.id).toBe("t23");
    expect(deck.day.value.find((card) => card.key === office.key)?.done).toBe(true);
    expect(localStorage.getItem("pj_parcours_occasions")).toContain("tefila:2026-10-14-chaharit");
  });

  it("on a night of the moon, offers Arvit first, then the moon once Arvit is said", async () => {
    // Tuesday 20 October 2026, 9 p.m. in Paris: Arvit, and the moon is blessed.
    vi.setSystemTime(new Date("2026-10-20T19:00:00Z"));
    const { deck } = await mountDeck(
      [],
      objectives.filter((objective) => objective.id !== "tef"),
    );
    const [first, second] = deck.pending.value;
    expect(first.occasion).toMatchObject({ kind: "tefila", tefila: "arvit" });
    expect(second.occasion?.kind).toBe("halevana");
    deck.markOccasion(first, true);
    expect(deck.top.value?.occasion?.kind).toBe("halevana");
  });

  it("passe dessous ce qu'on remet à plus tard, l'office compris", async () => {
    const { deck } = await mountDeck();
    const office = deck.top.value!;
    deck.postpone(office);
    expect(deck.top.value?.view?.objective.id).toBe("t23");
    // Après tout ce qui se fait maintenant ; Min'ha, Arvit et le Chema du
    // coucher, pas encore à leur heure, après lui.
    const now = deck.pending.value.filter((card) => !card.waiting);
    expect(now.at(-1)?.key).toBe(office.key);
    expect(
      deck.pending.value
        .slice(now.length)
        .map((card) => card.view?.task.step ?? card.view?.objective.id),
    ).toEqual(["minha", "arvit", "chema"]);
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
    expect(arvit?.kicker).toBe(fr.parcours.hub.notYet);
    expect(arvit?.waiting).toBe(true);
    // Les trois offices, le texte du jour, le Chema al hamita.
    expect(deck.count.value).toEqual({ done: 0, total: 5 });
  });

  it("range la journée du matin au coucher, dans le portefeuille", async () => {
    const { deck } = await mountDeck();
    const moments = deck.day.value.map((card) => card.moment);
    expect(moments).toEqual(["morning", "morning", "afternoon", "evening", "bedtime"]);
    const chema = deck.day.value.at(-1);
    expect(chema?.art).toEqual({ kind: "moon" });
    // À 9 h, il attend la nuit : à partir de quand.
    expect(chema?.meta).toMatch(/^à partir de \d{1,2}:\d{2}$/);
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
    // Il se range après les tâches, avant ce qu'on remet à plus tard (et
    // avant les offices pas encore à l'heure).
    const top = deck.top.value!;
    deck.postpone(top);
    const now = deck.pending.value.filter((card) => !card.waiting);
    expect(now.at(-2)?.key).toBe(catchUp?.key);
  });

  it("garde en retrait l'office qui n'est pas encore à l'heure, après ce qui se fait maintenant", async () => {
    const { createHabit } = await import("../services/parcours/create");
    const tsedaka = createHabit(
      { preset: "tsedaka", name: "", days: ALL_WEEK, moment: "anytime" },
      TODAY,
      5,
    );
    const { deck, store } = await mountDeck([tsedaka]);
    // Cha'harit, puis le texte du matin : faits.
    store.setDone(deck.top.value!.view!.task, TODAY, true, "test");
    store.setDone(deck.top.value!.view!.task, TODAY, true, "test");
    // La tsédaka se fait quand on veut : elle passe avant Min'ha, qui n'est pas ouvert.
    expect(deck.top.value?.view?.objective.id).toBe(tsedaka.id);
    expect(deck.top.value?.waiting).toBeFalsy();
    store.setDone(deck.top.value!.view!.task, TODAY, true, "test");
    // Plus rien à faire maintenant : Min'ha en tête, en retrait, et à partir de quand.
    expect(deck.top.value?.view?.task.step).toBe("minha");
    expect(deck.top.value?.waiting).toBe(true);
    expect(deck.top.value?.kicker).toBe(fr.parcours.hub.notYet);
    expect(deck.top.value?.meta).toMatch(/^à partir de \d{1,2}:\d{2}$/);
    // À l'heure de Min'ha (16 h à Paris), elle reprend sa place, en couleur.
    vi.setSystemTime(new Date("2026-10-14T14:00:00Z"));
    const later = await mountDeck();
    const minha = later.deck.day.value.find((card) => card.view?.task.step === "minha");
    expect(minha?.waiting).toBe(false);
    expect(minha?.kicker).toBe(fr.parcours.hub.now);
  });

  it("fait attendre une habitude son repère : le Chema du coucher, la nuit venue", async () => {
    const { deck } = await mountDeck();
    // À 9 h : en retrait, après tout le reste, à partir de la sortie des étoiles.
    const chema = deck.pending.value.at(-1);
    expect(chema?.view?.objective.id).toBe("chema");
    expect(chema?.waiting).toBe(true);
    expect(chema?.kicker).toBe(fr.parcours.hub.notYet);
    // À 21 h à Paris, la nuit est tombée : il est à faire, avant de dormir.
    vi.setSystemTime(new Date("2026-10-14T19:00:00Z"));
    const night = await mountDeck();
    const tonight = night.deck.day.value.find((card) => card.view?.objective.id === "chema");
    expect(tonight?.waiting).toBe(false);
    expect(tonight?.meta).toBe(fr.parcours.hub.beforeSleep);
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

  it("donne les Tehilim de la semaine au jour de la semaine, et Birkat Hamazon après le repas", async () => {
    const { createCycle, createHabit } = await import("../services/parcours/create");
    const week = createCycle("tehilim-week", TODAY, 10);
    const hamazon = createHabit(
      { preset: "birkat-hamazon", name: "", days: ALL_WEEK, moment: "afternoon", anchor: "noon" },
      TODAY,
      11,
    );
    const { deck } = await mountDeck([week, hamazon]);
    // Mercredi : les psaumes 73 à 89.
    const tehilim = deck.day.value.find((card) => card.view?.objective.id === week.id);
    expect(tehilim?.title).toBe("Tehilim 73 à 89");
    expect(tehilim?.meta).toMatch(/^17\spsaumes$/);
    // À 9 h, le repas de midi n'est pas venu : il attend 'hatsot.
    const meal = deck.day.value.find((card) => card.view?.objective.id === hamazon.id);
    expect(meal?.waiting).toBe(true);
    expect(meal?.art).toEqual({ kind: "siddur" });
    // À 15 h à Paris, après le repas.
    vi.setSystemTime(new Date("2026-10-14T13:00:00Z"));
    const afternoon = await mountDeck([week, hamazon]);
    const after = afternoon.deck.day.value.find((card) => card.view?.objective.id === hamazon.id);
    expect(after?.waiting).toBe(false);
    expect(after?.kicker).toBe(fr.parcours.anchorKicker.noon);
    expect(after?.meta).toBe(fr.parcours.hub.afterMeal);
  });

  it("ne montre une carte de la semaine que les jours qu'on lui a donnés", async () => {
    const { createProgram } = await import("../services/parcours/create");
    const draft = { corpus: "michna" as const, parts: ["seder:moed"], end: "2027-09-25" };
    // Mercredi : la carte vient le mercredi, pas l'autre.
    const wednesday = createProgram(
      { ...draft, rhythm: "weekly", moment: "evening", cardDays: [0, 3, 5] },
      TODAY,
      20,
    );
    const monday = createProgram(
      { ...draft, rhythm: "weekly", moment: "evening", cardDays: [1] },
      TODAY,
      21,
    );
    const { deck, store } = await mountDeck([wednesday, monday]);
    const ids = deck.day.value.map((card) => card.view?.objective.id);
    expect(ids).toContain(wednesday.id);
    expect(ids).not.toContain(monday.id);
    // Ma journée, elle, garde les deux.
    expect(store.todayTasks.value.map((task) => task.objectiveId)).toContain(monday.id);
  });
});
