import { describe, expect, it } from "vitest";
import { clampView, MAX_SCALE, zoomAt } from "../composables/usePinchZoom";

/**
 * The zoom of a photo (usePinchZoom, used by the parchment window): the spot
 * you pinch stays under your fingers, and the photo never leaves its frame.
 */
describe("le zoom d'une photo", () => {
  it("garde sous les doigts le point qu'on agrandit", () => {
    const view = zoomAt({ scale: 1, x: 0, y: 0 }, 2, 100, 50);
    expect(view).toEqual({ scale: 2, x: -100, y: -50 });
    // The point of the photo under (100, 50) is the same before and after.
    expect((100 - view.x) / view.scale).toBe(100);
    expect((50 - view.y) / view.scale).toBe(50);
  });

  it("ne réduit pas la photo sous la taille du cadre, ni ne l'agrandit sans fin", () => {
    expect(zoomAt({ scale: 2, x: -100, y: -100 }, 0.5, 0, 0).scale).toBe(1);
    expect(zoomAt({ scale: 1, x: 0, y: 0 }, 50, 0, 0).scale).toBe(MAX_SCALE);
  });

  it("arrête la photo à ses bords", () => {
    // Zoomed out, it sits exactly on the frame.
    expect(clampView({ scale: 1, x: 40, y: -30 }, 300, 400)).toEqual({ scale: 1, x: 0, y: 0 });
    // Zoomed in twice, it moves at most by one frame's width and height.
    expect(clampView({ scale: 2, x: -1000, y: 20 }, 300, 400)).toEqual({ scale: 2, x: -300, y: 0 });
  });
});
