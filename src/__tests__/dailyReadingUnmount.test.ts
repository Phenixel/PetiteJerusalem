import { describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import fr from "../locales/fr";

/**
 * La lecture du jour quittée avant la fin de son chargement (réseau lent) ne
 * laisse pas d'écouteur derrière elle. Posé après les `await` du montage, il
 * l'était aussi quand la page avait déjà été démontée : une copie fuyait à
 * chaque visite, et au retour à l'écran après minuit, la page morte
 * rechargeait les préférences et réécrivait la remise à zéro.
 */

const { release, capture } = vi.hoisted(() => ({
  release: [] as Array<() => void>,
  capture: vi.fn(),
}));

vi.mock("../services/userPreferencesService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/userPreferencesService")>();
  return {
    ...actual,
    userPreferencesService: {
      ...actual.userPreferencesService,
      // Le serveur tarde : la réponse arrive après le départ du lecteur.
      getPreferences: () =>
        new Promise((resolve) =>
          release.push(() =>
            resolve({
              dailyReadingIds: [],
              dailyReadingOptions: [],
              dailyReadingProgress: { date: "", completedIds: [] },
            }),
          ),
        ),
    },
  };
});
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture } }));

describe("la lecture du jour quittée pendant son chargement", () => {
  it("ne pose pas son écouteur après coup", async () => {
    const { default: DailyReading } = await import("../views/Library/DailyReading.vue");
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/:rest(.*)", component: { render: () => null } }],
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = createApp({ render: () => h(DailyReading, { userId: "u1" }) })
      .use(createI18n({ legacy: false, locale: "fr", messages: { fr } }))
      .use(router);
    app.mount(host);
    await nextTick();
    app.unmount();

    // La réponse arrive ensuite.
    release.splice(0).forEach((resolve) => resolve());
    // Le montage va jusqu'au bout : l'événement de fin de chargement part.
    await vi.waitFor(
      () => expect(capture).toHaveBeenCalledWith("daily_reading_viewed", expect.anything()),
      { timeout: 5_000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Rejoue ajouts et retraits dans leur ordre : ce qui reste posé à la fin
    // fuit. (Un retrait AVANT l'ajout ne retire rien.)
    const live = new Set<unknown>();
    const events = [
      ...add.mock.calls.map((call, i) => ({ call, at: add.mock.invocationCallOrder[i], on: true })),
      ...remove.mock.calls.map((call, i) => ({
        call,
        at: remove.mock.invocationCallOrder[i],
        on: false,
      })),
    ].sort((a, b) => a.at - b.at);
    for (const { call, on } of events) {
      if (call[0] !== "visibilitychange") continue;
      if (on) live.add(call[1]);
      else live.delete(call[1]);
    }
    expect([...live]).toEqual([]);
    host.remove();
  });
});
