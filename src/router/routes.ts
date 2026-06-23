import HomeView from "../views/HomeView.vue";
import LoginView from "../views/loginView.vue";
import ProfilePage from "../views/ProfilePage.vue";
import SessionManagementPage from "../views/SessionManagementPage.vue";
import ShareHomePage from "../views/ShareReading/ShareHomePage.vue";
import NewSession from "../views/ShareReading/NewSession.vue";
import DetailSession from "../views/ShareReading/DetailSession.vue";
import ChiourimPage from "../views/Chiourim/ChiourimPage.vue";
import DetailChiour from "../views/Chiourim/DetailChiour.vue";
import AuteurChiourimPage from "../views/Chiourim/AuteurChiourimPage.vue";
import NotFound from "../views/NotFound.vue";
import TextReadingPage from "../views/TextReading/TextReadingPage.vue";
import StudyPage from "../views/StudyPage.vue";
import ContentPage from "../views/ContentPage.vue";
import TehilimPage from "../views/TehilimPage.vue";

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
  },
  {
    path: "/session-management/:id",
    name: "session-management",
    component: SessionManagementPage,
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
    path: "/etude",
    name: "study",
    component: StudyPage,
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
