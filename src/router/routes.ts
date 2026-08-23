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
const CalendarPage = () => import("../views/Zmanim/CalendarPage.vue");
const TehilimPage = () => import("../views/TehilimPage.vue");
const SeoGuidePage = () => import("../views/SeoGuidePage.vue");
const ParashaPage = () => import("../views/Library/ParashaPage.vue");

import type { RouteRecordSingleView } from "vue-router";
import {
  DEFAULT_SEO_LOCALE,
  SEO_LOCALES,
  sectionPath,
  type SeoLocale,
  type SeoSection,
} from "../content/seoLocales";
const StudioPage = () => import("../views/Studio/StudioPage.vue");
const AdminLayout = () => import("../views/Admin/AdminLayout.vue");
const AdminChiourimPage = () => import("../views/Admin/AdminChiourimPage.vue");
const AdminChiourEditPage = () => import("../views/Admin/AdminChiourEditPage.vue");
const AdminAuteursPage = () => import("../views/Admin/AdminAuteursPage.vue");
const AdminAuteurDetailPage = () => import("../views/Admin/AdminAuteurDetailPage.vue");
const AdminSessionsPage = () => import("../views/Admin/AdminSessionsPage.vue");

/** Les sections traduites, et la vue qui les rend. */
type LocalizedSection = {
  section: SeoSection;
  component: RouteRecordSingleView["component"];
  child?: string;
};

const LOCALIZED_SECTIONS: LocalizedSection[] = [
  { section: "home", component: HomeView },
  { section: "horaires", component: ZmanimPage, child: ":ville" },
  { section: "calendrier", component: CalendarPage, child: ":fete" },
  { section: "zmanim", component: SeoGuidePage },
  { section: "paracha", component: ParashaPage },
  { section: "finirLeChass", component: ContentPage },
  { section: "partageTehilim", component: ContentPage },
  { section: "confidentialite", component: ContentPage },
  { section: "aPropos", component: ContentPage },
  { section: "mentionsLegales", component: ContentPage },
  { section: "conditions", component: ContentPage },
];

/** Une route par section traduite et par langue préfixée. */
function localizedRoutes(): RouteRecordSingleView[] {
  const locales = SEO_LOCALES.filter(
    (locale): locale is SeoLocale => locale !== DEFAULT_SEO_LOCALE,
  );
  return locales.flatMap((locale) =>
    LOCALIZED_SECTIONS.flatMap(({ section, component, child }) => [
      {
        path: sectionPath(section, locale),
        name: `${section}-${locale}`,
        meta: { offlineOk: true },
        component,
      },
      ...(child
        ? [
            {
              path: sectionPath(section, locale, child),
              name: `${section}-child-${locale}`,
              meta: { offlineOk: true },
              component,
            },
          ]
        : []),
    ]),
  );
}

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
    // App native : la page sert aussi de page de réglages, accessible sans
    // compte (langue, thème, polices, à propos). Le web garde la garde de
    // connexion : les réglages n'y sont proposés qu'aux comptes.
    meta: { requiresAuth: !isNativeApp },
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
    path: "/bibliotheque/:corpus(tehilim|michna|talmud|tanakh|brahot|sidour)",
    name: "study-corpus",
    meta: { offlineOk: true },
    component: StudyPage,
  },
  // Les Sli'hot n'ont qu'un texte : le livre s'ouvre directement dessus, pas
  // sur une liste à un seul élément.
  {
    path: "/bibliotheque/slihot",
    redirect: "/bibliotheque/slihot/slihot",
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
  // charger, la page a donc sa place parmi les `offlineOk`, qui n'affichent
  // pas l'écran « hors ligne » quand le réseau manque.
  {
    path: "/horaires",
    name: "zmanim",
    meta: { offlineOk: true },
    component: ZmanimPage,
  },
  // Horaires d'une ville précise (/horaires/marseille) : même page, la ville
  // de l'URL devient le lieu de calcul. Les grandes communautés ont leur page
  // prérendue (voir src/content/zmanimCities.ts), mais toute ville du
  // catalogue se résout ici.
  {
    path: "/horaires/:ville",
    name: "zmanim-city",
    meta: { offlineOk: true },
    component: ZmanimPage,
  },
  // Calendrier des fêtes : même moteur, même absence de réseau.
  {
    path: "/calendrier",
    name: "calendar",
    meta: { offlineOk: true },
    component: CalendarPage,
  },
  // Page d'une fête (/calendrier/pessah) : le calendrier s'ouvre sur l'année
  // qui la porte et la met en avant. Les pages prérendues correspondantes
  // (voir SEO_FESTIVALS dans src/content/zmanimFestivals.ts) portent, elles, ses
  // dates sur plusieurs années ; un slug inconnu ramène au calendrier.
  {
    path: "/calendrier/:fete",
    name: "calendar-festival",
    meta: { offlineOk: true },
    component: CalendarPage,
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
  // Paracha de la semaine : celle de ce Chabbat, puis le calendrier des
  // suivants. Tout se calcule sur l'appareil, la page tient hors connexion.
  {
    path: "/paracha",
    name: "paracha",
    meta: { offlineOk: true },
    component: ParashaPage,
  },
  // Les zmanim expliqués : page de fond, rendue du même contenu que le
  // prérendu (src/content/seoPages.ts, `guidePages`).
  {
    path: "/zmanim",
    name: "zmanim-guide",
    meta: { offlineOk: true },
    component: SeoGuidePage,
  },
  // Les pages traduites, à leur adresse anglaise et hébraïque (/en/…, /he/…).
  //
  // Elles n'existaient pas : une seule URL servait les trois langues, choisies
  // dans le navigateur, et un moteur de recherche n'avait donc aucun moyen de
  // découvrir l'anglais ni l'hébreu. Les routes sont engendrées de la même
  // table que le prérendu (src/content/seoLocales.ts), pour qu'un segment
  // traduit ne puisse pas diverger entre les deux.
  //
  // Seules les sections réellement traduites en ont : ailleurs (bibliothèque,
  // chiourim), il n'y a qu'un document, donc qu'une adresse.
  ...localizedRoutes(),
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    meta: { offlineOk: true },
    component: NotFound,
  },
];
