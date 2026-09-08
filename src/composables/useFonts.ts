import { computed } from "vue";
import { createAccountPreference } from "./createAccountPreference";

export interface FontOption {
  id: string;
  /** Display name shown in the selector (rendered in the font itself). */
  label: string;
  /** CSS font-family stack applied to the whole app. */
  stack: string;
}

/** Latin (UI) fonts, applied to --font-sans. */
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

/**
 * Hebrew (reading) fonts, applied to --font-hebrew.
 *
 * Aucune des trois ne dessine les teamim : chaque pile intercale donc sa
 * famille « Noto Teamim … », le sous-ensemble hébreu de Noto Serif Hebrew
 * embarqué et ramené par size-adjust à la taille de la police principale
 * (voir main.css), pour que les mots cantilés gardent le même corps que le
 * reste du verset.
 */
export const HEBREW_FONT_OPTIONS: FontOption[] = [
  {
    id: "frank",
    label: "Frank Ruhl Libre",
    stack:
      '"Frank Ruhl Libre", "Noto Teamim Frank", "Noto Serif Hebrew", "David Libre", Georgia, serif',
  },
  {
    id: "david",
    label: "David Libre",
    stack:
      '"David Libre", "Noto Teamim David", "Noto Serif Hebrew", "Frank Ruhl Libre", Georgia, serif',
  },
  {
    id: "heebo",
    label: "Heebo",
    stack:
      '"Heebo", "Noto Teamim Heebo", "Noto Serif Hebrew", "Arial Hebrew", -apple-system, sans-serif',
  },
];

const DEFAULT_LATIN = LATIN_FONT_OPTIONS[0];
const DEFAULT_HEBREW = HEBREW_FONT_OPTIONS[0];

/**
 * Chargement à la demande des familles NON par défaut.
 *
 * index.html n'embarque en bloquant que Inter + Frank Ruhl Libre (+ le sous-ensemble Noto
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

function applyFont(cssVar: "--font-sans" | "--font-hebrew", options: FontOption[], id: string) {
  ensureFontLoaded(id);
  if (typeof document === "undefined") return;
  const font = options.find((f) => f.id === id) ?? options[0];
  document.documentElement.style.setProperty(cssVar, font.stack);
}

/**
 * Même mesure que pour le thème (voir useTheme) : `script` sépare la police de
 * l'interface de celle de la lecture hébraïque, dont les enjeux ne sont pas
 * les mêmes (confort de lecture des textes contre goût général).
 */
function fontPreference(
  script: "latin" | "hebrew",
  field: "fontLatin" | "fontHebrew",
  cssVar: "--font-sans" | "--font-hebrew",
  options: FontOption[],
) {
  return createAccountPreference<string>({
    field,
    defaultValue: options[0].id,
    isValid: (value): value is string => options.some((f) => f.id === value),
    apply: (id) => applyFont(cssVar, options, id),
    eventName: "font_changed",
    eventProps: (id, previous, scope) => ({ script, font: id, previous_font: previous, scope }),
    failedEventName: "font_change_failed",
    failedEventProps: (id, previous) => ({
      script,
      font: id,
      previous_font: previous,
      scope: "account",
    }),
  });
}

const latin = fontPreference("latin", "fontLatin", "--font-sans", LATIN_FONT_OPTIONS);
const hebrew = fontPreference("hebrew", "fontHebrew", "--font-hebrew", HEBREW_FONT_OPTIONS);

const currentLatinId = latin.current;
const currentHebrewId = hebrew.current;

export function useFonts() {
  const currentLatin = computed(
    () => LATIN_FONT_OPTIONS.find((f) => f.id === currentLatinId.value) || DEFAULT_LATIN,
  );
  const currentHebrew = computed(
    () => HEBREW_FONT_OPTIONS.find((f) => f.id === currentHebrewId.value) || DEFAULT_HEBREW,
  );

  // Les deux polices lisent le même document : getPreferences partage la
  // requête en vol, une seule lecture Firestore pour les deux.
  async function loadFonts(userId: string) {
    await Promise.all([latin.loadForUser(userId), hebrew.loadForUser(userId)]);
  }

  function loadGuestFonts() {
    latin.loadForGuest();
    hebrew.loadForGuest();
  }

  function resetFonts() {
    latin.reset();
    hebrew.reset();
  }

  return {
    currentLatinId,
    currentHebrewId,
    currentLatin,
    currentHebrew,
    latinFonts: LATIN_FONT_OPTIONS,
    hebrewFonts: HEBREW_FONT_OPTIONS,
    loadFonts,
    loadGuestFonts,
    setLatinFont: latin.set,
    setHebrewFont: hebrew.set,
    resetFonts,
  };
}
