import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le thème du compte se sert de la copie locale des préférences
 * (getCachedPreferences) : les couleurs tiennent dès le premier rendu, sans
 * attendre le chargement de Firestore puis l'aller-retour réseau, qui
 * laissaient l'app dans les couleurs par défaut pendant plusieurs secondes.
 * La réponse du serveur confirme ou corrige : le serveur a toujours raison.
 */

const { getPreferences, getCachedPreferences } = vi.hoisted(() => ({
  getPreferences: vi.fn(),
  getCachedPreferences: vi.fn(),
}));

vi.mock("../services/userPreferencesService", () => ({
  userPreferencesService: { getPreferences, getCachedPreferences },
}));

import { THEME_OPTIONS, useTheme } from "../composables/useTheme";

const emerald = THEME_OPTIONS.find((t) => t.id === "emerald")!;
const ocean = THEME_OPTIONS.find((t) => t.id === "ocean")!;
/** Le thème d'origine, celui qui tient tant que rien n'a été choisi. */
const defaut = THEME_OPTIONS[0];

function primaryColor() {
  return document.documentElement.style.getPropertyValue("--color-primary");
}

describe("useTheme et la copie locale", () => {
  beforeEach(() => {
    useTheme().resetTheme();
    getPreferences.mockReset();
    getCachedPreferences.mockReset();
  });

  it("applique le thème de la copie locale sans attendre Firestore", async () => {
    let serveTheme: (prefs: { theme: string }) => void = () => {};
    getPreferences.mockReturnValue(
      new Promise((resolve) => {
        serveTheme = resolve;
      }),
    );
    getCachedPreferences.mockReturnValue({ theme: "ocean" });

    const { loadTheme } = useTheme();
    const pending = loadTheme("u1");

    // Synchrone : les couleurs du compte sont déjà en place.
    expect(primaryColor()).toBe(ocean.primary);

    // Le serveur corrige (le thème a changé depuis un autre appareil).
    serveTheme({ theme: "emerald" });
    await pending;
    expect(primaryColor()).toBe(emerald.primary);
  });

  it("reste au défaut quand la copie locale porte un thème inconnu", async () => {
    getPreferences.mockResolvedValue({ theme: defaut.id });
    getCachedPreferences.mockReturnValue({ theme: "disparu" });

    const { loadTheme } = useTheme();
    const pending = loadTheme("u2");
    expect(primaryColor()).toBe(defaut.primary);
    await pending;
    expect(primaryColor()).toBe(defaut.primary);
  });

  it("attend le serveur quand aucune copie locale n'existe (premier appareil)", async () => {
    getPreferences.mockResolvedValue({ theme: "emerald" });
    getCachedPreferences.mockReturnValue(null);

    const { loadTheme } = useTheme();
    const pending = loadTheme("u3");
    expect(primaryColor()).toBe(defaut.primary);
    await pending;
    expect(primaryColor()).toBe(emerald.primary);
  });
});
