import { ref, computed } from "vue";
import { userPreferencesService } from "../services/userPreferencesService";

export interface FontOption {
  id: string;
  /** Display name shown in the selector (rendered in the font itself). */
  label: string;
  /** CSS font-family stack applied to the whole app. */
  stack: string;
}

/** Latin (UI) fonts — applied to --font-sans. */
export const LATIN_FONT_OPTIONS: FontOption[] = [
  {
    id: "inter",
    label: "Inter",
    stack: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  {
    id: "lora",
    label: "Lora",
    stack: '"Lora", "Georgia", serif',
  },
  {
    id: "nunito",
    label: "Nunito",
    stack: '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
];

/** Hebrew (reading) fonts — applied to --font-hebrew. */
export const HEBREW_FONT_OPTIONS: FontOption[] = [
  {
    id: "frank",
    label: "Frank Ruhl Libre",
    stack: '"Frank Ruhl Libre", "Noto Serif Hebrew", "David Libre", Georgia, serif',
  },
  {
    id: "david",
    label: "David Libre",
    stack: '"David Libre", "Frank Ruhl Libre", Georgia, serif',
  },
  {
    id: "heebo",
    label: "Heebo",
    stack: '"Heebo", "Arial Hebrew", -apple-system, sans-serif',
  },
];

const DEFAULT_LATIN = LATIN_FONT_OPTIONS[0];
const DEFAULT_HEBREW = HEBREW_FONT_OPTIONS[0];

/**
 * Chargement à la demande des familles NON par défaut.
 *
 * index.html n'embarque en bloquant que Inter + Frank Ruhl Libre (+ Noto Serif
 * Hebrew, repli des teamim) : télécharger les 7 familles pour tous les
 * visiteurs retardait le premier rendu de chaque page. Les alternatives ne
 * concernent que les utilisateurs qui les ont choisies (et l'écran de
 * préférences, qui affiche chaque option dans sa propre police).
 */
const FONT_STYLESHEETS: Record<string, string> = {
  lora: "family=Lora:wght@400;500;600;700",
  nunito: "family=Nunito:wght@400;600;700",
  david: "family=David+Libre:wght@400;500;700",
  heebo: "family=Heebo:wght@400;500;700",
};

const injectedFonts = new Set<string>();

function ensureFontLoaded(fontId: string): void {
  const spec = FONT_STYLESHEETS[fontId];
  if (!spec || injectedFonts.has(fontId) || typeof document === "undefined") return;
  injectedFonts.add(fontId);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${spec}&display=swap`;
  document.head.appendChild(link);
}

/** Pour l'écran de préférences : chaque option du sélecteur s'affiche dans sa police. */
export function ensureAllFontsLoaded(): void {
  Object.keys(FONT_STYLESHEETS).forEach(ensureFontLoaded);
}

const currentLatinId = ref(DEFAULT_LATIN.id);
const currentHebrewId = ref(DEFAULT_HEBREW.id);
let loadedForUserId: string | null = null;
let fontsVersion = 0;

function applyFonts(latin: FontOption, hebrew: FontOption) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--font-sans", latin.stack);
  document.documentElement.style.setProperty("--font-hebrew", hebrew.stack);
}

export function useFonts() {
  const currentLatin = computed(
    () => LATIN_FONT_OPTIONS.find((f) => f.id === currentLatinId.value) || DEFAULT_LATIN,
  );
  const currentHebrew = computed(
    () => HEBREW_FONT_OPTIONS.find((f) => f.id === currentHebrewId.value) || DEFAULT_HEBREW,
  );

  async function loadFonts(userId: string) {
    if (loadedForUserId === userId) return;
    const versionAtStart = ++fontsVersion;
    try {
      const prefs = await userPreferencesService.getPreferences(userId);
      if (fontsVersion !== versionAtStart) return;
      currentLatinId.value = LATIN_FONT_OPTIONS.some((f) => f.id === prefs.fontLatin)
        ? prefs.fontLatin
        : DEFAULT_LATIN.id;
      currentHebrewId.value = HEBREW_FONT_OPTIONS.some((f) => f.id === prefs.fontHebrew)
        ? prefs.fontHebrew
        : DEFAULT_HEBREW.id;
      ensureFontLoaded(currentLatinId.value);
      ensureFontLoaded(currentHebrewId.value);
      applyFonts(currentLatin.value, currentHebrew.value);
      loadedForUserId = userId;
    } catch {
      if (fontsVersion !== versionAtStart) return;
      resetFonts();
    }
  }

  async function setLatinFont(userId: string, fontId: string) {
    if (!LATIN_FONT_OPTIONS.some((f) => f.id === fontId)) return;
    ensureFontLoaded(fontId);
    const previous = currentLatinId.value;
    fontsVersion++;
    loadedForUserId = userId;
    currentLatinId.value = fontId;
    applyFonts(currentLatin.value, currentHebrew.value);
    try {
      await userPreferencesService.savePreferences(userId, { fontLatin: fontId });
    } catch {
      currentLatinId.value = previous;
      applyFonts(currentLatin.value, currentHebrew.value);
      throw new Error("Failed to save font preference");
    }
  }

  async function setHebrewFont(userId: string, fontId: string) {
    if (!HEBREW_FONT_OPTIONS.some((f) => f.id === fontId)) return;
    ensureFontLoaded(fontId);
    const previous = currentHebrewId.value;
    fontsVersion++;
    loadedForUserId = userId;
    currentHebrewId.value = fontId;
    applyFonts(currentLatin.value, currentHebrew.value);
    try {
      await userPreferencesService.savePreferences(userId, { fontHebrew: fontId });
    } catch {
      currentHebrewId.value = previous;
      applyFonts(currentLatin.value, currentHebrew.value);
      throw new Error("Failed to save font preference");
    }
  }

  function resetFonts() {
    currentLatinId.value = DEFAULT_LATIN.id;
    currentHebrewId.value = DEFAULT_HEBREW.id;
    loadedForUserId = null;
    applyFonts(DEFAULT_LATIN, DEFAULT_HEBREW);
  }

  return {
    currentLatinId,
    currentHebrewId,
    currentLatin,
    currentHebrew,
    latinFonts: LATIN_FONT_OPTIONS,
    hebrewFonts: HEBREW_FONT_OPTIONS,
    loadFonts,
    setLatinFont,
    setHebrewFont,
    resetFonts,
  };
}
