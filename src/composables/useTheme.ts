import { computed, ref, watchEffect } from "vue";
import { createAccountPreference } from "./createAccountPreference";
import { activeHolidayTheme } from "./useHolidayTheme";
import { isDark } from "./useColorScheme";
import { isContrastMore } from "./useContrast";

/**
 * Les couleurs d'un thème, qu'il vienne d'un thème choisi ou d'une fête.
 *
 * Deux familles, la principale et la secondaire, et dans chacune deux
 * rôles :
 *
 * - l'**encre** (`primary`, `secondary`) : le texte, les liens, les icônes,
 *   les filets, les barres d'avancement, et les teintes légères posées sous
 *   un texte de la même couleur. Elle doit se lire sur le fond clair comme
 *   sur le fond sombre ;
 * - la **teinte** (`brand`, `secondaryBrand`) : la couleur de la palette,
 *   telle quelle, pour les fonds pleins (la carte du moment, les boutons, les
 *   pastilles pleines, le bouton central de la barre). Ce qui s'écrit dessus
 *   prend `onBrand` : une encre sombre sur une teinte claire, le blanc sur
 *   une teinte soutenue.
 *
 * `brandSoft` et `secondarySoft` sont les versions claires de la palette,
 * pour les fonds doux. Ce qu'un thème ne donne pas se déduit de ses encres
 * (voir `resolveThemeColors`) : un thème de fête ne donne que ses deux
 * encres, assez soutenues pour servir aussi de teinte sous du blanc.
 */
export interface ThemeColors {
  primary: string;
  secondary: string;
  brand?: string;
  onBrand?: string;
  brandSoft?: string;
  secondaryBrand?: string;
  secondarySoft?: string;
}

export interface ThemeOption extends ThemeColors {
  id: string;
}

/**
 * The colors of the logo's palette: orange and blue, each with its light
 * version.
 *
 * The solid orange is a pastel of the logo's family (`orange`, #EB9F4F), and
 * white is written on it (`orangeOn`). This is a deliberate exception to the
 * readability rule: white reads there on large text, not at the WCAG AA level
 * on small labels; the higher contrast mode (useContrast) is there for whoever
 * needs it. Orange text takes the deeper ink (`orangeInk`), readable on the
 * background and on a card. The logo's blue (#539EE2) is taken deepened once
 * and for all (#328CDC), enough to carry white and to read as ink.
 */
const PALETTE = {
  orange: "#EB9F4F",
  orangeSoft: "#FFD09E",
  orangeInk: "#D46D01",
  orangeOn: "#FFFFFF",
  blue: "#328CDC",
  blueSoft: "#A9CCEB",
} as const;

/** Orange as the secondary color, for the blue and green themes. */
const ORANGE_SECONDARY = {
  secondary: PALETTE.orangeInk,
  secondaryBrand: PALETTE.orange,
  secondarySoft: PALETTE.orangeSoft,
} as const;

/**
 * The three themes, in display order. The first is the original one,
 * "sunset": orange, with blue as secondary. Blue and green remain available,
 * with orange as secondary.
 *
 * Rejected attempts for the orange: the original vermilion (#DE4F17), which
 * leaned red; the logo's orange deepened for white (#D96507), which leaned
 * brown; brighter oranges between the two (#E65D00); the light logo orange
 * with brown text (#FEA547), which made the app dull. Held by
 * src/__tests__/themeColors.test.ts.
 */
export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "sunset",
    primary: PALETTE.orangeInk,
    brand: PALETTE.orange,
    onBrand: PALETTE.orangeOn,
    brandSoft: PALETTE.orangeSoft,
    secondary: PALETTE.blue,
    secondarySoft: PALETTE.blueSoft,
  },
  {
    id: "ocean",
    primary: PALETTE.blue,
    brandSoft: PALETTE.blueSoft,
    ...ORANGE_SECONDARY,
  },
  {
    id: "emerald",
    primary: "#059C66",
    brandSoft: "#A7DCC4",
    ...ORANGE_SECONDARY,
  },
];

