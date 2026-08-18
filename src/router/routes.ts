import HomeView from "../views/HomeView.vue";
import NotFound from "../views/NotFound.vue";
import { isNativeApp } from "../composables/useNativeApp";

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
const SerieChiourimPage = () => import("../views/Chiourim/SerieChiourimPage.vue");
const TextReadingPage = () => import("../views/TextReading/TextReadingPage.vue");
const StudyPage = () => import("../views/StudyPage.vue");
const DailyReadingPage = () => import("../views/Library/DailyReadingPage.vue");
const ChneiMikraPage = () => import("../views/Library/ChneiMikraPage.vue");
const ContentPage = () => import("../views/ContentPage.vue");
const ZmanimPage = () => import("../views/Zmanim/ZmanimPage.vue");
const TehilimPage = () => import("../views/TehilimPage.vue");
const StudioPage = () => import("../views/Studio/StudioPage.vue");
const AdminLayout = () => import("../views/Admin/AdminLayout.vue");
const AdminChiourimPage = () => import("../views/Admin/AdminChiourimPage.vue");
const AdminChiourEditPage = () => import("../views/Admin/AdminChiourEditPage.vue");
const AdminAuteursPage = () => import("../views/Admin/AdminAuteursPage.vue");
const AdminAuteurDetailPage = () => import("../views/Admin/AdminAuteurDetailPage.vue");
const AdminSessionsPage = () => import("../views/Admin/AdminSessionsPage.vue");

