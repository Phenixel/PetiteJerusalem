import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import fr from "../locales/fr";
import TehilimDayBanner from "../components/TehilimDayBanner.vue";
import TehilimDayPage from "../views/Library/TehilimDayPage.vue";

/**
 * Les Tehilim du jour : un encart dans les Tehilim de la bibliothèque qui mène
 * à leur page, et sur cette page les psaumes du jour les uns sous les autres.
 *
 * L'encart alignait autant de numéros que le jour compte de psaumes, jusqu'à
 * quinze, chacun vers sa page : les lire demandait autant d'allers-retours.
 */

/** Mercredi 4 février 2026 : 17 Chevat, les psaumes 83 à 87. */
const WEDNESDAY = new Date(2026, 1, 4, 12);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(WEDNESDAY);
});

afterEach(() => vi.useRealTimers());

function mount(component: unknown) {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/bibliotheque/tehilim-du-jour", component: { render: () => null } },
      { path: "/bibliotheque/:corpus", component: { render: () => null } },
    ],
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(component as never) });
  app.use(i18n);
  app.use(router);
  app.mount(host);

  const text = () => (host.textContent ?? "").replace(/\s+/g, " ").trim();
  return { host, router, text };
}

describe("TehilimDayBanner", () => {
  it("annonce les psaumes du jour et mène à leur page", async () => {
    const banner = mount(TehilimDayBanner);
    await banner.router.push("/bibliotheque/tehilim");
    await banner.router.isReady();
    await nextTick();

    expect(banner.text()).toContain("Tehilim du jour · 17 du mois");
    expect(banner.text()).toContain("Tehilim 83 à 87");
    // Un lien, rien de plus : les psaumes se lisent sur leur page, et non un
    // par un depuis une rangée de numéros.
    const links = banner.host.querySelectorAll("a");
    expect(links.length).toBe(1);
    expect(links[0].getAttribute("href")).toBe("/bibliotheque/tehilim-du-jour");
  });
});

describe("TehilimDayPage", () => {
  it("donne les psaumes du jour les uns sous les autres", async () => {
    const page = mount(TehilimDayPage);
    await page.router.push("/bibliotheque/tehilim-du-jour");
    await page.router.isReady();
    await nextTick();

    expect(page.text()).toContain("Tehilim du jour");
    expect(page.text()).toContain("Tehilim 83 à 87");
    expect(page.text()).toContain("17 du mois");

    // Un titre par psaume, dans l'ordre : les cinq du jour sont sur la page.
    const titles = [...page.host.querySelectorAll("h2")].map((h) =>
      (h.textContent ?? "").replace(/\s+/g, " ").trim(),
    );
    expect(titles.length).toBe(5);
    expect(titles[0]).toContain("Tehilim 83");
    expect(titles[4]).toContain("Tehilim 87");
  });

  it("dit le Yehi ratson avant les psaumes, et le reste après", async () => {
    const page = mount(TehilimDayPage);
    await page.router.push("/bibliotheque/tehilim-du-jour");
    await page.router.isReady();
    await nextTick();

    // Ce qui se dit après la lecture se dit après : sa place est en bas de
    // page, une fois le dernier psaume lu, et non en tête avec le Yehi ratson.
    const order = [...page.host.querySelectorAll("h2, button span")]
      .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter(
        (label) =>
          label === "Avant la lecture" || label === "Après la lecture" || /^Tehilim \d/.test(label),
      );
    expect(order[0]).toBe("Avant la lecture");
    expect(order.at(-1)).toBe("Après la lecture");
    expect(order.filter((label) => label.startsWith("Tehilim")).length).toBe(5);
  });

  it("relit le jour quand la page revient à l'écran", async () => {
    const page = mount(TehilimDayPage);
    await page.router.push("/bibliotheque/tehilim-du-jour");
    await page.router.isReady();
    await nextTick();
    expect(page.text()).toContain("Tehilim 83 à 87");

    // L'app laissée ouverte et rouverte le lendemain : 18 Chevat, ce sont les
    // psaumes 88 et 89, et non plus ceux de la veille.
    vi.setSystemTime(new Date(2026, 1, 5, 12));
    document.dispatchEvent(new Event("visibilitychange"));
    await nextTick();

    expect(page.text()).toContain("Tehilim 88 à 89");
    expect(page.text()).toContain("18 du mois");
  });

  it("revient au livre des Tehilim", async () => {
    const page = mount(TehilimDayPage);
    await page.router.push("/bibliotheque/tehilim-du-jour");
    await page.router.isReady();
    await nextTick();

    const back = page.host.querySelector("a.back-link")!;
    expect(back.getAttribute("href")).toBe("/bibliotheque/tehilim");
  });
});
