import { computed, ref, watchEffect } from "vue";
import { createAccountPreference } from "./createAccountPreference";
import { activeHolidayTheme } from "./useHolidayTheme";

/** Un duo de couleurs, qu'il vienne d'un thème choisi ou d'une fête. */
export interface ThemeColors {
  primary: string;
  secondary: string;
}

export interface ThemeOption extends ThemeColors {
  id: string;
}

/**
 * Les trois duos de couleurs, dans l'ordre où ils s'affichent. Le premier est
 * celui d'origine : « sunset », le vermillon de la pierre de Jérusalem au
 * soleil couchant. Il tient la maison, le bleu et le vert restent au choix.
 *
 * Chaque duo est franc : la couleur se pose à plat, jamais en dégradé (voir
 * docs/design.md). Le `primary` sert aussi bien de fond sous du blanc que
 * d'encre sur le beige : il est donc pris assez soutenu pour rester lisible
 * dans les deux sens, et le `secondary` l'accompagne d'un demi-ton plus loin
 * sur la roue, pour les puces et les illustrations.
 */
export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "sunset",
    primary: "#DE4F17",
    secondary: "#C98A00",
  },
  {
    id: "ocean",
    primary: "#1E6BF0",
    secondary: "#0891B2",
  },
  {
    id: "emerald",
    primary: "#059C66",
    secondary: "#0D9488",
  },
];

const DEFAULT_THEME = THEME_OPTIONS[0];

function themeById(id: string): ThemeOption {
  return THEME_OPTIONS.find((t) => t.id === id) ?? DEFAULT_THEME;
}

function applyThemeColors(theme: ThemeColors) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--color-primary", theme.primary);
  document.documentElement.style.setProperty("--color-secondary", theme.secondary);
}

/**
 * Le thème est le premier réglage que l'on touche, et il n'était pas mesuré
 * du tout. `scope` distingue le choix gardé sur l'appareil (réglages sans
 * compte de l'app native) de celui qui part chez Firestore et suit
 * l'utilisateur. La mécanique (copie locale, écriture optimiste et retour en
 * arrière, réglage d'appareil) est celle de createAccountPreference.
 */
const theme = createAccountPreference<string>({
  field: "theme",
  defaultValue: DEFAULT_THEME.id,
  isValid: (value): value is string => THEME_OPTIONS.some((t) => t.id === value),
  eventName: "theme_changed",
  eventProps: (id, previous, scope) => ({ theme: id, previous_theme: previous, scope }),
  failedEventName: "theme_change_failed",
  failedEventProps: (id, previous) => ({ theme: id, previous_theme: previous, scope: "account" }),
});

const currentThemeId = theme.current;

/** Le thème choisi, celui des réglages : il reste le choix même sous une fête. */
const currentTheme = computed(() => themeById(currentThemeId.value));

/**
 * Le thème porté par l'app : la fête en cours si elle en a un (voir
 * useHolidayTheme), sinon le thème choisi. C'est lui que suivent les widgets
 * et la montre, qui portent les couleurs de l'app et non celles d'un survol.
 */
const appliedTheme = computed<ThemeColors>(() => activeHolidayTheme.value ?? currentTheme.value);

/** Les couleurs d'un thème survolé dans les réglages, le temps du survol. */
const previewed = ref<ThemeColors | null>(null);

// Les couleurs à l'écran, dans l'ordre : l'aperçu survolé, puis le thème de
// la fête, puis le thème choisi. En synchrone : le thème du compte, servi par
// sa copie locale, tient dès le premier rendu (voir createAccountPreference).
watchEffect(() => applyThemeColors(previewed.value ?? appliedTheme.value), { flush: "sync" });

export function useTheme() {
  function previewTheme(themeId: string) {
    const option = THEME_OPTIONS.find((t) => t.id === themeId);
    if (option) previewed.value = option;
  }

  function cancelPreview() {
    previewed.value = null;
  }

  return {
    currentThemeId,
    currentTheme,
    appliedTheme,
    themes: THEME_OPTIONS,
    loadTheme: theme.loadForUser,
    loadGuestTheme: theme.loadForGuest,
    setTheme: theme.set,
    previewTheme,
    cancelPreview,
    resetTheme: theme.reset,
  };
}
