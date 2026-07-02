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
      applyFonts(currentLatin.value, currentHebrew.value);
      loadedForUserId = userId;
    } catch {
      if (fontsVersion !== versionAtStart) return;
      resetFonts();
    }
  }

  async function setLatinFont(userId: string, fontId: string) {
    if (!LATIN_FONT_OPTIONS.some((f) => f.id === fontId)) return;
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
