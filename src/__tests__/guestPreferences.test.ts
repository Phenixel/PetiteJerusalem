import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Réglages sans compte (la page profil de l'app native sert de page de
 * réglages, accessible déconnecté).
 *
 * Ce qui doit tenir :
 * - un réglage fait sans compte (thème, police) s'applique tout de suite et
 *   reste sur l'appareil, sans toucher Firestore ;
 * - seuls les champs explicitement choisis sont gardés : une création de
 *   compte n'écrit jamais des valeurs par défaut jamais touchées ;
 * - à la connexion, le compte adopte ces choix pour les champs que son
 *   document ne définit pas encore, et les écrit chez Firestore pour les
 *   autres appareils ; un choix fait en ligne n'est jamais écrasé ;
 * - le réglage d'appareil survit à la connexion (il resservira déconnecté).
 */

const getDoc = vi.fn();
const setDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` }),
  getDoc: (...args: unknown[]) => getDoc(...args),
  setDoc: (...args: unknown[]) => setDoc(...args),
  arrayUnion: (...values: unknown[]) => values,
  deleteDoc: vi.fn(),
}));

vi.mock("../firebase/firestore", () => ({ db: {} }));

import { userPreferencesService } from "../services/userPreferencesService";
import { THEME_OPTIONS, useTheme } from "../composables/useTheme";
import { useFonts } from "../composables/useFonts";

function snapshot(data: Record<string, unknown> | null) {
  return { exists: () => data !== null, data: () => data };
}

function cssVar(name: string) {
  return document.documentElement.style.getPropertyValue(name);
}

const GUEST_KEY = "pj-preferences:guest";
const sunset = THEME_OPTIONS.find((t) => t.id === "sunset")!;
const emerald = THEME_OPTIONS.find((t) => t.id === "emerald")!;

describe("réglages sans compte", () => {
  beforeEach(() => {
    localStorage.clear();
    getDoc.mockReset();
    setDoc.mockReset();
    setDoc.mockResolvedValue(undefined);
    useTheme().resetTheme();
    useFonts().resetFonts();
  });

  it("applique et garde un thème choisi sans compte, sans toucher Firestore", async () => {
    const { setTheme } = useTheme();
    await setTheme(null, "sunset");

    expect(cssVar("--color-primary")).toBe(sunset.primary);
    // Seul le champ choisi est gardé : pas de valeurs par défaut figées.
    expect(JSON.parse(localStorage.getItem(GUEST_KEY)!)).toEqual({ theme: "sunset" });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("ressert les réglages d'appareil au lancement", () => {
    userPreferencesService.saveGuestPreferences({ theme: "emerald", fontHebrew: "heebo" });

    useTheme().loadGuestTheme();
    useFonts().loadGuestFonts();

    expect(cssVar("--color-primary")).toBe(emerald.primary);
    expect(cssVar("--font-hebrew")).toContain("Heebo");
    // La police latine n'a jamais été choisie : celle d'origine.
    expect(cssVar("--font-sans")).toContain("Atkinson");
  });

  it("repart des valeurs d'origine quand rien n'a été réglé", () => {
    useTheme().loadGuestTheme();
    expect(cssVar("--color-primary")).toBe(THEME_OPTIONS[0].primary);
  });

  it("à la connexion, le compte adopte les choix que son document ne définit pas", async () => {
    userPreferencesService.saveGuestPreferences({ theme: "sunset" });
    getDoc.mockResolvedValue(snapshot({ dailyReadingIds: [3] }));

    const prefs = await userPreferencesService.getPreferences("compte-sans-theme");

    expect(prefs.theme).toBe("sunset");
    expect(setDoc).toHaveBeenCalledWith(
      { path: "userPreferences/compte-sans-theme" },
      { theme: "sunset" },
      { mergeFields: ["theme"] },
    );
  });

  it("n'écrase jamais un choix fait en ligne", async () => {
    userPreferencesService.saveGuestPreferences({ theme: "sunset" });
    getDoc.mockResolvedValue(snapshot({ theme: "emerald" }));

    const prefs = await userPreferencesService.getPreferences("compte-installe");

    expect(prefs.theme).toBe("emerald");
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("un compte tout neuf (aucun document) adopte tous les choix d'appareil", async () => {
    userPreferencesService.saveGuestPreferences({ theme: "emerald", fontLatin: "lora" });
    getDoc.mockResolvedValue(snapshot(null));

    const prefs = await userPreferencesService.getPreferences("premier-compte");

    expect(prefs.theme).toBe("emerald");
    expect(prefs.fontLatin).toBe("lora");
    expect(setDoc).toHaveBeenCalledWith(
      { path: "userPreferences/premier-compte" },
      { theme: "emerald", fontLatin: "lora" },
      { mergeFields: ["theme", "fontLatin"] },
    );
  });

  it("le réglage d'appareil survit à la connexion", async () => {
    userPreferencesService.saveGuestPreferences({ theme: "sunset" });
    getDoc.mockResolvedValue(snapshot({ theme: "emerald" }));
    await userPreferencesService.getPreferences("compte-revenant");

    expect(userPreferencesService.getGuestPreferences()).toEqual({ theme: "sunset" });
  });
});
