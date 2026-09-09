import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";
import { useTehilimDay, useWeeklyParasha } from "../composables/useTehilimDay";

/**
 * Le jour des Tehilim du jour et de la paracha suit le calendrier hébraïque
 * (il bascule à la chkia) et le temps qui passe : une page laissée ouverte ne
 * garde pas les psaumes de la veille.
 */

/** Mercredi 4 février 2026, midi à Paris : 17 Chevat. */
const NOON = new Date(2026, 1, 4, 12);
/** Le même soir, après la chkia (vers 18 h à Paris) : déjà le 18 Chevat. */
const EVENING = new Date(2026, 1, 4, 21);

const apps: App[] = [];

/**
 * Monte, puis attend le rendu qui suit le montage : l'horloge partagée
 * (useNow) se remet à l'heure au montage, le premier rendu la précède.
 */
async function mount(setup: () => () => ReturnType<typeof h>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp(defineComponent({ setup }));
  app.mount(host);
  apps.push(app);
  await nextTick();
  return host;
}

function mountTehilim(live: boolean) {
  return mount(() => {
    const { cycle } = useTehilimDay({ live });
    return () => h("span", String(cycle.value.day));
  });
}

async function tick() {
  // L'horloge partagée (useNow) tique toutes les trente secondes.
  await vi.advanceTimersByTimeAsync(30_000);
  await nextTick();
}

describe("useTehilimDay", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
    vi.useFakeTimers();
    vi.setSystemTime(NOON);
  });

  afterEach(() => {
    while (apps.length) apps.pop()?.unmount();
    vi.useRealTimers();
  });

  it("donne le jour du mois hébraïque, et le lendemain une fois la chkia passée", async () => {
    const host = await mountTehilim(true);
    expect(host.textContent).toBe("17");

    vi.setSystemTime(EVENING);
    await tick();
    expect(host.textContent).toBe("18");
  });

  it("figé (live: false), ne change qu'au retour à l'écran", async () => {
    const host = await mountTehilim(false);
    expect(host.textContent).toBe("17");

    vi.setSystemTime(EVENING);
    await tick();
    expect(host.textContent).toBe("17");

    document.dispatchEvent(new Event("visibilitychange"));
    await nextTick();
    expect(host.textContent).toBe("18");
  });
});

describe("useWeeklyParasha", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });

  afterEach(() => {
    while (apps.length) apps.pop()?.unmount();
    vi.useRealTimers();
  });

  it("passe à la paracha suivante samedi soir, après la chkia", async () => {
    // Samedi 7 février 2026 à midi : Yitro ; le soir, Michpatim.
    vi.setSystemTime(new Date(2026, 1, 7, 12));
    const host = await mount(() => {
      const { parasha } = useWeeklyParasha();
      return () => h("span", parasha.value?.names.join("-") ?? "");
    });
    expect(host.textContent).toBe("Yitro");

    vi.setSystemTime(new Date(2026, 1, 7, 21));
    await tick();
    expect(host.textContent).toBe("Mishpatim");
  });
});
