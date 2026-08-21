import { describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import fr from "../locales/fr";
import BottomTabBar from "../components/BottomTabBar.vue";

/**
 * La barre basse de l'app native : le bouton rond des horaires est une
 * bascule. Un appui ouvre la page (en surcouche, voir App.vue), un second
 * appui la referme et rend la page qu'elle recouvrait.
 */

function mount() {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:chemin(.*)*", component: { render: () => null } }],
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(BottomTabBar) });
  app.use(i18n);
  app.use(router);
  app.mount(host);

  const fab = () =>
    host.querySelector('button[aria-label="Horaires du jour"]') as HTMLButtonElement;
  const click = async (el: Element) => {
    el.dispatchEvent(new MouseEvent("click"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  };
  return { router, fab, click };
}

describe("BottomTabBar", () => {
  it("le bouton rond ouvre les horaires, puis les referme", async () => {
    const bar = mount();
    await bar.router.push("/bibliotheque");
    await bar.router.isReady();
    await nextTick();

    expect(bar.fab().getAttribute("aria-pressed")).toBe("false");
    await bar.click(bar.fab());
    expect(bar.router.currentRoute.value.path).toBe("/horaires");
    expect(bar.fab().getAttribute("aria-pressed")).toBe("true");

    // Second appui : la surcouche se referme. (Dans l'app, l'historique
    // ramène sur la page recouverte ; ici, sans entrée derrière, l'accueil.)
    await bar.click(bar.fab());
    expect(bar.router.currentRoute.value.path).toBe("/");
    expect(bar.fab().getAttribute("aria-pressed")).toBe("false");
  });
});
