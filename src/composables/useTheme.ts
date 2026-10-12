import { computed, ref, watchEffect } from "vue";
import { createAccountPreference } from "./createAccountPreference";
import { activeHolidayTheme } from "./useHolidayTheme";

/**
 * Les couleurs d'un thème, qu'il vienne d'un thème choisi ou d'une fête.
 *
 * Deux familles, la principale et la secondaire. Chacune a son **encre**
 * (`primary`, `secondary`) : le texte, les liens, les icônes, les filets, et
 * les teintes légères posées sous un texte de la même couleur. Les fonds
 * pleins (la carte du moment, les boutons, les pastilles pleines, le bouton
 * central de la barre) prennent la **teinte** (`brand`) et écrivent dessus
 * `onBrand`. Aujourd'hui la teinte est l'encre, avec du blanc dessus : les
 * deux rôles restent séparés pour qu'un thème puisse un jour poser une teinte
 * claire avec un texte sombre.
 *
 * `brandSoft` et `secondarySoft` sont les versions claires de la palette,
 * pour les fonds doux. Ce qu'un thème ne donne pas se déduit de ses encres
 * (voir `resolveThemeColors`), y compris pour un thème de fête.
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
 * Les couleurs de la palette du logo, telles que l'app les emploie. Les
 * teintes du logo (l'orange #FEA547, le bleu #539EE2) sont claires : le blanc
 * ne s'y lit pas, et elles ne s'écrivent pas sur le fond. L'app prend donc la
 * même teinte, soutenue juste assez pour porter le blanc et se lire en encre :
 * un seul orange, un seul bleu. Les versions claires de la palette servent
 * aux fonds doux.
 */
const PALETTE = {
  orange: "#D96507",
  orangeSoft: "#FFD09E",
  blue: "#328CDC",
  blueSoft: "#A9CCEB",
} as const;

/**
 * Les trois thèmes, dans l'ordre où ils s'affichent. Le premier est celui
 * d'origine, « sunset » : l'orange de la palette, le bleu en secondaire. Le
 * bleu et le vert restent au choix, avec l'orange en secondaire.
 *
 * Une couleur par famille, qui sert à la fois de fond plein sous du blanc et
 * d'encre sur le fond clair. Une première version posait la teinte claire du
 * logo en fond, avec un texte brun, et une encre plus soutenue pour le texte :
 * deux oranges se côtoyaient sur chaque écran, et l'action principale perdait
 * son autorité. Tenu par src/__tests__/themeColors.test.ts.
 */
export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "sunset",
    primary: PALETTE.orange,
    brandSoft: PALETTE.orangeSoft,
    secondary: PALETTE.blue,
    secondarySoft: PALETTE.blueSoft,
  },
  {
    id: "ocean",
    primary: PALETTE.blue,
    brandSoft: PALETTE.blueSoft,
    secondary: PALETTE.orange,
    secondarySoft: PALETTE.orangeSoft,
  },
  {
    id: "emerald",
    primary: "#059C66",
    brandSoft: "#A7DCC4",
    secondary: PALETTE.orange,
    secondarySoft: PALETTE.orangeSoft,
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
