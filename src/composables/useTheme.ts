import { computed } from "vue";
import { createAccountPreference } from "./createAccountPreference";

export interface ThemeOption {
  id: string;
  primary: string;
  secondary: string;
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

function applyThemeColors(theme: ThemeOption) {
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
  apply: (id) => applyThemeColors(themeById(id)),
  eventName: "theme_changed",
  eventProps: (id, previous, scope) => ({ theme: id, previous_theme: previous, scope }),
  failedEventName: "theme_change_failed",
  failedEventProps: (id, previous) => ({ theme: id, previous_theme: previous, scope: "account" }),
});

const currentThemeId = theme.current;

export function useTheme() {
  const currentTheme = computed(() => themeById(currentThemeId.value));

  function previewTheme(themeId: string) {
    const option = THEME_OPTIONS.find((t) => t.id === themeId);
    if (option) applyThemeColors(option);
  }

  function cancelPreview() {
    applyThemeColors(currentTheme.value);
  }

  return {
    currentThemeId,
    currentTheme,
    themes: THEME_OPTIONS,
    loadTheme: theme.loadForUser,
    loadGuestTheme: theme.loadForGuest,
    setTheme: theme.set,
    previewTheme,
    cancelPreview,
    resetTheme: theme.reset,
  };
}
