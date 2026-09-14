import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, type Router } from "vue-router";

/**
 * Le menu de lecture : le sommaire d'où l'on rejoint un passage sans faire
 * défiler trois écrans.
 *
 * Trois choses s'y jouent, et aucune ne se voit dans le rendu par défaut.
 * D'abord les titres hébreux : c'est sous ce nom-là qu'un passage se cherche,
 * et qu'il est écrit dans le sidour de papier posé à côté. Ensuite la taille :
 * qui agrandit le texte le fait parce qu'il le lit mal, et un sommaire resté
 * en petits caractères lui serait fermé. Enfin les deux boutons ronds : le
 * bouton du menu reste sous le panneau et devient la croix, les réglages
 * paraissent à sa droite, et la croix passe sur le bouton qu'on vient de
 * toucher quand on change de vue.
 */

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));

import fr from "../locales/fr";
import ReadingMenu from "../components/ReadingMenu.vue";
import { useReadingSize } from "../composables/useReadingSize";
import { addMirrorOffer, removeMirrorOffer } from "../composables/useTefilinMirror";
import { autoScrollEnabled, setAutoScrollEnabled } from "../composables/useAutoScroll";
import { sansTahanoun, setSansTahanoun } from "../composables/useSansTahanoun";

const SECTIONS = [
  { anchor: "b0", offset: 0, label: "Bénédictions du matin", hebrew: "ברכות השחר" },
  { anchor: "b1", offset: 12, label: "Les téfilines", hebrew: "מצות תפילין" },
  // Une guemara : ses dafim n'ont pas de nom hébreu, la ligne s'en passe.
  { anchor: "b2", offset: 30, label: "Daf 2a" },
];

/** Monte le menu, panneau ouvert. */
async function ouvre(props: { tefila?: boolean } = {}) {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:chemin(.*)*", component: { render: () => null } }],
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(ReadingMenu, { sections: SECTIONS, ...props }) });
  app.use(i18n).use(router);
  app.mount(host);
  await router.isReady();
  await nextTick();
  boutonMenu(host).click();
  await nextTick();
  return { host, app };
}

/**
 * Laisse les transitions finir : un élément qui sort (v-if) ne quitte le DOM
 * qu'à l'image suivante, et la vue qui entre après lui (mode out-in) attend
 * son départ.
 */
async function settle() {
  await nextTick();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await nextTick();
}

/** Le bouton rond du menu : celui qui ouvre, et qui reste sous le panneau. */
function boutonMenu(host: HTMLElement): HTMLButtonElement {
  return host.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
}

/** Le second bouton rond, à droite du premier : les réglages, ou la croix. */
function boutonReglages(host: HTMLElement): HTMLButtonElement | null {
  return host.querySelector<HTMLButtonElement>(".fab-second button");
}

/** L'interrupteur d'une ligne de réglage, repéré par son intitulé. */
function interrupteur(host: HTMLElement, intitule: string): HTMLInputElement {
  const ligne = [...host.querySelectorAll<HTMLElement>(".setting-row")].find((el) =>
    el.textContent?.includes(intitule),
  )!;
  return ligne.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
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

  it("garde le bouton du menu sous le panneau, devenu la croix qui le ferme", async () => {
    const { host } = await ouvre();
    expect(host.querySelector(".nav-panel")).not.toBeNull();
    // Le bouton est toujours là, et c'est lui qui ferme : pas de croix à
    // chercher dans le panneau.
    const menu = boutonMenu(host);
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    expect(menu.getAttribute("aria-label")).toBe(fr.common.close);
    expect(
      host.querySelector(".nav-panel button[aria-label='" + fr.common.close + "']"),
    ).toBeNull();

    menu.click();
    await settle();
    expect(host.querySelector(".nav-panel")).toBeNull();
    expect(menu.getAttribute("aria-label")).toBe(fr.textReading.navMenu);
    expect(boutonReglages(host)).toBeNull();
  });

  it("fait paraître les réglages à droite, et la croix passe sur le bouton touché", async () => {
    const { host } = await ouvre();
    const reglages = boutonReglages(host)!;
    expect(reglages.getAttribute("aria-label")).toBe(fr.textReading.settings.open);

    reglages.click();
    await settle();
    // Les réglages ont pris la place du sommaire.
    expect(host.textContent).toContain(fr.textReading.settings.autoScroll);
    expect(host.querySelector(".section-item")).toBeNull();
    // Les rôles se sont échangés : la croix est à la place des réglages, le
    // bouton du menu ramène au sommaire.
    expect(reglages.getAttribute("aria-label")).toBe(fr.common.close);
    expect(boutonMenu(host).getAttribute("aria-label")).toBe(fr.textReading.settings.backToMenu);

    boutonMenu(host).click();
    await settle();
    expect(host.querySelector(".section-item")).not.toBeNull();
    expect(boutonMenu(host).getAttribute("aria-label")).toBe(fr.common.close);

    // Depuis les réglages, la croix ferme tout, et le menu rouvrira sur le sommaire.
    boutonReglages(host)!.click();
    await settle();
    boutonReglages(host)!.click();
    await settle();
    expect(host.querySelector(".nav-panel")).toBeNull();
    boutonMenu(host).click();
    await settle();
    expect(host.querySelector(".section-item")).not.toBeNull();
  });

  it("coupe et rallume le défilement automatique depuis les réglages", async () => {
    setAutoScrollEnabled(true);
    const { host } = await ouvre();
    boutonReglages(host)!.click();
    await settle();

    const bascule = interrupteur(host, fr.textReading.settings.autoScroll);
    expect(bascule.checked).toBe(true);
    bascule.click();
    await settle();
    expect(autoScrollEnabled.value).toBe(false);
    bascule.click();
    await settle();
    expect(autoScrollEnabled.value).toBe(true);
  });

  it("ne propose « sans tahanoun » que devant un office", async () => {
    const guemara = await ouvre();
    boutonReglages(guemara.host)!.click();
    await settle();
    expect(guemara.host.textContent).not.toContain(fr.textReading.settings.sansTahanoun);

    const office = await ouvre({ tefila: true });
    boutonReglages(office.host)!.click();
    await settle();
    expect(office.host.textContent).toContain(fr.textReading.settings.sansTahanoun);

    const bascule = interrupteur(office.host, fr.textReading.settings.sansTahanoun);
    expect(bascule.checked).toBe(false);
    bascule.click();
    await settle();
    expect(sansTahanoun.value).toBe(true);
    setSansTahanoun(false);
  });
});