/** Une couleur mêlée de blanc, pour la version claire d'une teinte de fête. */
function lighten(hex: string, amount: number): string {
  const channel = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[1, 3, 5].map((i) => mix(channel(i)).toString(16).padStart(2, "0")).join("")}`;
}

/** Toutes les couleurs d'un thème : celles qu'il donne, et celles qui s'en déduisent. */
export function resolveThemeColors(theme: ThemeColors): Required<ThemeColors> {
  return {
    primary: theme.primary,
    secondary: theme.secondary,
    brand: theme.brand ?? theme.primary,
    onBrand: theme.onBrand ?? "#FFFFFF",
    brandSoft: theme.brandSoft ?? lighten(theme.primary, 0.6),
    secondaryBrand: theme.secondaryBrand ?? theme.secondary,
    secondarySoft: theme.secondarySoft ?? lighten(theme.secondary, 0.6),
  };
}

/** WCAG relative luminance of a #rrggbb color. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two #rrggbb colors. */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** A color mixed with another, `amount` being the share of the other. */
function mixWith(hex: string, other: string, amount: number): string {
  const channel = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  return `#${[1, 3, 5]
    .map((i) => Math.round(channel(hex, i) * (1 - amount) + channel(other, i) * amount))
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

/** The WCAG AA level for regular-size text. */
export const AA_TEXT = 4.5;
/** The dark text of the higher contrast mode on a light solid fill. */
const DARK_ON_BRAND = "#3B2412";
const LIGHT_BACKGROUND = "#FFF9F3";
/** The dark surface (a card), lighter than the dark background: the harder of the two. */
const DARK_SURFACE = "#1F2937";

/** Moves a color toward `toward` until it reaches `target` against `against`. */
function pushUntil(hex: string, toward: string, against: string, target: number): string {
  let color = hex;
  for (let amount = 0.04; contrastRatio(color, against) < target && amount <= 1; amount += 0.04) {
    color = mixWith(hex, toward, amount);
  }
  return color;
}

/**
 * The colors of the higher contrast mode (see useContrast): every role at the
 * WCAG AA level. On the solid fill, the more readable of white and the dark
 * text, and if neither reaches 4.5:1, the fill deepens under white. The inks
 * deepen on the light background, and lighten on the dark one.
 */
export function strengthenThemeColors(
  colors: Required<ThemeColors>,
  dark: boolean,
): Required<ThemeColors> {
  const onBrand =
    contrastRatio(colors.brand, "#FFFFFF") >= contrastRatio(colors.brand, DARK_ON_BRAND)
      ? "#FFFFFF"
      : DARK_ON_BRAND;
  const solid =
    contrastRatio(colors.brand, onBrand) >= AA_TEXT
      ? { brand: colors.brand, onBrand }
      : { brand: pushUntil(colors.brand, "#000000", "#FFFFFF", AA_TEXT), onBrand: "#FFFFFF" };
  const ink = (hex: string) =>
    dark
      ? pushUntil(hex, "#FFFFFF", DARK_SURFACE, AA_TEXT)
      : pushUntil(hex, "#000000", LIGHT_BACKGROUND, AA_TEXT);
  return {
    ...colors,
    ...solid,
    primary: ink(colors.primary),
    secondary: ink(colors.secondary),
  };
}

const DEFAULT_THEME = THEME_OPTIONS[0];

function themeById(id: string): ThemeOption {
  return THEME_OPTIONS.find((t) => t.id === id) ?? DEFAULT_THEME;
}

function applyThemeColors(theme: ThemeColors, contrastMore: boolean, dark: boolean) {
  if (typeof document === "undefined") return;
  const resolved = resolveThemeColors(theme);
  const colors = contrastMore ? strengthenThemeColors(resolved, dark) : resolved;
  const style = document.documentElement.style;
  style.setProperty("--color-primary", colors.primary);
  style.setProperty("--color-secondary", colors.secondary);
  style.setProperty("--color-brand", colors.brand);
  style.setProperty("--color-on-brand", colors.onBrand);
  style.setProperty("--color-brand-soft", colors.brandSoft);
  style.setProperty("--color-secondary-brand", colors.secondaryBrand);
  style.setProperty("--color-secondary-soft", colors.secondarySoft);
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

// The colors on screen, in order: the hovered preview, then the holiday's
// theme, then the chosen theme, strengthened in the higher contrast mode.
// Synchronous: the account's theme, served by its local copy, holds from the
// first render (see createAccountPreference).
watchEffect(
  () => applyThemeColors(previewed.value ?? appliedTheme.value, isContrastMore.value, isDark.value),
  { flush: "sync" },
);

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
