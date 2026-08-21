import { createRouter, createWebHistory } from "vue-router";
import routes from "./routes";
import { authService } from "../services/authService";
import { isAdminEmail } from "../config/admin";
import { isNativeApp } from "../composables/useNativeApp";

/** App native : pages posées en surcouche au-dessus de la page en cours (App.vue). */
const isOverlayPath = (path: string) => /^\/(horaires|calendrier)/.test(path);

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // Reset scroll to top on navigation; restore the saved position on back/forward.
  scrollBehavior(to, from, savedPosition) {
    // App native : les horaires s'ouvrent au-dessus de la page en cours
    // (transition d'App.vue) ; la remise à zéro du défilement attend la fin
    // du cercle, sinon la page d'en dessous remonterait en haut en pleine
    // animation. La surcouche est épinglée pendant ce temps, elle ne voit
    // rien du report.
    if (isNativeApp && isOverlayPath(to.path) && !isOverlayPath(from.path) && !savedPosition) {
      return new Promise((resolve) => setTimeout(() => resolve({ top: 0 }), 430));
    }
    if (savedPosition) return savedPosition;
    return { top: 0 };
  },
});

// Les routes marquées requiresAuth redirigent vers /login AVANT le montage de
// la vue (pas de flash de contenu protégé), en conservant la destination.
// requiresAdmin est une garde UX (miroir client des rules) : la sécurité
// réelle des écritures reste appliquée par les règles Firestore/Storage.
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true;
  const user = await authService.getCurrentUser();
  if (!user) return { path: "/login", query: { redirect: to.fullPath } };
  if (to.meta.requiresAdmin && !isAdminEmail(user.email)) return { path: "/" };
  return true;
});

export default router;
