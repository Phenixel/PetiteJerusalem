import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";

/**
 * La pastille du défilement automatique : le seul signe que la page avance
 * toute seule, et le seul endroit où la régler sans quitter le texte.
 *
 * Ce qui doit tenir : un appui ouvre l'allure et le suivant arrête, la
 * pastille touchée pour ouvrir étant elle-même le bouton d'arrêt (voir
 * docs/design.md) ; un appui à côté referme sans rien arrêter, fermer et
 * arrêter n'étant pas le même geste ; et l'allure se règle à un curseur qui
 * porte un cran par allure, du plus lent au plus rapide.
 */

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));

import fr from "../locales/fr";
import AutoScrollPill from "../components/AutoScrollPill.vue";
import {
  AUTO_SCROLL_SPEEDS,
  autoScrollSpeedId,
  isAutoScrolling,
  setAutoScrollSpeed,
  useAutoScroll,
} from "../composables/useAutoScroll";

/** Une page assez haute pour qu'il y ait quelque chose à faire descendre. */
function stubEnvironment() {
  Object.defineProperty(window, "scrollY", { get: () => 0, configurable: true });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    get: () => 5000,
    configurable: true,
  });
  window.innerHeight = 800;
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  // Les images sont données à la main (voir `settle`) : ce qui se teste ici
  // est la pastille, pas le défilement (voir autoScroll.test.ts). Vue en a
  // besoin tout de même, il pose les classes de transition à l'image suivante
  // et un panneau qui sort ne quitterait jamais le DOM sans elles.
  frames = [];
  window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    frames.push(callback)) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = (() => {}) as typeof window.cancelAnimationFrame;
}

let frames: FrameRequestCallback[] = [];

/** Rend quelques images, le temps qu'une transition entre ou sorte pour de bon. */
async function settle() {
  for (let i = 0; i < 4; i++) {
    const pending = frames;
    frames = [];
    for (const callback of pending) callback(i);
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * Le temps est tenu à la main : deux tests de suite comptent pour le même
 * geste sans cela (le garde-fou du double appui, voir useAutoScroll).
 */
let now = 1_000_000;
let mounted: App | null = null;

/** Un texte ouvert, la descente lancée au double appui, et la pastille avec. */
async function lance() {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({
    setup() {
      useAutoScroll();
      return () => [h("p", "un verset"), h(AutoScrollPill)];
    },
  });
  // Le mini-lecteur, sous la pastille, lit la route en cours (useBottomChrome).
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:chemin(.*)*", component: { render: () => null } }],
  });
  app.use(i18n).use(router);
  app.mount(host);
  mounted = app;
  await nextTick();
  host.querySelector("p")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  await settle();
  return host;
}

const pastille = (host: HTMLElement) =>
  host.querySelector<HTMLButtonElement>('[role="status"] button')!;
const panneau = (host: HTMLElement) => host.querySelector(".pill-panel");
const curseur = (host: HTMLElement) => host.querySelector<HTMLInputElement>("input.speed-range")!;
const texte = (element: Element | null) => element?.textContent?.trim() ?? "";

async function appuie(element: HTMLElement) {
  element.click();
  await settle();
}

describe("pastille du défilement automatique", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    stubEnvironment();
    now += 5000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    setAutoScrollSpeed("slow");
  });

  afterEach(() => {
    // Démonter arrête la descente : la pastille suit le texte qu'elle sert.
    mounted?.unmount();
    mounted = null;
    vi.restoreAllMocks();
  });

  it("s'ouvre sur l'allure au premier appui, et arrête au second", async () => {
    const host = await lance();
    expect(isAutoScrolling.value).toBe(true);
    expect(panneau(host)).toBeNull();
    expect(texte(pastille(host))).toBe(fr.textReading.autoScroll.pill);

    // Ouverte, la pastille devient elle-même le bouton d'arrêt.
    await appuie(pastille(host));
    expect(panneau(host)).not.toBeNull();
    expect(texte(pastille(host))).toBe(fr.textReading.autoScroll.stop);

    await appuie(pastille(host));
    expect(isAutoScrolling.value).toBe(false);
  });

  it("referme sans rien arrêter quand on appuie à côté", async () => {
    const host = await lance();
    await appuie(pastille(host));
    expect(panneau(host)).not.toBeNull();

    await appuie(host.querySelector<HTMLElement>("div.inset-0")!);
    expect(panneau(host)).toBeNull();
    expect(isAutoScrolling.value).toBe(true);
  });

  it("porte un cran par allure, et les allures extrêmes à ses deux bouts", async () => {
    const host = await lance();
    await appuie(pastille(host));

    expect(curseur(host).max).toBe(String(AUTO_SCROLL_SPEEDS.length - 1));
    expect(host.querySelectorAll(".speed-notches span")).toHaveLength(AUTO_SCROLL_SPEEDS.length);

    const bouts = [...host.querySelectorAll(".speed-ends span")].map(texte);
    const nom = (index: number) =>
      fr.textReading.autoScroll.speeds[
        AUTO_SCROLL_SPEEDS[index].id as keyof typeof fr.textReading.autoScroll.speeds
      ];
    expect(bouts).toEqual([nom(0), nom(AUTO_SCROLL_SPEEDS.length - 1)]);
  });

  it("change d'allure quand on pousse le curseur", async () => {
    const host = await lance();
    await appuie(pastille(host));
    expect(curseur(host).value).toBe("0");

    // Poussé à fond : l'allure la plus rapide, prise au glissement même.
    curseur(host).value = String(AUTO_SCROLL_SPEEDS.length - 1);
    curseur(host).dispatchEvent(new Event("input"));
    await settle();

    expect(autoScrollSpeedId.value).toBe(AUTO_SCROLL_SPEEDS[AUTO_SCROLL_SPEEDS.length - 1].id);
    expect(isAutoScrolling.value).toBe(true); // Régler n'arrête pas.
  });
});
