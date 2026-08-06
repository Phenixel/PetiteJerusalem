import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import fr from "../locales/fr";
import ChneiMikraBanner from "../components/ChneiMikraBanner.vue";
import ChneiMikraPage from "../views/Library/ChneiMikraPage.vue";

/**
 * Le chnei mikra : un encart dans le Tanakh qui mène à sa page, et sur cette
 * page le feuilletage des semaines — dans l'URL, pour que le bouton
 * « précédent » du navigateur défasse un feuilletage.
 */

/** Mercredi 4 février 2026 : la semaine de Yitro (Chabbat 7 février). */
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
      { path: "/bibliotheque/chnei-mikra", component: { render: () => null } },
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
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label)!;
  // Un clic sur une flèche pousse une nouvelle URL : on laisse le routeur
  // traverser ses gardes (une tâche complète) avant de relire la page.
  const click = async (el: Element) => {
    el.dispatchEvent(new MouseEvent("click"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  };
  return { host, router, text, button, click };
}

describe("ChneiMikraBanner", () => {
  it("annonce la paracha de la semaine et mène à sa page", async () => {
    const banner = mount(ChneiMikraBanner);
    await banner.router.push("/bibliotheque/tanakh");
    await banner.router.isReady();
    await nextTick();

    expect(banner.text()).toContain("Chnei mikra");
    expect(banner.text()).toContain("Paracha de la semaine : Yitro");
    // Un lien, rien de plus : le texte se lit sur sa page.
    const link = banner.host.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("/bibliotheque/chnei-mikra");
    expect(banner.host.querySelectorAll("button").length).toBe(0);
  });
});

describe("ChneiMikraPage", () => {
  it("ouvre sur la paracha de la semaine", async () => {
    const page = mount(ChneiMikraPage);
    await page.router.push("/bibliotheque/chnei-mikra");
    await page.router.isReady();
    await nextTick();

    expect(page.text()).toContain("Yitro");
    expect(page.text()).toContain("Lue Chabbat 7 février");
    expect(page.text()).not.toContain("Revenir à la paracha de cette semaine");
  });

  it("feuillette les semaines par l'URL", async () => {
    const page = mount(ChneiMikraPage);
    await page.router.push("/bibliotheque/chnei-mikra");
    await page.router.isReady();
    await nextTick();

    await page.click(page.button("Paracha suivante"));
    expect(page.router.currentRoute.value.query.semaine).toBe("2026-02-14");
    expect(page.text()).toContain("Mishpatim");
    expect(page.text()).toContain("Revenir à la paracha de cette semaine");

    await page.click(page.button("Paracha précédente"));
    await page.click(page.button("Paracha précédente"));
    expect(page.text()).toContain("Beshalach");
    expect(page.router.currentRoute.value.query.semaine).toBe("2026-01-31");

    // Le retour laisse l'URL propre : la semaine en cours est le défaut.
    const back = [...page.host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Revenir à la paracha de cette semaine"),
    )!;
    await page.click(back);
    expect(page.router.currentRoute.value.query.semaine).toBeUndefined();
    expect(page.text()).toContain("Yitro");
  });

  it("ouvre directement la semaine demandée dans l'URL", async () => {
    const page = mount(ChneiMikraPage);
    await page.router.push("/bibliotheque/chnei-mikra?semaine=2026-03-07");
    await page.router.isReady();
    await nextTick();

    expect(page.text()).toContain("Ki Tisa");
    expect(page.text()).toContain("Revenir à la paracha de cette semaine");
  });

  it("retombe sur la semaine en cours quand l'URL ne vaut rien", async () => {
    // Lien tronqué, ou Chabbat de fête sans paracha ordinaire : une page utile
    // vaut mieux qu'une erreur.
    for (const asked of ["n-importe-quoi", "2026-10-03"]) {
      const page = mount(ChneiMikraPage);
      await page.router.push(`/bibliotheque/chnei-mikra?semaine=${asked}`);
      await page.router.isReady();
      await nextTick();
      expect(page.text()).toContain("Yitro");
    }
  });
});
