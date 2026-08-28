import { createRouter, createWebHistory } from "vue-router";
import routes from "./routes";
import { authService } from "../services/authService";
import { isAdminEmail } from "../config/admin";
import { isNativeApp } from "../composables/useNativeApp";
import { DEFAULT_SEO_LOCALE, isSectionPath, localeOfPath } from "../content/seoLocales";
import { applyLocale, type SupportedLocale } from "../i18n";
import { waitUntilPositionReachable } from "./scrollRestoration";

/**
 * App native : pages posées en surcouche au-dessus de la page en cours
 * (App.vue). Les horaires et le calendrier ont une adresse par langue : la
 * reconnaissance passe par la table des sections, pas par le chemin français.
 */
const isOverlayPath = (path: string) =>
  isSectionPath(path, "horaires") || isSectionPath(path, "calendrier");

// Numéro de la dernière navigation : les deux branches différées du
// scrollBehavior ne posent leur défilement que si aucune navigation n'est
// partie entre-temps (double appui rapide sur le bouton rond des horaires),
// sinon elles écraseraient la position que la plus récente vient de rendre.
let lastNavigation = 0;

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // Reset scroll to top on navigation; restore the saved position on back/forward.
  scrollBehavior(to, from, savedPosition) {
    const navigation = ++lastNavigation;
    const stale = () => navigation !== lastNavigation;

    // App native : les horaires s'ouvrent au-dessus de la page en cours
    // (transition d'App.vue) ; la remise à zéro du défilement attend la fin
    // du cercle, sinon la page d'en dessous remonterait en haut en pleine
    // animation. La surcouche est épinglée pendant ce temps, elle ne voit
    // rien du report.
    if (isNativeApp && isOverlayPath(to.path) && !isOverlayPath(from.path) && !savedPosition) {
      return new Promise((resolve) => setTimeout(() => resolve(stale() ? false : { top: 0 }), 430));
    }
    // Retour arrière : la page se remonte et son contenu arrive en asynchrone,
    // reposer la position tout de suite serait écrêté par un document encore
    // trop court (fermeture de la surcouche des horaires, notamment). On
    // attend que la page ait retrouvé sa hauteur.
    if (savedPosition) {
      return waitUntilPositionReachable(savedPosition.top).then(() =>
        stale() ? false : savedPosition,
      );
    }
    return { top: 0 };
  },
});

// Une URL préfixée (/en/…, /he/…) impose sa langue : c'est elle qui a été
// indexée, et un visiteur venu d'un moteur doit voir la page dans la langue
// qu'il a cliquée. Les adresses sans préfixe, elles, ne touchent à rien : la
// langue y reste celle choisie par le visiteur ou son navigateur.
//
// `applyLocale` la mémorise, et c'est voulu : la plus grande partie du site
// (bibliothèque, chiourim, partage de lectures) n'a qu'une adresse, sans
// préfixe. Sans mémorisation, un visiteur arrivé sur /en/shabbat-times
// retomberait en français au premier lien vers la bibliothèque, au milieu de
// sa visite. Le prix est qu'un lien anglais suivi une fois bascule toute
// l'application ; le sélecteur de langue le défait en un clic, et le retient
// de la même façon.
router.beforeEach(async (to) => {
  const locale = localeOfPath(to.path);
  // Attendu, et pas seulement lancé : les messages en et he arrivent par
  // import dynamique, et la vue pose son titre au montage. Sans l'attente,
  // une page anglaise s'ouvrirait avec un titre français.
  if (locale !== DEFAULT_SEO_LOCALE) await applyLocale(locale as SupportedLocale);
  return true;
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
