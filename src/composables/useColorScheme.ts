import { computed, ref, watchEffect } from "vue";
import { userPreferencesService } from "../services/userPreferencesService";
import { analyticsService } from "../services/analyticsService";

/**
 * Apparence claire ou sombre.
 *
 * L'application suivait le réglage du système, sans rien à décider. Elle en
 * fait maintenant un choix à part entière : clair, sombre, ou « comme le
 * système ». Beaucoup de téléphones basculent en sombre au coucher du soleil,
 * en pleine lecture du soir ; qui veut lire toujours sur fond clair, ou
 * toujours sur fond sombre, peut désormais le dire.
 *
 * Le choix voyage comme le thème de couleurs : sur l'appareil sans compte,
 * chez Firestore avec un compte (userPreferencesService), et c'est la classe
 * `dark` de la racine du document qui l'applique (Tailwind).
 */

export type ColorSchemeId = "light" | "dark" | "system";

export interface ColorSchemeOption {
  id: ColorSchemeId;
  /** Fond du miroir affiché dans le sélecteur. */
  background: string;
  /** Couleur des traits du miroir (texte simulé). */
  ink: string;
}

/** Dans l'ordre où le sélecteur les présente. */
export const COLOR_SCHEME_OPTIONS: ColorSchemeOption[] = [
  { id: "light", background: "#f4f1ea", ink: "#35312a" },
  { id: "dark", background: "#111827", ink: "#e5e7eb" },
  // « Système » n'a pas de couleurs à lui : son miroir montre les deux.
  { id: "system", background: "#f4f1ea", ink: "#35312a" },
];

const DEFAULT_SCHEME: ColorSchemeId = "system";

function isColorSchemeId(value: unknown): value is ColorSchemeId {
  return COLOR_SCHEME_OPTIONS.some((option) => option.id === value);
}

const currentSchemeId = ref<ColorSchemeId>(DEFAULT_SCHEME);
const systemPrefersDark = ref(false);
let loadedForUserId: string | null = null;
let schemeVersion = 0;

/** Fond sombre en ce moment ? (le choix explicite, ou le système à défaut) */
const isDark = computed(
  () =>
    currentSchemeId.value === "dark" ||
    (currentSchemeId.value === "system" && systemPrefersDark.value),
);

function initSystemPreference(): void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  systemPrefersDark.value = query.matches;
  query.addEventListener("change", (event) => {
    systemPrefersDark.value = event.matches;
    // Bascule du système EN COURS de visite : elle ne compte que si
    // l'application le suit, c'est-à-dire hors choix explicite.
    if (currentSchemeId.value === "system") {
      trackSchemeChanged(event.matches ? "dark" : "light", "system", "system");
    }
  });
}

/**
 * Un seul événement pour les deux origines : `source` sépare la bascule du
 * système du choix fait dans les réglages, et `preference` dit lequel des
 * trois choix a été retenu (les enregistrements d'avant ce réglage n'ont ni
 * l'un ni l'autre, ils viennent tous du système).
 */
function trackSchemeChanged(
  scheme: "light" | "dark",
  source: "system" | "user",
  preference: ColorSchemeId,
  scope?: "account" | "device",
) {
  analyticsService.capture("color_scheme_changed", { scheme, source, preference, scope });
}

// La classe `dark` suit l'état courant, sans qu'aucun composant n'ait à le
// demander : le module est chargé par App.vue, l'apparence est donc posée
// avant le premier rendu et corrigée à chaque changement.
watchEffect(() => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", isDark.value);
});

initSystemPreference();

export function useDarkMode() {
  return { isDark };
}

export function useColorScheme() {
  /**
   * Change l'apparence. Sans compte (userId null), le choix est gardé sur
   * l'appareil ; avec un compte, il part chez Firestore et suit l'utilisateur.
   */
  async function setColorScheme(userId: string | null, schemeId: string) {
    if (!isColorSchemeId(schemeId) || schemeId === currentSchemeId.value) return;
    const previous = currentSchemeId.value;

    schemeVersion++;
    loadedForUserId = userId;
    currentSchemeId.value = schemeId;

    if (!userId) {
      loadedForUserId = null;
      userPreferencesService.saveGuestPreferences({ colorScheme: schemeId });
      trackSchemeChanged(isDark.value ? "dark" : "light", "user", schemeId, "device");
      return;
    }

    try {
      await userPreferencesService.savePreferences(userId, { colorScheme: schemeId });
      trackSchemeChanged(isDark.value ? "dark" : "light", "user", schemeId, "account");
    } catch {
      currentSchemeId.value = previous;
      // L'écran redevient ce qu'il était sous les yeux de l'utilisateur :
      // sans cet événement, l'écart entre l'apparence choisie et celle que
      // porte le compte resterait invisible (même mesure que le thème).
      analyticsService.capture("color_scheme_change_failed", {
        preference: schemeId,
        previous_preference: previous,
        scope: "account",
      });
      throw new Error("Failed to save color scheme preference");
    }
  }

  return { currentSchemeId, schemes: COLOR_SCHEME_OPTIONS, isDark, setColorScheme };
}

/** Apparence du compte : copie locale d'abord, réponse du serveur ensuite (voir useTheme). */
export async function loadColorScheme(userId: string): Promise<void> {
  if (loadedForUserId === userId) return;
  const versionAtStart = ++schemeVersion;
  const cached = userPreferencesService.getCachedPreferences(userId);
  if (cached && isColorSchemeId(cached.colorScheme)) {
    currentSchemeId.value = cached.colorScheme;
  }
  try {
    const prefs = await userPreferencesService.getPreferences(userId);
    if (schemeVersion !== versionAtStart) return;
    currentSchemeId.value = isColorSchemeId(prefs.colorScheme) ? prefs.colorScheme : DEFAULT_SCHEME;
    loadedForUserId = userId;
  } catch {
    if (schemeVersion !== versionAtStart) return;
    currentSchemeId.value = DEFAULT_SCHEME;
  }
}

/** Sans compte : l'apparence gardée sur l'appareil, ou le suivi du système. */
export function loadGuestColorScheme(): void {
  schemeVersion++;
  loadedForUserId = null;
  const guest = userPreferencesService.getGuestPreferences();
  currentSchemeId.value = isColorSchemeId(guest?.colorScheme) ? guest.colorScheme : DEFAULT_SCHEME;
}
