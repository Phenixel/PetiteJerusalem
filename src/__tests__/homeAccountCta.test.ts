import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import fr from "../locales/fr";
import HomeView from "../views/HomeView.vue";

/**
 * L'accueil d'un visiteur non connecté : l'invitation à créer un compte s'y
 * propose, puis s'y oublie. Elle reste partout ailleurs (bibliothèque,
 * chiourim, partage de lectures), là où le compte sert à quelque chose.
 *
 * La reprise de lecture, elle, a quitté l'accueil : elle vit dans la
 * bibliothèque, à côté des textes qu'elle rouvre.
 */

// Aucun compte : c'est la version « visiteur » de l'accueil qu'on regarde, et
// Firebase n'est pas joignable dans les tests.
vi.mock("../services/authService", () => ({
  authService: { onAuthChanged: (fn: (user: null) => void) => (fn(null), () => {}) },
}));

function mount() {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { render: () => null } },
      { path: "/login", component: { render: () => null } },
      { path: "/:rest(.*)", component: { render: () => null } },
    ],
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(HomeView) });
  app.use(i18n);
  app.use(router);
  // Le pied de page tire le sélecteur de langue, qui attend une directive
  // posée par l'application : sans elle, Vue prévient à chaque rendu.
  app.directive("click-outside", {});
  app.mount(host);

  const text = () => (host.textContent ?? "").replace(/\s+/g, " ").trim();
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
  return { host, router, app, text, button };
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  vi.resetModules();
});

describe("L'accueil d'un visiteur", () => {
  it("propose le compte, avec de quoi l'ignorer", async () => {
    const home = mount();
    await home.router.push("/");
    await home.router.isReady();
    await nextTick();

    expect(home.text()).toContain("Créer un compte");
    expect(home.button("Ignorer")).toBeTruthy();
  });

  it("ne le propose plus une fois ignoré", async () => {
    const home = mount();
    await home.router.push("/");
    await home.router.isReady();
    await nextTick();

    home.button("Ignorer")!.click();
    await nextTick();
    expect(home.text()).not.toContain("Créer un compte");
    // Retenu sur l'appareil : l'accueil ne revient pas dessus à la visite
    // suivante.
    expect(localStorage.getItem("pj_home_account_cta_dismissed")).toBe("1");

    home.app.unmount();
    const again = mount();
    await again.router.push("/");
    await again.router.isReady();
    await nextTick();
    expect(again.text()).not.toContain("Créer un compte");
  });

  it("ne propose plus de reprendre une lecture", async () => {
    const home = mount();
    await home.router.push("/");
    await home.router.isReady();
    await nextTick();

    expect(home.text()).not.toContain("Reprendre ma lecture");
  });
});
