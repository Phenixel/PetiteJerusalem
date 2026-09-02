import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, type Router } from "vue-router";

/**
 * Le bandeau du 'Omer sur l'accueil.
 *
 * Un compte se rate d'un soir, et qui saute un jour entier perd la
 * bénédiction pour les quarante-huit qui restent : le bandeau est là pour ça.
 * Ce qui se teste ici est donc qu'il paraisse les bons soirs, et seulement
 * ceux-là, avec le bon numéro.
 */

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));

import fr from "../locales/fr";
import OmerBanner from "../components/OmerBanner.vue";

let montees: App[] = [];

/** Monte le bandeau à l'instant donné, et rend le texte affiché. */
async function texteAu(quand: Date): Promise<string> {
  vi.setSystemTime(quand);
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:chemin(.*)*", component: { render: () => null } }],
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(OmerBanner) });
  app.use(i18n).use(router);
  app.mount(host);
  montees.push(app);
  await router.isReady();
  await nextTick();
  return host.textContent ?? "";
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  for (const app of montees) app.unmount();
  montees = [];
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("bandeau du 'Omer", () => {
  it("ne paraît pas hors de la période", () => {
    // Un jour d'automne, loin du 'Omer.
    return texteAu(new Date("2026-11-05T10:00:00Z")).then((texte) => {
      expect(texte.trim()).toBe("");
    });
  });

  it("donne le compte du jour, et ce qu'il en reste", async () => {
    // 23 avril 2027 en journée : 16 Nissan 5787, premier jour du 'Omer, dont
    // le compte a été dit la veille au soir et vaut jusqu'à la nuit suivante.
    const texte = await texteAu(new Date("2027-04-23T10:00:00Z"));
    expect(texte).toContain(fr.home.omer.dayOne);
    expect(texte).toContain("48");
  });

  it("dit le dernier soir sans promettre un lendemain de compte", async () => {
    // 5 Sivan : quarante-neuvième et dernier jour, Chavouot entre le soir.
    const texte = await texteAu(new Date("2027-06-10T10:00:00Z"));
    expect(texte).toContain("49");
    expect(texte).toContain(fr.home.omer.last);
  });
});
