import { createRouter, createWebHistory } from "vue-router";
import routes from "./routes";
import { authService } from "../services/authService";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // Reset scroll to top on navigation; restore the saved position on back/forward.
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    return { top: 0 };
  },
});

// Les routes marquées requiresAuth redirigent vers /login AVANT le montage de
// la vue (pas de flash de contenu protégé), en conservant la destination.
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true;
  const user = await authService.getCurrentUser();
  if (user) return true;
  return { path: "/login", query: { redirect: to.fullPath } };
});

export default router;
