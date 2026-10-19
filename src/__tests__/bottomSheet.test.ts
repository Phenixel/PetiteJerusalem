import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import BottomSheet from "../components/BottomSheet.vue";
import ParcoursSheet from "../components/parcours/BottomSheet.vue";

/**
 * Le bottom sheet de l'app native : il se tire par sa poignée jusqu'au cran
 * suivant, se pousse vers le bas pour se fermer, et ne bouge pas quand il est
 * posé ailleurs (la colonne du panneau d'étude sur un écran large).
 */

let monte: App | null = null;
afterEach(() => {
  monte?.unmount();
  monte = null;
  document.body.innerHTML = "";
});

/** Monte un volet, sa hauteur rendue simulée (jsdom ne mesure rien). */
async function volet(props: Record<string, unknown>, hauteur: number) {
  const ferme = vi.fn();
  const host = document.createElement("div");
  document.body.appendChild(host);
  monte = createApp({
    render: () => h(BottomSheet, { label: "Volet", onClose: ferme, ...props }, () => "contenu"),
  });
  monte.mount(host);
  await nextTick();
  const sheet = host.querySelector<HTMLElement>(".bottom-sheet")!;
  sheet.getBoundingClientRect = () => ({ height: hauteur }) as DOMRect;
  const grip = host.querySelector<HTMLElement>(".sheet-grip")!;
  grip.setPointerCapture = () => {};
  return { sheet, grip, ferme };
}

/** Un geste sur la poignée : de `from` à `to` (en y), en `ms` millisecondes. */
async function tire(grip: HTMLElement, from: number, to: number, ms: number) {
  const evt = (type: string, y: number, t: number) => {
    const e = new MouseEvent(type, { clientY: y, bubbles: true, button: 0 });
    Object.defineProperty(e, "pointerId", { value: 1 });
    Object.defineProperty(e, "timeStamp", { value: t });
    grip.dispatchEvent(e);
  };
  evt("pointerdown", from, 0);
  evt("pointermove", (from + to) / 2, ms / 2);
  evt("pointermove", to, ms);
  evt("pointerup", to, ms);
  await nextTick();
}

describe("le bottom sheet", () => {
  it("s'ouvre au premier cran et monte au suivant quand on le tire", async () => {
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    const { sheet, grip } = await volet({ snaps: [0.5, 0.9] }, 400);
    expect(sheet.style.height).toBe("50dvh");
    // Un tirage lent vers le haut, plus près du second cran : il s'y pose.
    await tire(grip, 400, 120, 1000);
    expect(sheet.style.height).toBe("90dvh");
  });

  it("redescend d'un cran, sans se fermer, d'un geste franc depuis le plein écran", async () => {
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    const { sheet, grip, ferme } = await volet({ snaps: [0.5, 0.9] }, 400);
    await tire(grip, 400, 120, 1000);
    expect(sheet.style.height).toBe("90dvh");
    sheet.getBoundingClientRect = () => ({ height: 720 }) as DOMRect;
    // Vers le bas, vite, jusqu'à mi-écran : il se pose au premier cran.
    await tire(grip, 120, 420, 60);
    expect(ferme).not.toHaveBeenCalled();
    expect(sheet.style.height).toBe("50dvh");
  });

  it("se ferme d'un geste franc vers le bas", async () => {
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    const { grip, ferme } = await volet({ snaps: [0.5, 0.9] }, 400);
    await tire(grip, 400, 460, 50);
    expect(ferme).toHaveBeenCalledOnce();
  });

  it("à la hauteur de son contenu, se ferme poussé sous les deux tiers", async () => {
    const { grip, ferme } = await volet({}, 150);
    await tire(grip, 600, 620, 1000);
    expect(ferme).not.toHaveBeenCalled();
    await tire(grip, 600, 700, 1000);
    expect(ferme).toHaveBeenCalledOnce();
  });

  it("pushed below its height, slides down instead of shrinking", async () => {
    const { sheet, grip, ferme } = await volet({}, 150);
    const evt = (type: string, y: number, t: number) => {
      const e = new MouseEvent(type, { clientY: y, bubbles: true, button: 0 });
      Object.defineProperty(e, "pointerId", { value: 1 });
      Object.defineProperty(e, "timeStamp", { value: t });
      grip.dispatchEvent(e);
    };
    evt("pointerdown", 600, 0);
    evt("pointermove", 640, 500);
    await nextTick();
    // The height stays the content's; the 40 px go into a translation.
    expect(sheet.style.height).toBe("150px");
    expect(sheet.style.getPropertyValue("--sheet-offset")).toBe("40px");
    expect(sheet.classList.contains("sheet-pushed")).toBe(true);
    evt("pointerup", 640, 1000);
    await nextTick();
    expect(ferme).not.toHaveBeenCalled();
    expect(sheet.style.getPropertyValue("--sheet-offset")).toBe("");
  });

  it("posé ailleurs, n'a ni poignée ni geste", async () => {
    const { sheet, grip, ferme } = await volet({ snaps: [0.5, 0.9], docked: true }, 400);
    expect(sheet.querySelector(".sheet-handle")).toBeNull();
    await tire(grip, 400, 700, 50);
    expect(ferme).not.toHaveBeenCalled();
    expect(sheet.style.height).toBe("");
  });

  it("tiré vers le haut, s'ouvre sur la suite (les commentaires du passage)", async () => {
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    const suite = vi.fn();
    const { grip, ferme } = await volet({ expandable: true, onExpand: suite }, 150);
    await tire(grip, 650, 560, 300);
    expect(suite).toHaveBeenCalledOnce();
    expect(ferme).not.toHaveBeenCalled();
  });

  it("sans suite, ne s'ouvre sur rien quand on le tire vers le haut", async () => {
    const suite = vi.fn();
    const { grip, ferme } = await volet({ onExpand: suite }, 150);
    await tire(grip, 650, 560, 300);
    expect(suite).not.toHaveBeenCalled();
    expect(ferme).not.toHaveBeenCalled();
  });

  it("laisse un simple appui à ce qu'il touche", async () => {
    const suite = vi.fn();
    const { grip, ferme } = await volet({ expandable: true, onExpand: suite }, 150);
    // Le doigt bouge de 3 px : un appui, pas un geste.
    await tire(grip, 650, 647, 120);
    expect(suite).not.toHaveBeenCalled();
    expect(ferme).not.toHaveBeenCalled();
  });
});

