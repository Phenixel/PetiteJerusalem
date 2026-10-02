import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import fr from "../locales/fr";

/**
 * La lecture du jour garde à l'écran l'état chargé à l'ouverture, et chaque
 * coche réécrit tout le suivi du jour. Trois effets d'un état périmé :
 * - une coche faite ailleurs (le site, pendant que l'app dormait) était
 *   effacée par la coche suivante faite ici ;
 * - une coche faite juste après minuit s'affichait, puis disparaissait au
 *   rechargement du jour sans avoir été enregistrée ;
 * - au nouveau jour, les textes lus la veille restaient repliés alors qu'ils
 *   ne sont plus lus.
 */

const A = 103;
const B = 104;

const { server, saved } = vi.hoisted(() => ({
  server: { progress: { date: "", completedIds: [] as number[] } },
  saved: [] as { date: string; completedIds: number[] }[],
}));

vi.mock("../services/userPreferencesService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/userPreferencesService")>();
  return {
    ...actual,
    userPreferencesService: {
      ...actual.userPreferencesService,
      getPreferences: () =>
        Promise.resolve({
          dailyReadingIds: [A, B],
          dailyReadingOptions: [],
          dailyReadingProgress: JSON.parse(JSON.stringify(server.progress)),
        }),
      saveDailyProgress: (...args: [string, { date: string; completedIds: number[] }]) => {
        const progress = args[1];
        saved.push(progress);
        server.progress = progress;
        return Promise.resolve("saved");
      },
    },
  };
});
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));
vi.mock("../views/Library/DailyReadingItem.vue", () => ({
  default: { render: () => null },
}));

const { default: DailyReading } = await import("../views/Library/DailyReading.vue");

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

let host: HTMLElement;
let unmount: () => void;

async function settle() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    await nextTick();
  }
}

async function mount() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:rest(.*)", component: { render: () => null } }],
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(DailyReading, { userId: "u1" }) })
    .use(createI18n({ legacy: false, locale: "fr", messages: { fr } }))
    .use(router);
  app.mount(host);
  unmount = () => app.unmount();
  await vi.waitFor(() => expect(markButtons().length).toBe(2), { timeout: 5_000 });
}

/** Les boutons « Marquer comme lu » / « Lu aujourd'hui », dans l'ordre de la liste. */
function markButtons(): HTMLButtonElement[] {
  return [...host.querySelectorAll("button")].filter((b) =>
    [fr.dailyReading.markRead, fr.dailyReading.readToday].includes(b.textContent?.trim() ?? ""),
  );
}

/** Le contenu d'un texte est-il replié (v-show) ? */
function folded(button: HTMLButtonElement): boolean {
  return (button.closest("div[style]") as HTMLElement | null)?.style.display === "none";
}

async function returnToScreen() {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  await settle();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 5, 10, 0));
  server.progress = { date: dayKey(new Date()), completedIds: [] };
  saved.length = 0;
});

afterEach(() => {
  unmount?.();
  host?.remove();
  vi.useRealTimers();
});

describe("la lecture du jour et un état périmé", () => {
  it("ne perd pas une coche faite sur un autre appareil", async () => {
    await mount();
    // Sur le site, pendant que l'app dormait, A est coché.
    server.progress = { date: dayKey(new Date()), completedIds: [A] };
    await returnToScreen();

    markButtons()[1].click();
    await settle();

    expect(saved.at(-1)?.completedIds.sort()).toEqual([A, B]);
  });

  it("enregistre une coche faite juste après minuit, sous le nouveau jour", async () => {
    vi.setSystemTime(new Date(2026, 9, 5, 23, 59));
    server.progress = { date: dayKey(new Date()), completedIds: [] };
    await mount();
    vi.setSystemTime(new Date(2026, 9, 6, 0, 1));

    markButtons()[0].click();
    await settle();

    expect(saved.at(-1)).toMatchObject({ date: "2026-10-06", completedIds: [A] });
  });

  it("rouvre au nouveau jour les textes lus la veille", async () => {
    server.progress = { date: dayKey(new Date()), completedIds: [A] };
    await mount();
    expect(folded(markButtons()[0])).toBe(true);

    vi.setSystemTime(new Date(2026, 9, 6, 8, 0));
    await returnToScreen();

    expect(markButtons()[0].textContent?.trim()).toBe(fr.dailyReading.markRead);
    expect(folded(markButtons()[0])).toBe(false);
  });
});