export default [
  {
    path: "/",
    name: "home",
    meta: { offlineOk: true },
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
    meta: { offlineOk: true },
    component: StudyPage,
  },
  // Lecture quotidienne : déplacée du profil vers la bibliothèque (elle vit à
  // côté des textes qu'elle fait lire). Route statique, prioritaire sur
  // /bibliotheque/:corpus ci-dessous.
  // Dans l'app native, la lecture du jour se lit sans connexion : les textes
  // téléchargés viennent de l'appareil et la liste est relue de sa copie
  // locale (la page passe alors en lecture seule). Sur le web il n'y a rien
  // de téléchargé : la page a besoin du réseau, comme avant.
  {
    path: "/bibliotheque/lecture-du-jour",
    name: "daily-reading",
    component: DailyReadingPage,
    meta: { requiresAuth: true, offlineOk: isNativeApp, plainBackground: true },
  },
  // Chnei mikra : la paracha de la semaine avec son Targoum, ouverte à tous.
  // La semaine se choisit en query (`?semaine=2026-08-15`) plutôt qu'en
  // segment, qui se confondrait avec /bibliotheque/:corpus/:slug.
  // Tout est calculé sur l'appareil (hebcal) et les textes sont embarqués dans
  // l'app native : la page a sa place parmi les `offlineOk`.
  {
    path: "/bibliotheque/chnei-mikra",
    name: "chnei-mikra",
    meta: { offlineOk: true, plainBackground: true },
    component: ChneiMikraPage,
  },
  // Détail d'un corpus de la bibliothèque (liste des textes) : la page
  // d'accueil de la bibliothèque ne montre que les grandes sections.
  {
    path: "/bibliotheque/:corpus(tehilim|michna|talmud|tanakh|slihot|brahot)",
    name: "study-corpus",
    meta: { offlineOk: true },
    component: StudyPage,
  },
  // L'ancienne page « Hors ligne » a été fusionnée dans la bibliothèque
  // (boutons de téléchargement sur chaque carte + « Tout télécharger »).
  {
    path: "/telechargements",
    redirect: "/bibliotheque",
  },
  // Public reading pages for the whole library (Tehilim, Tanakh, Michna, Talmud):
  // the same reader as /lire, served at canonical keyword URLs and prerendered
  // for SEO (static body from src/content/etudeTexts.ts).
  {
    path: "/bibliotheque/:corpus/:slug",
    name: "etude-reading",
    meta: { offlineOk: true, plainBackground: true },
    component: TextReadingPage,
  },
  {
    path: "/bibliotheque/:corpus/:slug/:section",
    name: "etude-reading-section",
    meta: { offlineOk: true, plainBackground: true },
    component: TextReadingPage,
  },
  // Horaires (zmanim) : tout est calculé sur l'appareil, aucune donnée à
  // charger — la page a donc sa place parmi les `offlineOk`, qui n'affichent
  // pas l'écran « hors ligne » quand le réseau manque.
  {
    path: "/horaires",
    name: "zmanim",
    meta: { offlineOk: true },
    component: ZmanimPage,
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
    path: "/chiourim/serie/:serieId",
    name: "serie-chiourim",
    component: SerieChiourimPage,
  },
  {
    path: "/chiourim/:slug",
    name: "detail-chiour",
    component: DetailChiour,
  },
  // Studio auteurs : accès par lien secret distribué par l'admin (pas de
  // compte). Page volontairement absente de toute navigation, et noindex.
  {
    path: "/studio/:token",
    name: "studio",
    component: StudioPage,
  },
  // Backoffice admin (web uniquement, hors navigation) : réservé au compte
  // admin. La garde requiresAdmin est UX ; les rules font la vraie sécurité.
  {
    path: "/admin",
    component: AdminLayout,
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: "", redirect: "/admin/chiourim" },
      { path: "chiourim", name: "admin-chiourim", component: AdminChiourimPage },
      { path: "chiourim/:slug", name: "admin-chiour-edit", component: AdminChiourEditPage },
      { path: "auteurs", name: "admin-auteurs", component: AdminAuteursPage },
      { path: "auteurs/:auteurId", name: "admin-auteur-detail", component: AdminAuteurDetailPage },
      // Modération des sessions signalées (exigence App Store 1.2).
      { path: "sessions", name: "admin-sessions", component: AdminSessionsPage },
    ],
  },
  {
    path: "/lire/:textId",
    name: "text-reading",
    meta: { offlineOk: true, plainBackground: true },
    component: TextReadingPage,
  },
  {
    path: "/lire/:textId/:section",
    name: "text-reading-section",
    meta: { offlineOk: true, plainBackground: true },
    component: TextReadingPage,
  },
  // SEO landing pages, rendered from src/content/seoPages.ts (same markup the
  // prerender step serves to crawlers).
  {
    path: "/finir-le-chass",
    name: "finir-le-chass",
    meta: { offlineOk: true },
    component: ContentPage,
  },
  {
    path: "/partage-tehilim",
    name: "partage-tehilim",
    meta: { offlineOk: true },
    component: ContentPage,
  },
  {
    path: "/confidentialite",
    name: "confidentialite",
    meta: { offlineOk: true },
    component: ContentPage,
  },
  {
    path: "/a-propos",
    name: "a-propos",
    meta: { offlineOk: true },
    component: ContentPage,
  },
  {
    path: "/mentions-legales",
    name: "mentions-legales",
    meta: { offlineOk: true },
    component: ContentPage,
  },
  // Conditions d'utilisation (contenu utilisateur, tolérance zéro, modération) :
  // exigées par l'App Store (règle 1.2), liées depuis le pied de page et
  // l'inscription.
  {
    path: "/conditions-utilisation",
    name: "conditions-utilisation",
    meta: { offlineOk: true },
    component: ContentPage,
  },
  // Tehilim par intention: hub + intention pages, rendered from
  // src/content/seoPages.ts (same markup the prerender step serves to crawlers).
  {
    path: "/tehilim",
    name: "tehilim-hub",
    meta: { offlineOk: true },
    component: TehilimPage,
  },
  {
    path: "/tehilim/:slug",
    name: "tehilim-intention",
    meta: { offlineOk: true },
    component: TehilimPage,
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    meta: { offlineOk: true },
    component: NotFound,
  },
];
