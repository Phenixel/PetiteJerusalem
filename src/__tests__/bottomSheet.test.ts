import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import BottomSheet from "../components/BottomSheet.vue";

/**
 * Le bottom sheet (commandes d'un passage, panneau d'étude) : il se tire par
 * sa poignée jusqu'au cran suivant et se pousse vers le bas pour se fermer.
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
});
