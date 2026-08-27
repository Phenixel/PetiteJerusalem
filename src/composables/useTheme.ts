import { ref, computed } from "vue";
import { userPreferencesService } from "../services/userPreferencesService";
import { analyticsService } from "../services/analyticsService";

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

/**
 * Changement d'apparence : le thème est le premier réglage que l'on touche,
 * et il n'était pas mesuré du tout. `scope` distingue le choix gardé sur
 * l'appareil (réglages sans compte de l'app native) de celui qui part chez
 * Firestore et suit l'utilisateur.
 */
function trackThemeChanged(themeId: string, previousThemeId: string, scope: "account" | "device") {
  if (themeId === previousThemeId) return;
  analyticsService.capture("theme_changed", {
    theme: themeId,
    previous_theme: previousThemeId,
    scope,
  });
}

export function useTheme() {
  const currentTheme = computed(
    () => THEME_OPTIONS.find((t) => t.id === currentThemeId.value) || THEME_OPTIONS[0],
  );

  async function loadTheme(userId: string) {
    if (loadedForUserId === userId) return;
    const versionAtStart = ++themeVersion;
    // Copie locale d'abord, en synchrone : les couleurs du compte tiennent
    // dès le premier rendu au lieu d'arriver quelques secondes plus tard
    // (chargement de Firestore puis aller-retour réseau). La réponse du
    // serveur, en dessous, confirme ou corrige.
    const cached = userPreferencesService.getCachedPreferences(userId);
    const cachedTheme = cached && THEME_OPTIONS.find((t) => t.id === cached.theme);
    if (cachedTheme) {
      currentThemeId.value = cachedTheme.id;
      applyThemeColors(cachedTheme);
    }
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

  /**
   * Change le thème. Sans compte (userId null : réglages de l'app native), le
   * choix est appliqué et gardé sur l'appareil seulement ; avec un compte, il
   * part chez Firestore et suit l'utilisateur sur ses appareils.
   */
  async function setTheme(userId: string | null, themeId: string) {
    const theme = THEME_OPTIONS.find((t) => t.id === themeId);
    if (!theme) return;

    const previousThemeId = currentThemeId.value;

    if (!userId) {
      themeVersion++;
      loadedForUserId = null;
      currentThemeId.value = themeId;
      applyThemeColors(theme);
      userPreferencesService.saveGuestPreferences({ theme: themeId });
      trackThemeChanged(themeId, previousThemeId, "device");
      return;
    }

    themeVersion++;
    loadedForUserId = userId;
    currentThemeId.value = themeId;
    applyThemeColors(theme);

    try {
      await userPreferencesService.savePreferences(userId, { theme: themeId });
      trackThemeChanged(themeId, previousThemeId, "account");
    } catch {
      currentThemeId.value = previousThemeId;
      applyThemeColors(currentTheme.value);
      // Le thème revient à sa valeur d'avant sous les yeux de l'utilisateur :
      // sans cet événement, l'écart entre « thème choisi » et « thème
      // réellement porté par le compte » resterait invisible.
      analyticsService.capture("theme_change_failed", {
        theme: themeId,
        previous_theme: previousThemeId,
        scope: "account",
      });
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

  /**
   * Sans compte : applique le thème gardé sur l'appareil (réglages de la page
   * profil de l'app native), ou le thème d'origine s'il n'y en a pas.
   */
  function loadGuestTheme() {
    themeVersion++;
    loadedForUserId = null;
    const guest = userPreferencesService.getGuestPreferences();
    const theme = THEME_OPTIONS.find((t) => t.id === guest?.theme) ?? THEME_OPTIONS[0];
    currentThemeId.value = theme.id;
    applyThemeColors(theme);
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
    loadGuestTheme,
    setTheme,
    previewTheme,
    cancelPreview,
    resetTheme,
  };
}