/**
 * The sheet of Mon parcours (parcours/BottomSheet.vue), a modal one: it is
 * pulled down from anywhere on it, follows the finger, closes when released
 * low enough or flicked, and leaves the gesture to the page when it goes up
 * or sideways, or when what is under the finger is scrolled.
 */
describe("la feuille de Mon parcours", () => {
  async function feuille() {
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    const ferme = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);
    monte = createApp({
      render: () =>
        h(ParcoursSheet, { open: true, label: "Feuille", onClose: ferme }, () =>
          h("div", { class: "inner" }, "contenu"),
        ),
    });
    monte.mount(host);
    await nextTick();
    await nextTick();
    const panel = document.querySelector<HTMLElement>(".sheet-panel")!;
    // The panel's top at 500 px: 300 px of sheet on screen.
    panel.getBoundingClientRect = () => ({ top: 500 }) as DOMRect;
    const inner = panel.querySelector<HTMLElement>(".inner")!;
    return { panel, inner, ferme };
  }

  /** A touch gesture on `target`, from (x, y) through the given points, `ms` apart. */
  async function glisse(target: HTMLElement, points: [number, number][], ms: number) {
    const evt = (type: string, [x, y]: [number, number], t: number) => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      const touches = type === "touchend" ? [] : [{ clientX: x, clientY: y }];
      Object.defineProperty(e, "touches", { value: touches });
      Object.defineProperty(e, "timeStamp", { value: t });
      target.dispatchEvent(e);
      return e;
    };
    evt("touchstart", points[0], 0);
    const moves = points.slice(1).map((p, i) => evt("touchmove", p, (i + 1) * ms));
    evt("touchend", points[points.length - 1], points.length * ms);
    await nextTick();
    return moves;
  }

  it("follows the finger and closes when released past a third of its height", async () => {
    const { panel, inner, ferme } = await feuille();
    const moves = await glisse(
      inner,
      [
        [100, 520],
        [100, 560],
        [100, 640],
      ],
      200,
    );
    expect(moves.every((e) => e.defaultPrevented)).toBe(true);
    expect(panel.style.getPropertyValue("--sheet-drag")).toBe("120px");
    expect(ferme).toHaveBeenCalledOnce();
  });

  it("comes back up when released higher, slowly", async () => {
    const { panel, inner, ferme } = await feuille();
    await glisse(
      inner,
      [
        [100, 520],
        [100, 560],
        [100, 580],
      ],
      200,
    );
    expect(ferme).not.toHaveBeenCalled();
    expect(panel.style.getPropertyValue("--sheet-drag")).toBe("0px");
  });

  it("closes on a decisive downward flick, even a short one", async () => {
    const { inner, ferme } = await feuille();
    await glisse(
      inner,
      [
        [100, 520],
        [100, 540],
        [100, 580],
      ],
      30,
    );
    expect(ferme).toHaveBeenCalledOnce();
  });

  it("leaves an upward or sideways gesture to the page", async () => {
    const { inner, ferme } = await feuille();
    const up = await glisse(
      inner,
      [
        [100, 520],
        [100, 400],
      ],
      50,
    );
    const side = await glisse(
      inner,
      [
        [100, 520],
        [200, 540],
        [200, 700],
      ],
      50,
    );
    expect([...up, ...side].some((e) => e.defaultPrevented)).toBe(false);
    expect(ferme).not.toHaveBeenCalled();
  });

  it("lets what is scrolled under the finger scroll back first", async () => {
    const { inner, ferme } = await feuille();
    Object.defineProperty(inner, "scrollTop", { value: 80, configurable: true });
    await glisse(
      inner,
      [
        [100, 520],
        [100, 700],
      ],
      20,
    );
    expect(ferme).not.toHaveBeenCalled();
  });
});
