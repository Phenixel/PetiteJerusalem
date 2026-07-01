import HomeView from "../views/HomeView.vue";
import NotFound from "../views/NotFound.vue";

// Toutes les autres vues sont lazy-loadées : Vite génère un chunk par vue,
// le bundle initial ne contient que la home (et la 404, minuscule).
const LoginView = () => import("../views/loginView.vue");
const ProfilePage = () => import("../views/ProfilePage.vue");
const SessionManagementPage = () => import("../views/SessionManagementPage.vue");
const ShareHomePage = () => import("../views/ShareReading/ShareHomePage.vue");
const NewSession = () => import("../views/ShareReading/NewSession.vue");
const DetailSession = () => import("../views/ShareReading/DetailSession.vue");
const ChiourimPage = () => import("../views/Chiourim/ChiourimPage.vue");
const DetailChiour = () => import("../views/Chiourim/DetailChiour.vue");
const AuteurChiourimPage = () => import("../views/Chiourim/AuteurChiourimPage.vue");
const TextReadingPage = () => import("../views/TextReading/TextReadingPage.vue");
const StudyPage = () => import("../views/StudyPage.vue");
const ContentPage = () => import("../views/ContentPage.vue");
const TehilimPage = () => import("../views/TehilimPage.vue");

export default [
  {
    path: "/",
    name: "home",
    component: HomeView,
  },
  {
    path: "/login",
    name: "login",
    component: LoginView,
  },
  {
    path: "/profile",
    name: "profile",
    component: ProfilePage,
    meta: { requiresAuth: true },
  },
  {
    path: "/session-management/:id",
    name: "session-management",
    component: SessionManagementPage,
    meta: { requiresAuth: true },
  },
  {
    path: "/share-reading",
    name: "share-reading",
    component: ShareHomePage,
  },
  {
    path: "/share-reading/new-session",
    name: "new-session",
    component: NewSession,
  },
  {
    path: "/share-reading/session/:slug",
    name: "detail-session",
    component: DetailSession,
  },
  {
    path: "/bibliotheque",
    name: "study",
    component: StudyPage,
  },
  // Public reading pages for the whole library (Tehilim, Tanakh, Michna, Talmud):
  // the same reader as /lire, served at canonical keyword URLs and prerendered
  // for SEO (static body from src/content/etudeTexts.ts).
  {
    path: "/bibliotheque/:corpus/:slug",
    name: "etude-reading",
    component: TextReadingPage,
  },
  {
    path: "/bibliotheque/:corpus/:slug/:section",
    name: "etude-reading-section",
    component: TextReadingPage,
  },
  {
    path: "/chiourim",
    name: "chiourim",
    component: ChiourimPage,
  },
  {
    path: "/chiourim/auteur/:auteur",
    name: "auteur-chiourim",
    component: AuteurChiourimPage,
  },
  {
    path: "/chiourim/:slug",
    name: "detail-chiour",
    component: DetailChiour,
  },
  {
    path: "/lire/:textId",
    name: "text-reading",
    component: TextReadingPage,
  },
  {
    path: "/lire/:textId/:section",
    name: "text-reading-section",
    component: TextReadingPage,
  },
  // SEO landing pages, rendered from src/content/seoPages.ts (same markup the
  // prerender step serves to crawlers).
  {
    path: "/finir-le-chass",
    name: "finir-le-chass",
    component: ContentPage,
  },
  {
    path: "/partage-tehilim",
    name: "partage-tehilim",
    component: ContentPage,
  },
  // Tehilim par intention: hub + intention pages, rendered from
  // src/content/seoPages.ts (same markup the prerender step serves to crawlers).
  {
    path: "/tehilim",
    name: "tehilim-hub",
    component: TehilimPage,
  },
  {
    path: "/tehilim/:slug",
    name: "tehilim-intention",
    component: TehilimPage,
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: NotFound,
  },
];
