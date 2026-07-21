import { ref, computed } from "vue";
import { authService } from "../services/authService";
import { userPreferencesService } from "../services/userPreferencesService";

/**
 * Marqueur « Vu » des chiourim, pour les utilisateurs connectés uniquement.
 *
 * État module-singleton : la liste des slugs déjà vus est chargée une fois à
 * la connexion (depuis userPreferences.viewedChiourim) et partagée par tous
 * les composants (cartes, page détail). Pour un visiteur non connecté, tout
 * est inerte : isViewed renvoie false et markViewed ne fait rien.
 */

const viewedSlugs = ref<Set<string>>(new Set());
const userId = ref<string | null>(null);
// Vrai une fois l'état connu (déconnecté, ou préférences chargées) : permet
// aux vues d'attendre avant de lire isViewed, sans course au premier rendu.
const isLoaded = ref(false);
let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;
  authService.onAuthChanged(async (user) => {
    userId.value = user?.id ?? null;
    if (!user) {
      viewedSlugs.value = new Set();
      isLoaded.value = true;
      return;
    }
    isLoaded.value = false;
    try {
      const prefs = await userPreferencesService.getPreferences(user.id);
      viewedSlugs.value = new Set(prefs.viewedChiourim ?? []);
    } catch {
      // Préférences illisibles (hors ligne…) : le marqueur restera vide.
    } finally {
      isLoaded.value = true;
    }
  });
}

export function useViewedChiourim() {
  init();

  const isLoggedIn = computed(() => userId.value !== null);

  function isViewed(slug: string): boolean {
    return viewedSlugs.value.has(slug);
  }

  /** Marque un chiour comme vu (optimiste localement, persisté en arrière-plan). */
  function markViewed(slug: string): void {
    if (!userId.value || viewedSlugs.value.has(slug)) return;
    const next = new Set(viewedSlugs.value);
    next.add(slug);
    viewedSlugs.value = next;
    userPreferencesService.markChiourViewed(userId.value, slug).catch(() => {
      // Écriture perdue (hors ligne…) : le marqueur local reste, sans gravité.
    });
  }

  return { isLoggedIn, isLoaded, isViewed, markViewed };
}
