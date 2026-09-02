import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, type Router } from "vue-router";

/**
 * Le menu de lecture : le sommaire d'où l'on rejoint un passage sans faire
 * défiler trois écrans.
 *
 * Deux choses s'y jouent, et aucune ne se voit dans le rendu par défaut.
 * D'abord les titres hébreux : c'est sous ce nom-là qu'un passage se cherche,
 * et qu'il est écrit dans le sidour de papier posé à côté. Ensuite la taille :
 * qui agrandit le texte le fait parce qu'il le lit mal, et un sommaire resté
 * en petits caractères lui serait fermé.
 */

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));

import fr from "../locales/fr";
import ReadingMenu from "../components/ReadingMenu.vue";
import { useReadingSize } from "../composables/useReadingSize";
import { addMirrorOffer, removeMirrorOffer } from "../composables/useTefilinMirror";

const SECTIONS = [
  { offset: 0, label: "Bénédictions du matin", hebrew: "ברכות השחר" },
  { offset: 12, label: "Les téfilines", hebrew: "מצות תפילין" },
  // Une guemara : ses dafim n'ont pas de nom hébreu, la ligne s'en passe.
  { offset: 30, label: "Daf 2a" },
];

/** Monte le menu, panneau ouvert. */
async function ouvre() {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:chemin(.*)*", component: { render: () => null } }],
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(ReadingMenu, { sections: SECTIONS }) });
  app.use(i18n).use(router);
  app.mount(host);
  await router.isReady();
  await nextTick();
  host.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click();
  await nextTick();
  return { host, app };
}

describe("taille de lecture", () => {
  it("part de la taille normale quand personne n'a réglé quoi que ce soit", () => {
    // `Number(null)` vaut 0, un niveau valide : le compte y était, mais un cran
    // trop bas, et tout le corpus se lisait à ×0,85 pour qui n'avait jamais
    // touché à A− / A+.
    localStorage.removeItem("pj-reading-size");
    expect(useReadingSize().scale.value).toBe(1);
  });
});

describe("menu de lecture", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("donne chaque repère sous son nom traduit et son nom hébreu", async () => {
    const { host } = await ouvre();
    const items = [...host.querySelectorAll(".section-item")].map((el) => el.textContent ?? "");

    expect(items.some((t) => t.includes("Bénédictions du matin") && t.includes("ברכות השחר"))).toBe(
      true,
    );
    expect(items.some((t) => t.includes("Les téfilines") && t.includes("מצות תפילין"))).toBe(true);
    // Le repère sans nom hébreu ne laisse pas de place vide.
    const daf = [...host.querySelectorAll(".section-item")].find((el) =>
      el.textContent?.includes("Daf 2a"),
    )!;
    expect(daf.querySelector(".section-he")).toBeNull();
  });

  it("n'offre le miroir que là où l'on pose les téfilines", async () => {
    // Cha'harit le porte, Min'ha et Arvit non : le menu ne doit pas proposer
    // un miroir devant un texte qui n'en a que faire.
    const sansMiroir = await ouvre();
    expect(sansMiroir.host.textContent).not.toContain(fr.textReading.mirror.title);

    addMirrorOffer();
    const avecMiroir = await ouvre();
    expect(avecMiroir.host.textContent).toContain(fr.textReading.mirror.title);
    removeMirrorOffer();
  });

  it("grandit avec la taille de lecture, sans la suivre pas à pas", async () => {
    const { host } = await ouvre();
    const panneau = host.querySelector<HTMLElement>(".nav-panel")!;
    expect(panneau.style.getPropertyValue("--menu-scale")).toBe("1");

    // Deux crans d'agrandissement (×1,15 puis ×1,35 pour le texte).
    const taille = useReadingSize();
    taille.increase();
    taille.increase();
    await nextTick();

    const echelle = Number(panneau.style.getPropertyValue("--menu-scale"));
    expect(echelle).toBeGreaterThan(1);
    // À moitié du chemin : le menu grandit, sans dépasser ce qu'il sert à
    // atteindre.
    expect(echelle).toBeLessThan(taille.scale.value);
    expect(echelle).toBeCloseTo(1 + (taille.scale.value - 1) / 2, 5);
  });
});
