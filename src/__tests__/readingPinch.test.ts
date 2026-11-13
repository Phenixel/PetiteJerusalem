import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, effectScope, h, ref } from "vue";

/**
 * The pinch on a text, in the app, sets the reading size (useReadingPinch);
 * while a window is open over the text, the fingers are the window's: pinching
 * a parchment's photo to zoom into it must not enlarge the text behind it.
 */

const increase = vi.fn();
const decrease = vi.fn();

vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true }));
vi.mock("../composables/useReadingSize", () => ({
  useReadingSizeControl: () => ({ increase, decrease }),
}));

import { useReadingPinch } from "../composables/useReadingPinch";
import { useOverlay } from "../composables/useOverlayStack";

function fingers(type: string, gap: number): void {
  const touches = [
    { clientX: 100, clientY: 200 },
    { clientX: 100 + gap, clientY: 200 },
  ];
  const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;
  Object.defineProperty(event, "touches", { value: touches });
  document.dispatchEvent(event);
}

function mountReader() {
  const app = createApp({
    setup() {
      useReadingPinch();
      return () => h("div");
    },
  });
  app.mount(document.createElement("div"));
  return app;
}

describe("le pincement sur un texte", () => {
  afterEach(() => {
    increase.mockClear();
    decrease.mockClear();
  });

  it("agrandit le texte quand on écarte les doigts", () => {
    const app = mountReader();
    fingers("touchstart", 100);
    fingers("touchmove", 140);
    expect(increase).toHaveBeenCalledTimes(1);
    app.unmount();
  });

  it("ne touche pas au texte derrière une fenêtre ouverte", () => {
    const app = mountReader();
    const scope = effectScope();
    scope.run(() => useOverlay(ref(true), () => {}));

    fingers("touchstart", 100);
    fingers("touchmove", 140);
    fingers("touchmove", 60);
    expect(increase).not.toHaveBeenCalled();
    expect(decrease).not.toHaveBeenCalled();

    scope.stop();
    app.unmount();
  });
});
