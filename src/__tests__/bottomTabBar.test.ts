import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, type Router } from "vue-router";

/**
 * La barre basse de l'app native : le bouton rond des horaires est une
 * bascule. Un appui ouvre la page (en surcouche, voir App.vue), un second
 * appui la referme et rend la page qu'elle recouvrait. Et l'onglet profil
 * s'annonce « Réglages » tant que personne n'est connecté.
 */

// La barre interroge l'état de connexion (libellé Profil / Réglages) : les
// abonnés sont gardés pour que les tests rendent le verdict eux-mêmes, sans
// initialiser Firebase.
const { authCallbacks } = vi.hoisted(() => ({
  authCallbacks: [] as Array<(user: { id: string } | null) => void>,
}));

vi.mock("../services/authService", () => ({
  authService: {
    onAuthChanged: (callback: (user: { id: string } | null) => void) => {
      authCallbacks.push(callback);
      return () => {};
    },
  },
}));

import fr from "../locales/fr";
import BottomTabBar from "../components/BottomTabBar.vue";

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
  const profileTab = () => host.querySelector('a[href="/profile"]') as HTMLAnchorElement;
  const link = (href: string) => host.querySelector(`a[href="${href}"]`);
  const click = async (el: Element) => {
    el.dispatchEvent(new MouseEvent("click"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  };
  return { router, fab, profileTab, link, click };
}

describe("BottomTabBar", () => {
  beforeEach(() => {
    authCallbacks.length = 0;
  });
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

  it("reste dans l'espace de langue de l'adresse ouverte", async () => {
    const bar = mount();
    // Arrivé d'un résultat de recherche anglais : le bouton rond doit se
    // reconnaître actif, et ne pas ramener dans l'espace français au premier
    // appui.
    await bar.router.push("/en/shabbat-times/lyon");
    await bar.router.isReady();
    await nextTick();
    expect(bar.fab().getAttribute("aria-pressed")).toBe("true");
    // L'onglet Accueil aussi : il mène à /en, pas à l'accueil français.
    expect(bar.link("/en")).toBeTruthy();
    expect(bar.link("/")).toBeNull();

    await bar.router.push("/en/finish-the-shas");
    await nextTick();
    expect(bar.fab().getAttribute("aria-pressed")).toBe("false");
    await bar.click(bar.fab());
    expect(bar.router.currentRoute.value.path).toBe("/en/shabbat-times");

    // Sur une adresse française, rien ne change : c'est l'historique.
    await bar.router.push("/bibliotheque");
    await nextTick();
    await bar.click(bar.fab());
    expect(bar.router.currentRoute.value.path).toBe("/horaires");
  });

  it("l'onglet profil s'annonce « Réglages » sans compte, « Profil » connecté", async () => {
    const bar = mount();
    await bar.router.isReady();
    await nextTick();

    // Personne de connecté (aucun verdict) : la page offre les réglages.
    expect(bar.profileTab().textContent).toContain("Réglages");

    authCallbacks.forEach((callback) => callback({ id: "u1" }));
    await nextTick();
    expect(bar.profileTab().textContent).toContain("Profil");

    // Déconnexion : l'onglet redevient « Réglages ».
    authCallbacks.forEach((callback) => callback(null));
    await nextTick();
    expect(bar.profileTab().textContent).toContain("Réglages");
  });
});
