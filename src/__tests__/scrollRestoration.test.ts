import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { waitUntilPositionReachable } from "../router/scrollRestoration";

/**
 * Le bug tenu par ces tests : dans l'app native, refermer la surcouche des
 * horaires ramenait en haut de la page recouverte. Vue Router reposait la
 * position sauvée juste après le remontage de la page, avant que son contenu
 * (chargé en asynchrone) ne lui rende sa hauteur : le navigateur écrêtait le
 * défilement à zéro. La restauration attend désormais que la position soit
 * atteignable (voir scrollBehavior dans router/index.ts).
 */

const VIEWPORT = 640;

function setDocumentHeight(height: number) {
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    get: () => height,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, "innerHeight", { configurable: true, get: () => VIEWPORT });
});

afterEach(() => {
  vi.useRealTimers();
  // Retire les hauteurs posées sur l'instance : retour aux valeurs de jsdom.
  delete (document.documentElement as unknown as Record<string, unknown>)["scrollHeight"];
  delete (window as unknown as Record<string, unknown>)["innerHeight"];
});

describe("waitUntilPositionReachable", () => {
  it("rend la main tout de suite quand le document est déjà assez haut", async () => {
    setDocumentHeight(VIEWPORT + 500);
    let resolved = false;
    void waitUntilPositionReachable(500).then(() => (resolved = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(true);
  });

  it("attend que le contenu rende sa hauteur à la page", async () => {
    setDocumentHeight(VIEWPORT); // Page tout juste remontée : un écran de haut.
    let resolved = false;
    void waitUntilPositionReachable(500).then(() => (resolved = true));

    // Le contenu n'est pas arrivé : la position reste en attente.
    await vi.advanceTimersByTimeAsync(200);
    expect(resolved).toBe(false);

    // Le contenu arrive, le document grandit : la position est rendue.
    setDocumentHeight(VIEWPORT + 2000);
    await vi.advanceTimersByTimeAsync(50);
    expect(resolved).toBe(true);
  });

  it("finit par rendre la main si la page reste courte (délai plafond)", async () => {
    setDocumentHeight(VIEWPORT);
    let resolved = false;
    void waitUntilPositionReachable(500, 120).then(() => (resolved = true));

    await vi.advanceTimersByTimeAsync(100);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(100);
    expect(resolved).toBe(true);
  });

  it("une position en haut de page est atteignable d'entrée", async () => {
    setDocumentHeight(VIEWPORT);
    let resolved = false;
    void waitUntilPositionReachable(0).then(() => (resolved = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(true);
  });
});
