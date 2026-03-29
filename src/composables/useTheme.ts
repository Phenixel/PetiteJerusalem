import { ref, computed } from "vue";
import { userPreferencesService } from "../services/userPreferencesService";

export interface ThemeOption {
  id: string;
  primary: string;
  secondary: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "ocean",
    primary: "#1D6FDB",
    secondary: "#06B6D4",
  },
  {
    id: "sunset",
    primary: "#E05A2B",
    secondary: "#F59E0B",
  },
  {
    id: "emerald",
    primary: "#059669",
    secondary: "#14B8A6",
  },
];

const currentThemeId = ref("ocean");
let loadedForUserId: string | null = null;
let themeVersion = 0;

function applyThemeColors(theme: ThemeOption) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--color-primary", theme.primary);
  document.documentElement.style.setProperty("--color-secondary", theme.secondary);
}

export function useTheme() {
  const currentTheme = computed(
    () => THEME_OPTIONS.find((t) => t.id === currentThemeId.value) || THEME_OPTIONS[0],
  );

  async function loadTheme(userId: string) {
    if (loadedForUserId === userId) return;
    const versionAtStart = ++themeVersion;
    try {
      const prefs = await userPreferencesService.getPreferences(userId);
      if (themeVersion !== versionAtStart) return;
      const validTheme = THEME_OPTIONS.find((t) => t.id === prefs.theme);
      currentThemeId.value = validTheme ? prefs.theme : "ocean";
      applyThemeColors(currentTheme.value);
      loadedForUserId = userId;
    } catch {
      if (themeVersion !== versionAtStart) return;
      currentThemeId.value = "ocean";
      applyThemeColors(THEME_OPTIONS[0]);
    }
  }

  async function setTheme(userId: string, themeId: string) {
    const theme = THEME_OPTIONS.find((t) => t.id === themeId);
    if (!theme) return;

    const previousThemeId = currentThemeId.value;
    themeVersion++;
    loadedForUserId = userId;
    currentThemeId.value = themeId;
    applyThemeColors(theme);

    try {
      await userPreferencesService.savePreferences(userId, { theme: themeId });
    } catch {
      currentThemeId.value = previousThemeId;
      applyThemeColors(currentTheme.value);
      throw new Error("Failed to save theme preference");
    }
  }

  function previewTheme(themeId: string) {
    const theme = THEME_OPTIONS.find((t) => t.id === themeId);
    if (theme) {
      applyThemeColors(theme);
    }
  }

  function cancelPreview() {
    applyThemeColors(currentTheme.value);
  }

  function resetTheme() {
    currentThemeId.value = "ocean";
    loadedForUserId = null;
    applyThemeColors(THEME_OPTIONS[0]);
  }

  return {
    currentThemeId,
    currentTheme,
    themes: THEME_OPTIONS,
    loadTheme,
    setTheme,
    previewTheme,
    cancelPreview,
    resetTheme,
  };
}
