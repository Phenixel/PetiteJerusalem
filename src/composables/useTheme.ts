import { ref, computed, watch } from "vue";
import { userPreferencesService } from "../services/userPreferencesService";
import { analyticsService } from "../services/analyticsService";
import { useDarkMode } from "./useColorScheme";

/**
 * Un thème, c'est une couleur dominante (boutons, liens, ce qui est actif)
 * et un accent qui lui répond (séries, illustrations, quelques étiquettes).
 * Deux couleurs qui se distinguent franchement, jamais deux voisines qu'on
 * fondrait l'une dans l'autre : le site n'a plus de dégradé.
 *
 * Chaque couleur a sa version pour le fond sombre (`dark`) : une encre qui
 * tient sur le papier clair s'éteint sur la nuit, il lui faut un cran de
 * lumière en plus pour rester lisible.
 */
export interface ThemeColors {
  primary: string;
  secondary: string;
}

export interface ThemeColors {
  /** La dominante : boutons, liens, ce qui est actif. */
  primary: string;
  /** Le soleil : surligneur, étiquettes, accents des illustrations. */
  secondary: string;
  /** La couleur qui répond à la dominante : la deuxième tuile de l'accueil. */
  tertiary: string;
}

export interface ThemeOption extends ThemeColors {
  id: string;
  /** Les mêmes rôles, pour le fond sombre : plus clairs, pour rester lisibles. */
  dark: ThemeColors;
}

/**
 * Trois thèmes, trois dominantes franches : le cobalt du tekhelet, le rouge
 * de la grenade, le vert de l'olivier. Le soleil est le même pour tous. Les
 * identifiants ne bougent pas, ce sont eux que les comptes ont gardés.
 */
export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "ocean",
    primary: "#2A55C9",
    secondary: "#F4B63B",
    tertiary: "#E4542F",
    dark: { primary: "#7F9BFF", secondary: "#FFC94D", tertiary: "#FF8A66" },
  },
  {
    id: "sunset",
    primary: "#E4542F",
    secondary: "#F4B63B",
    tertiary: "#2A55C9",
    dark: { primary: "#FF8A66", secondary: "#FFC94D", tertiary: "#7F9BFF" },
  },
  {
    id: "emerald",
    primary: "#1F8A5B",
    secondary: "#F4B63B",
    tertiary: "#E4542F",
    dark: { primary: "#5CCB97", secondary: "#FFC94D", tertiary: "#FF8A66" },
  },
];

const currentThemeId = ref("ocean");
let loadedForUserId: string | null = null;
let themeVersion = 0;

const { isDark } = useDarkMode();

/** Les couleurs d'un thème pour l'apparence en cours (clair ou sombre). */
export function themeColorsFor(theme: ThemeOption, dark = isDark.value): ThemeColors {
  return dark ? theme.dark : theme;
}

// Ce qui est posé sur la page en ce moment : le thème choisi, ou celui que
// l'on survole dans les réglages. Reposé tel quel quand l'apparence bascule.
let appliedTheme: ThemeOption = THEME_OPTIONS[0];

function applyThemeColors(theme: ThemeOption) {
  appliedTheme = theme;
  if (typeof document === "undefined") return;
  const colors = themeColorsFor(theme);
  const root = document.documentElement.style;
  root.setProperty("--color-primary", colors.primary);
  root.setProperty("--color-secondary", colors.secondary);
  root.setProperty("--color-tertiary", colors.tertiary);
  root.setProperty("--color-sun", colors.secondary);
}

// Bascule clair/sombre (réglage, ou système qui suit le soleil) : les mêmes
// couleurs, dans leur version pour ce fond.
watch(isDark, () => applyThemeColors(appliedTheme));

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
