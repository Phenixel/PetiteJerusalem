import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, type Router } from "vue-router";

/**
 * La bulle d'un passage sur un écran large (tablette, pliant ouvert,
 * ordinateur, voir useSideBySide) : elle se pose contre le passage, au-dessus
 * de lui, ou dessous quand elle n'y tient pas. Sur un téléphone, les mêmes
 * commandes montent dans un volet (readingSelection.test.ts).
 *
 * L'écran large est simulé avant que rien ne soit importé : useSideBySide lit
 * la largeur au chargement.
 *
 * Ce qui se joue ici ne se voit dans aucun rendu : que la sélection du système
 * soit bien coupée sur les passages (sans quoi son menu, copier et traduire en
 * tête, s'ouvre par-dessus le nôtre), que la couleur de la sélection vienne du
 * thème et non du navigateur, et surtout que le signalement parte avec de quoi
 * retrouver le passage. C'est cette dernière ligne qui décide si une erreur
 * signalée se corrige ou se cherche.
 */

vi.hoisted(() => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("min-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));

import fr from "../locales/fr";
import ReadingSelectionMenu from "../components/ReadingSelectionMenu.vue";
import {
  clearPassage,
  selectPassage,
  type ReadingPassage,
} from "../composables/useReadingSelection";
import { closeFeedback, feedbackPrefill } from "../composables/useFeedback";

/** « Au commencement Dieu créa » : de l'hébreu vocalisé, donc translittérable. */
const HEBREU = "בְּרֵאשִׁית בָּרָא אֱלֹהִים";

function passage(extra: Partial<ReadingPassage> = {}): ReadingPassage {
  const el = document.createElement("p");
  el.className = "reading-pick";
  el.textContent = HEBREU;
  document.body.appendChild(el);
  return {
    key: "1#0#3",
    el,
    hebrew: HEBREU,
    place: "Tehilim 23 · verset 4",
    url: "https://petitejerusalem.fr/bibliotheque/tehilim/tehilim-23?verset=3",
    bookmarked: null,
    ...extra,
  };
}

/**
 * Monte la bulle, un passage choisi, et rend ses commandes. L'application
 * montée est démontée après chaque cas : elle téléporte la fenêtre de partage
 * dans le <body>, qu'un simple vidage laisserait sans ses repères.
 */
let monte: App | null = null;

async function ouvre(choisi: ReadingPassage) {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:chemin(.*)*", component: { render: () => null } }],
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(ReadingSelectionMenu) });
  app.use(i18n).use(router);
  app.mount(host);
  monte = app;
  await router.isReady();
  selectPassage(choisi);
  // Deux tours : la bulle est rendue au premier, et se replace au second, sa
  // hauteur enfin connue (dans un navigateur, les deux tiennent dans la même
  // image, rien ne se voit bouger).
  await nextTick();
  await nextTick();
  return host;
}

/** Monte la bulle sur un passage DÉJÀ choisi, comme le fait la première fois. */
async function monteSeule(): Promise<HTMLElement> {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:chemin(.*)*", component: { render: () => null } }],
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(ReadingSelectionMenu) });
  app.use(i18n).use(router);
  app.mount(host);
  monte = app;
  await router.isReady();
  await nextTick();
  return host;
}

function repart(): void {
  clearPassage();
  closeFeedback();
  feedbackPrefill.value = null;
}

afterEach(() => {
  monte?.unmount();
  monte = null;
  document.body.innerHTML = "";
});

/**
 * La place de la bulle. Elle se pose CONTRE le passage : tant qu'elle n'est
 * pas rendue, sa hauteur n'est qu'une supposition, et le tout premier passage
 * choisi d'une page se voyait coiffé d'une bulle flottant bien au-dessus de
 * lui, un blanc entre les deux. C'est ce cas-là, le premier choix, que le
 * test tient.
 */
describe("la place de la bulle", () => {
  /** Hauteur de la bulle : jsdom ne met en page rien du tout. */
  const hauteurBulle = 50;
  const HAUT = 300;

  beforeEach(() => {
    repart();
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("reading-bubble") ? hauteurBulle : 0;
      },
    });
  });

  afterEach(() => {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetHeight;
  });

  /** Un passage posé à une hauteur connue de la fenêtre. */
  function pose(haut: number, bas: number): ReadingPassage {
    const p = passage();
    p.el.getBoundingClientRect = () =>
      ({ top: haut, bottom: bas, left: 0, right: 360, width: 360, height: bas - haut }) as DOMRect;
    return p;
  }

  const hautDeLaBulle = (host: HTMLElement): string =>
    (host.querySelector(".bubble-anchor") as HTMLElement).style.top;

  it("se pose contre le passage choisi", async () => {
    const host = await ouvre(pose(HAUT, HAUT + 40));
    // Au-dessus du passage, à l'écart près : sur sa hauteur SUPPOSÉE elle se
    // serait posée bien plus haut, laissant un blanc sous elle.
    expect(hautDeLaBulle(host)).toBe(`${HAUT - 6 - hauteurBulle}px`);
  });

  it("s'y pose aussi au tout premier passage de la page", async () => {
    // Le cas qui était faux : la bulle n'est montée qu'au premier passage
    // choisi (App.vue), donc elle se place pendant son propre montage, et le
    // suivi du passage ne rejoue pas pour un choix déjà fait.
    selectPassage(pose(HAUT, HAUT + 40));
    const host = await monteSeule();
    expect(hautDeLaBulle(host)).toBe(`${HAUT - 6 - hauteurBulle}px`);
  });

  it("passe sous le passage quand elle ne tient pas au-dessus", async () => {
    const host = await ouvre(pose(20, 60));
    expect(hautDeLaBulle(host)).toBe("66px");
  });
});
