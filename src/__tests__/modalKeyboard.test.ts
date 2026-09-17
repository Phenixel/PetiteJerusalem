import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";

import { useModalKeyboard } from "../composables/useModalKeyboard";

/**
 * Le clavier logiciel couvre le bas de la fenêtre sans la rétrécir : une
 * fenêtre modale centrée sur la page entière y laisse le champ où l'on écrit
 * sous le clavier, et l'on tape sans voir ce qu'on écrit.
 *
 * Ce qui est vérifié ici : pendant la saisie, la fenêtre modale prend la
 * hauteur de ce qui reste visible (variables CSS lues par `.modal-overlay`),
 * le champ est ramené dans cette hauteur, et tout est rendu à la fermeture du
 * clavier. Le suivi ne tourne QUE pendant la saisie : les évènements du
 * viewport visuel arrivent à chaque image d'un défilement.
 */

/** Le viewport visuel de jsdom, qui n'en a pas : la fenêtre, et le clavier. */
function fakeViewport(height: number) {
  const listeners = new Map<string, Set<() => void>>();
  return {
    height,
    offsetTop: 0,
    addEventListener(type: string, fn: () => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: () => void) {
      listeners.get(type)?.delete(fn);
    },
    /** Le clavier se pose (ou se retire) : la hauteur visible change. */
    resizeTo(next: number) {
      this.height = next;
      listeners.get("resize")?.forEach((fn) => fn());
    },
    listenerCount: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
  };
}

const viewport = fakeViewport(800);
const revele = vi.fn();

/** Une fenêtre modale avec son champ, comme « Nous écrire » ou la date limite. */
function ouvreFenetre() {
  document.body.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-panel"><input type="text" id="champ" /></div>
    </div>
    <input type="text" id="hors-fenetre" />
  `;
  return {
    champ: document.querySelector<HTMLInputElement>("#champ")!,
    dehors: document.querySelector<HTMLInputElement>("#hors-fenetre")!,
  };
}

const hauteur = () => document.documentElement.style.getPropertyValue("--modal-viewport-height");
const sommet = () => document.documentElement.style.getPropertyValue("--modal-viewport-top");

/** Laisse passer l'image d'animation où les mesures sont posées. */
function frame() {
  vi.advanceTimersByTime(20);
}

describe("clavier et fenêtres modales", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });
    // jsdom ne pose ni requestAnimationFrame utile ici, ni scrollIntoView.
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
      return setTimeout(() => fn(0), 0) as unknown as number;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    Element.prototype.scrollIntoView = revele;
    revele.mockClear();
    viewport.height = 800;
    viewport.offsetTop = 0;

    const host = document.createElement("div");
    document.body.appendChild(host);
    app = createApp({ setup: () => (useModalKeyboard(), () => h("div")) });
    app.mount(host);
  });

  afterEach(() => {
    app.unmount();
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("ne suit le viewport que pendant qu'on écrit dans une fenêtre modale", () => {
    const { champ, dehors } = ouvreFenetre();
    expect(viewport.listenerCount()).toBe(0);

    // Un champ de page ordinaire ne déclenche rien : le navigateur sait faire
    // défiler le fil de la page jusqu'à lui.
    dehors.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(viewport.listenerCount()).toBe(0);

    champ.focus();
    champ.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(viewport.listenerCount()).toBeGreaterThan(0);
    frame();
    expect(hauteur()).toBe("800px");
    expect(sommet()).toBe("0px");
  });

  it("donne à la fenêtre la hauteur qui reste, et y ramène le champ", () => {
    const { champ } = ouvreFenetre();
    champ.focus();
    champ.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    frame();
    revele.mockClear();

    // Le clavier se pose : il ne reste que 380 pixels de fenêtre.
    viewport.resizeTo(380);
    frame();
    expect(hauteur()).toBe("380px");
    // Le champ est ramené dans ce qui reste visible, plutôt que laissé sous
    // le clavier.
    expect(revele).toHaveBeenCalled();
    expect(revele.mock.calls[0][0]).toMatchObject({ block: "center" });
  });

  it("rend la page entière à la fenêtre quand la saisie est finie", () => {
    const { champ } = ouvreFenetre();
    champ.focus();
    champ.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    frame();
    viewport.resizeTo(380);
    frame();
    expect(hauteur()).toBe("380px");

    champ.blur();
    champ.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    vi.advanceTimersByTime(400);
    // Plus de mesure posée : le style reprend ses valeurs de repli (toute la
    // page), et plus rien n'écoute le viewport.
    expect(hauteur()).toBe("");
    expect(sommet()).toBe("");
    expect(viewport.listenerCount()).toBe(0);
  });
});
