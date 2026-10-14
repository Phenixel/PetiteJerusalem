import { computed, ref, watchEffect } from "vue";
import { createAccountPreference } from "./createAccountPreference";
import { activeHolidayTheme } from "./useHolidayTheme";

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
 * Les couleurs de la palette du logo : l'orange et le bleu, chacun avec sa
 * version claire.
 *
 * L'orange est clair : le blanc ne s'y lit pas (2:1) et il ne s'écrit pas
 * sur le fond. Il sert donc tel quel de fond plein, avec un brun dessus
 * (`orangeOn`), et le texte orange prend la même teinte, soutenue juste assez
 * pour se lire sur le fond et sur une carte (`orangeInk`). Le bleu du logo
 * (#539EE2) est pris soutenu une fois pour toutes (#328CDC), assez pour
 * porter le blanc et se lire en encre.
 */
const PALETTE = {
  orange: "#FEA547",
  orangeSoft: "#FFD09E",
  orangeInk: "#D46D01",
  orangeOn: "#3B2412",
  blue: "#328CDC",
  blueSoft: "#A9CCEB",
} as const;

/** L'orange en couleur secondaire, pour les thèmes bleu et vert. */
const ORANGE_SECONDARY = {
  secondary: PALETTE.orangeInk,
  secondaryBrand: PALETTE.orange,
  secondarySoft: PALETTE.orangeSoft,
} as const;

/**
 * Les trois thèmes, dans l'ordre où ils s'affichent. Le premier est celui
 * d'origine, « sunset » : l'orange, le bleu en secondaire. Le bleu et le vert
 * restent au choix, avec l'orange en secondaire.
 *
 * Essais écartés pour l'orange : le vermillon d'origine (#DE4F17), qui tirait
 * au rouge, et l'orange du logo soutenu pour le blanc (#D96507), qui tirait au
 * brun. Tenu par src/__tests__/themeColors.test.ts.
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

const DEFAULT_THEME = THEME_OPTIONS[0];

function themeById(id: string): ThemeOption {
  return THEME_OPTIONS.find((t) => t.id === id) ?? DEFAULT_THEME;
}

function applyThemeColors(theme: ThemeColors) {
  if (typeof document === "undefined") return;
  const colors = resolveThemeColors(theme);
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
