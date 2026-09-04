import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import fr from "../locales/fr";
import StudyPage from "../views/StudyPage.vue";

/**
 * Les cinq sefarim des Tehilim se replient : cent cinquante psaumes font une
 * longue page, et le titre d'un sefer range d'un appui ce qu'on ne lit pas.
 *
 * Tout est déplié au départ : on vient chercher un psaume, il doit être là.
 * Le repli ne vaut que pour ce livre-là, et jamais pendant une recherche : ce
 * qu'elle trouve doit être visible.
 */

// L'authentification n'a rien à faire ici : la bibliothèque se lit sans compte,
// et Firebase n'est pas joignable dans les tests.
vi.mock("../services/authService", () => ({
  authService: { onAuthChanged: () => () => {} },
}));

function mount() {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/bibliotheque", component: { render: () => null } },
      { path: "/bibliotheque/:corpus", component: { render: () => null } },
      { path: "/bibliotheque/:corpus/:slug", component: { render: () => null } },
    ],
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(StudyPage) });
  app.use(i18n);
  app.use(router);
  app.mount(host);

  // Les en-têtes de sefer, devenus des boutons repliables. Les encadrés du
  // livre (« Avant la lecture ») se replient aussi, et arrivent en cours de
  // route (composant chargé à la demande) : on ne garde que les sefarim.
  const bookButtons = () =>
    ([...host.querySelectorAll("button[aria-expanded]")] as HTMLButtonElement[]).filter((b) =>
      /Sefer/.test(b.textContent ?? ""),
    );
  const psalmLinks = () =>
    [...host.querySelectorAll("a")].filter((a) =>
      (a.getAttribute("href") ?? "").startsWith("/bibliotheque/tehilim/"),
    );
  mounted.push(app);
  return { host, router, app, bookButtons, psalmLinks };
}

/** Les pages montées d'un test : démontées avant le suivant. */
const mounted: { unmount: () => void }[] = [];

/** Le temps que le repli se referme (voir CollapseTransition). */
const folded = () => new Promise((resolve) => setTimeout(resolve, 400));

beforeEach(() => {
  document.body.innerHTML = "";
});

// La bibliothèque charge ses encarts à la demande (chnei mikra, psaumes du
// jour) : laissée montée, une page rendrait son encart une fois le test fini,
// donc hors de son environnement.
afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount();
});

describe("Les sefarim des Tehilim", () => {
  it("s'ouvrent déroulés, et se replient un par un", async () => {
    const page = mount();
    await page.router.push("/bibliotheque/tehilim");
    await page.router.isReady();
    await nextTick();

    // Les cinq sefarim, déroulés : les cent cinquante psaumes sont là.
    const books = page.bookButtons();
    expect(books.length).toBe(5);
    expect(books[0].textContent).toContain("Sefer 1");
    // La plage de psaumes dit ce qu'un titre couvre, donc ce qu'il range.
    expect(books[0].textContent).toContain("1 à 41");
    expect(books[0].getAttribute("aria-expanded")).toBe("true");
    expect(page.psalmLinks().length).toBe(150);

    // Replié, un sefer ne pose aucune de ses cartes : le premier va du
    // psaume 1 au psaume 41. Le repli est animé (CollapseTransition), ses
    // cartes ne quittent la page qu'une fois la hauteur refermée.
    books[0].click();
    await nextTick();
    expect(page.bookButtons()[0].getAttribute("aria-expanded")).toBe("false");
    await folded();
    expect(page.psalmLinks().length).toBe(150 - 41);

    page.bookButtons()[0].click();
    await nextTick();
    expect(page.bookButtons()[0].getAttribute("aria-expanded")).toBe("true");
    await folded();
    expect(page.psalmLinks().length).toBe(150);
  });

  it("laissent les autres corpus déroulés", async () => {
    const page = mount();
    await page.router.push("/bibliotheque/michna");
    await page.router.isReady();
    await nextTick();

    expect(page.bookButtons().length).toBe(0);
    expect(page.host.querySelectorAll("h3").length).toBeGreaterThan(0);
  });
});
