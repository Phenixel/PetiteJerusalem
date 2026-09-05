import { ref, computed } from "vue";
import { userPreferencesService } from "../services/userPreferencesService";
import { analyticsService } from "../services/analyticsService";

export interface FontOption {
  id: string;
  /** Display name shown in the selector (rendered in the font itself). */
  label: string;
  /** CSS font-family stack applied to the whole app. */
  stack: string;
}

/**
 * Polices latines (interface), appliquées à --font-sans.
 *
 * Atkinson Hyperlegible a remplacé Inter comme police d'origine : Inter est
 * devenue la police de toutes les interfaces à la fois, et le site n'y avait
 * plus de visage ; Atkinson, dessinée pour se lire vite et de loin, a des
 * lettres qu'on reconnaît. Un compte qui avait gardé « inter » retombe sur
 * l'origine, ce qui est le choix qu'il avait fait : le sans neutre. Les
 * titres, eux, ne dépendent pas de ce réglage (--font-display, main.css).
 */
export const LATIN_FONT_OPTIONS: FontOption[] = [
  {
    id: "atkinson",
    label: "Atkinson",
    stack:
      '"Atkinson Hyperlegible Next", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
 * index.html n'embarque en bloquant que Atkinson + Bricolage + Frank Ruhl Libre
 * (+ le sous-ensemble Noto Hebrew, repli des teamim) : télécharger les 7 familles pour tous les
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

const currentLatinId = ref(DEFAULT_LATIN.id);
const currentHebrewId = ref(DEFAULT_HEBREW.id);
let loadedForUserId: string | null = null;
let fontsVersion = 0;

function applyFonts(latin: FontOption, hebrew: FontOption) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--font-sans", latin.stack);
  document.documentElement.style.setProperty("--font-hebrew", hebrew.stack);
}

/**
 * Même mesure que pour le thème (voir useTheme) : `script` sépare la police de
 * l'interface de celle de la lecture hébraïque, dont les enjeux ne sont pas
 * les mêmes (confort de lecture des textes contre goût général).
 */
function trackFontChanged(
  script: "latin" | "hebrew",
  fontId: string,
  previousFontId: string,
  scope: "account" | "device",
) {
  if (fontId === previousFontId) return;
  analyticsService.capture("font_changed", {
    script,
    font: fontId,
    previous_font: previousFontId,
    scope,
  });
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
    // Copie locale d'abord, en synchrone : les polices du compte partent en
    // téléchargement et s'appliquent dès le premier rendu, sans attendre
    // Firestore. La réponse du serveur, en dessous, confirme ou corrige.
    const cached = userPreferencesService.getCachedPreferences(userId);
    if (cached) {
      if (LATIN_FONT_OPTIONS.some((f) => f.id === cached.fontLatin)) {
        currentLatinId.value = cached.fontLatin;
      }
      if (HEBREW_FONT_OPTIONS.some((f) => f.id === cached.fontHebrew)) {
        currentHebrewId.value = cached.fontHebrew;
      }
      ensureFontLoaded(currentLatinId.value);
      ensureFontLoaded(currentHebrewId.value);
      applyFonts(currentLatin.value, currentHebrew.value);
    }
    try {
      const prefs = await userPreferencesService.getPreferences(userId);
      if (fontsVersion !== versionAtStart) return;
      currentLatinId.value = LATIN_FONT_OPTIONS.some((f) => f.id === prefs.fontLatin)
        ? prefs.fontLatin
        : DEFAULT_LATIN.id;
      currentHebrewId.value = HEBREW_FONT_OPTIONS.some((f) => f.id === prefs.fontHebrew)
        ? prefs.fontHebrew
        : DEFAULT_HEBREW.id;
      ensureFontLoaded(currentLatinId.value);
      ensureFontLoaded(currentHebrewId.value);
      applyFonts(currentLatin.value, currentHebrew.value);
      loadedForUserId = userId;
    } catch {
      if (fontsVersion !== versionAtStart) return;
      resetFonts();
    }
  }

  /**
   * Change la police latine. Sans compte (userId null : réglages de l'app
   * native), le choix est appliqué et gardé sur l'appareil seulement ; avec
   * un compte, il part chez Firestore.
   */
  async function setLatinFont(userId: string | null, fontId: string) {
    if (!LATIN_FONT_OPTIONS.some((f) => f.id === fontId)) return;
    ensureFontLoaded(fontId);
    const previous = currentLatinId.value;
    if (!userId) {
      fontsVersion++;
      loadedForUserId = null;
      currentLatinId.value = fontId;
      applyFonts(currentLatin.value, currentHebrew.value);
      userPreferencesService.saveGuestPreferences({ fontLatin: fontId });
      trackFontChanged("latin", fontId, previous, "device");
      return;
    }
    fontsVersion++;
    loadedForUserId = userId;
    currentLatinId.value = fontId;
    applyFonts(currentLatin.value, currentHebrew.value);
    try {
      await userPreferencesService.savePreferences(userId, { fontLatin: fontId });
      trackFontChanged("latin", fontId, previous, "account");
    } catch {
      currentLatinId.value = previous;
      applyFonts(currentLatin.value, currentHebrew.value);
      analyticsService.capture("font_change_failed", {
        script: "latin",
        font: fontId,
        previous_font: previous,
        scope: "account",
      });
      throw new Error("Failed to save font preference");
    }
  }

  /** Change la police hébraïque : même logique que setLatinFont. */
  async function setHebrewFont(userId: string | null, fontId: string) {
    if (!HEBREW_FONT_OPTIONS.some((f) => f.id === fontId)) return;
    ensureFontLoaded(fontId);
    const previous = currentHebrewId.value;
    if (!userId) {
      fontsVersion++;
      loadedForUserId = null;
      currentHebrewId.value = fontId;
      applyFonts(currentLatin.value, currentHebrew.value);
      userPreferencesService.saveGuestPreferences({ fontHebrew: fontId });
      trackFontChanged("hebrew", fontId, previous, "device");
      return;
    }
    fontsVersion++;
    loadedForUserId = userId;
    currentHebrewId.value = fontId;
    applyFonts(currentLatin.value, currentHebrew.value);
    try {
      await userPreferencesService.savePreferences(userId, { fontHebrew: fontId });
      trackFontChanged("hebrew", fontId, previous, "account");
    } catch {
      currentHebrewId.value = previous;
      applyFonts(currentLatin.value, currentHebrew.value);
      analyticsService.capture("font_change_failed", {
        script: "hebrew",
        font: fontId,
        previous_font: previous,
        scope: "account",
      });
      throw new Error("Failed to save font preference");
    }
  }

  /**
   * Sans compte : applique les polices gardées sur l'appareil (réglages de la
   * page profil de l'app native), ou celles d'origine s'il n'y en a pas.
   */
  function loadGuestFonts() {
    fontsVersion++;
    loadedForUserId = null;
    const guest = userPreferencesService.getGuestPreferences();
    const latin = LATIN_FONT_OPTIONS.find((f) => f.id === guest?.fontLatin) ?? DEFAULT_LATIN;
    const hebrew = HEBREW_FONT_OPTIONS.find((f) => f.id === guest?.fontHebrew) ?? DEFAULT_HEBREW;
    currentLatinId.value = latin.id;
    currentHebrewId.value = hebrew.id;
    ensureFontLoaded(latin.id);
    ensureFontLoaded(hebrew.id);
    applyFonts(latin, hebrew);
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
    loadGuestFonts,
    setLatinFont,
    setHebrewFont,
    resetFonts,
  };
}
