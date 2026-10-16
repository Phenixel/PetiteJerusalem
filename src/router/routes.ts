import HomeView from "../views/HomeView.vue";
import NotFound from "../views/NotFound.vue";
import { isNativeApp } from "../composables/useNativeApp";

/**
 * Les anciennes pages d'un jour des Hochanot → la clé du jour dans le livre
 * (voir TextDay) ; firebase.json porte les mêmes redirections côté serveur.
 */
const HOCHANOT_JOURS: Record<string, string> = {
  "yom-richon": "souccot-1",
  "yom-cheni": "souccot-2",
  "yom-chelichi": "souccot-3",
  "yom-revii": "souccot-4",
  "yom-hamichi": "souccot-5",
  "yom-chichi": "souccot-6",
  "hochana-rabba": "hoshana-rabba",
  chabbat: "chabbat-souccot",
};

// Toutes les autres vues sont lazy-loadées : Vite génère un chunk par vue,
// le bundle initial ne contient que la home (et la 404, minuscule).
const LoginView = () => import("../views/loginView.vue");
const ProfilePage = () => import("../views/ProfilePage.vue");
const NativeProfileHome = () => import("../views/profilePage/native/NativeProfileHome.vue");
const NativeProfileSection = () => import("../views/profilePage/native/NativeProfileSection.vue");
const SessionManagementPage = () => import("../views/SessionManagementPage.vue");
const ShareHomePage = () => import("../views/ShareReading/ShareHomePage.vue");
const NewSession = () => import("../views/ShareReading/NewSession.vue");
const DetailSession = () => import("../views/ShareReading/DetailSession.vue");
const SessionReadingPage = () => import("../views/ShareReading/SessionReadingPage.vue");
const ChiourimPage = () => import("../views/Chiourim/ChiourimPage.vue");
const DetailChiour = () => import("../views/Chiourim/DetailChiour.vue");
const AuteurChiourimPage = () => import("../views/Chiourim/AuteurChiourimPage.vue");
const SerieChiourimPage = () => import("../views/Chiourim/SerieChiourimPage.vue");
const TextReadingPage = () => import("../views/TextReading/TextReadingPage.vue");
const StudyPage = () => import("../views/StudyPage.vue");
const SidourPage = () => import("../views/SidourPage.vue");
const HomeEditPage = () => import("../views/HomeEditPage.vue");
const ParcoursPage = () => import("../views/Parcours/ParcoursPage.vue");
const MurPage = () => import("../views/Parcours/MurPage.vue");
const LectureDuJourPage = () => import("../views/Parcours/LectureDuJourPage.vue");
const NouvelObjectifPage = () => import("../views/Parcours/NouvelObjectifPage.vue");
const ObjectifPage = () => import("../views/Parcours/ObjectifPage.vue");
const ProgrammeReglagesPage = () => import("../views/Parcours/ProgrammeReglagesPage.vue");
const ChneiMikraPage = () => import("../views/Library/ChneiMikraPage.vue");
const TehilimDayPage = () => import("../views/Library/TehilimDayPage.vue");
const ContentPage = () => import("../views/ContentPage.vue");
const ZmanimPage = () => import("../views/Zmanim/ZmanimPage.vue");
const CalendarPage = () => import("../views/Zmanim/CalendarPage.vue");
const TehilimPage = () => import("../views/TehilimPage.vue");
const SeoGuidePage = () => import("../views/SeoGuidePage.vue");
const ParashaPage = () => import("../views/Library/ParashaPage.vue");
const AnnouncementsPage = () => import("../views/Announcements/AnnouncementsPage.vue");
const SupportPage = () => import("../views/SupportPage.vue");
const SupportThreadPage = () => import("../views/SupportThreadPage.vue");
const AnnouncementDetailPage = () => import("../views/Announcements/AnnouncementDetailPage.vue");

import type { NavigationGuardWithThis, RouteLocation, RouteRecordSingleView } from "vue-router";
import {
  DEFAULT_SEO_LOCALE,
  SEO_LOCALES,
  sectionPath,
  type SeoLocale,
  type SeoSection,
} from "../content/seoLocales";
const StudioPage = () => import("../views/Studio/StudioPage.vue");
const AdminLayout = () => import("../views/Admin/AdminLayout.vue");
const AdminDashboardPage = () => import("../views/Admin/AdminDashboardPage.vue");
const AdminChiourimPage = () => import("../views/Admin/AdminChiourimPage.vue");
const AdminChiourEditPage = () => import("../views/Admin/AdminChiourEditPage.vue");
const AdminAuteursPage = () => import("../views/Admin/AdminAuteursPage.vue");
const AdminAuteurDetailPage = () => import("../views/Admin/AdminAuteurDetailPage.vue");
const AdminSessionsPage = () => import("../views/Admin/AdminSessionsPage.vue");
const AdminAnnouncementsPage = () => import("../views/Admin/AdminAnnouncementsPage.vue");
const AdminSupportPage = () => import("../views/Admin/AdminSupportPage.vue");
const AdminSupportThreadPage = () => import("../views/Admin/AdminSupportThreadPage.vue");
const AdminAnnouncementEditPage = () => import("../views/Admin/AdminAnnouncementEditPage.vue");

/**
 * /lire/:textId sans chaîne : vers la bibliothèque. Le catalogue et ses
 * chemins sont chargés à la demande, ils n'ont rien à faire dans le bundle
 * initial pour une adresse rarement ouverte.
 */
const redirectPublicLire: NavigationGuardWithThis<undefined> = async (to) => {
  const { lireRedirect } = await import("./lireRedirect");
  const section = to.params.section;
  return (
    lireRedirect(
      String(to.params.textId),
      section === undefined ? undefined : String(section),
      to.query,
    ) ?? true
  );
};

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
    // Deux pages sous une adresse : le site garde son menu latéral, l'app a
    // sa page de réglages rangée en lignes et en sous-pages (voir
    // docs/design.md, « The app profile is a list, not a menu »).
    component: isNativeApp ? NativeProfileHome : ProfilePage,
    // App native : la page sert aussi de page de réglages, accessible sans
    // compte (langue, thème, polices, à propos), et ces réglages sont locaux :
    // elle se rend hors ligne aussi. Le web garde la garde de connexion : les
    // réglages n'y sont proposés qu'aux comptes.
    meta: { requiresAuth: !isNativeApp, offlineOk: isNativeApp },
  },
  // Les sous-pages du profil de l'app. Le site n'en a pas : son menu change
  // de panneau sur place. Les réglages d'appareil s'ouvrent sans compte et
  // hors ligne ; les pages du compte demandent l'un et le réseau.
  ...(isNativeApp
    ? [
        {
          path: "/profile/:section(appearance|language|notifications|preferences)",
          name: "profile-settings",
          component: NativeProfileSection,
          meta: { offlineOk: true },
        },
        {
          path: "/profile/:section(account|security)",
          name: "profile-account",
          component: NativeProfileSection,
          meta: { requiresAuth: true },
        },
      ]
    : []),
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
  // Every Tehilim the reader took in a chain, read one after the other
  // (services/sessionBatchReading.ts). Without an account too: a guest is
  // recognized by this device.
  {
    path: "/share-reading/session/:slug/lecture",
    name: "session-reading",
    component: SessionReadingPage,
  },
  {
    path: "/bibliotheque",
    name: "study",
    meta: { offlineOk: true },
    component: StudyPage,
  },
  // La lecture du jour : les textes du jour et les lectures du calendrier de
  // Mon parcours, à la suite (la carte « Lecture du jour » de la pile y
  // mène). Les versions installées, les widgets, la montre et le rappel du
  // soir y mènent aussi. Comme Mon parcours : sans compte dans l'app, avec un
  // compte sur le site. Route statique, prioritaire sur /bibliotheque/:corpus.
  {
    path: "/bibliotheque/lecture-du-jour",
    name: "daily-reading",
    meta: { requiresAuth: !isNativeApp, offlineOk: isNativeApp },
    component: LectureDuJourPage,
  },
  // Ma journée a été retirée : la pile et le portefeuille de l'accueil
  // montrent la journée. L'adresse mène à l'accueil, pour les liens gardés.
  {
    path: "/parcours/journee",
    name: "parcours-day",
    redirect: "/",
  },
  // L'accueil à son goût : l'ordre des blocs, ceux qu'on masque. Un réglage
  // de l'appareil ; sur le site, comme le tableau de bord, pour un compte.
  {
    path: "/accueil/modifier",
    name: "home-edit",
    meta: { requiresAuth: !isNativeApp, offlineOk: isNativeApp },
    component: HomeEditPage,
  },
  // Mon parcours : programmes, habitudes, la journée et le mur. Dans l'app,
  // tout marche sans compte, sur l'appareil, et sans réseau ; sur le site,
  // un compte est demandé (il n'y a pas d'appareil où garder le suivi).
  ...[
    {
      path: "/parcours",
      name: "parcours",
      component: ParcoursPage,
    },
    {
      path: "/parcours/mur",
      name: "parcours-wall",
      component: MurPage,
    },
    {
      path: "/parcours/nouveau",
      name: "parcours-new",
      component: NouvelObjectifPage,
    },
    {
      path: "/parcours/objectif/:id",
      name: "parcours-objective",
      component: ObjectifPage,
    },
    {
      path: "/parcours/objectif/:id/reglages",
      name: "parcours-objective-settings",
      component: ProgrammeReglagesPage,
    },
  ].map((route) => ({ ...route, meta: { requiresAuth: !isNativeApp, offlineOk: isNativeApp } })),
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
  // Tehilim du jour : les psaumes du cycle mensuel, les uns sous les autres,
  // plutôt qu'une rangée de numéros à ouvrir un par un. Le jour se calcule sur
  // l'appareil et les psaumes sont embarqués dans l'app native : la page a sa
  // place parmi les `offlineOk`.
  {
    path: "/bibliotheque/tehilim-du-jour",
    name: "tehilim-day",
    meta: { offlineOk: true, plainBackground: true },
    component: TehilimDayPage,
  },
  // Détail d'un corpus de la bibliothèque (liste des textes) : la page
  // d'accueil de la bibliothèque ne montre que les grandes sections.
  {
    path: "/bibliotheque/:corpus(tehilim|michna|talmud|tanakh|moussar|halakha)",
    name: "study-corpus",
    meta: { offlineOk: true },
    component: StudyPage,
  },
  // Le Sidour : les tefilot, les brahot et les textes des fêtes, en une
  // liste, l'office du moment en tête. Tout se calcule sur l'appareil, et les
  // textes de l'office sont embarqués : la page tient hors connexion.
  {
    path: "/sidour",
    name: "sidour",
    meta: { offlineOk: true },
    component: SidourPage,
  },
  // Les trois livres de liturgie avaient chacun leur liste dans la
  // bibliothèque : ils n'en font plus qu'une, celle du Sidour. Leurs adresses
  // restent dans la nature (le widget Sidour des apps installées ouvre
  // /bibliotheque/sidour, des informations publiées y renvoient) ;
  // firebase.json porte les mêmes redirections côté serveur. Les textes,
  // eux, gardent leur adresse sous /bibliotheque.
  {
    path: "/bibliotheque/sidour",
    redirect: "/sidour",
  },
  {
    path: "/bibliotheque/moadim",
    redirect: "/sidour",
  },
  {
    path: "/bibliotheque/brahot",
    redirect: "/sidour",
  },
  // Les Sli'hot avaient un livre à elles, l'allumage de Hanouka vivait parmi
  // les brahot : les deux sont passés dans Moadim, avec les textes des fêtes.
  // Leurs anciennes adresses sont dans la nature (liens, favoris, index des
  // moteurs) et mènent au même texte.
  {
    path: "/bibliotheque/slihot",
    redirect: "/bibliotheque/moadim/slihot",
  },
  {
    path: "/bibliotheque/slihot/slihot",
    redirect: "/bibliotheque/moadim/slihot",
  },
  {
    path: "/bibliotheque/brahot/nerot-hanouka",
    redirect: "/bibliotheque/moadim/nerot-hanouka",
  },
  // Les Hochanot avaient une page par jour, et le Chabbat la sienne : elles
  // tiennent désormais en un livre, qui s'ouvre sur le jour. L'ancienne page
  // nommait son jour, l'adresse du livre le garde (?jour=).
  {
    path: `/bibliotheque/moadim/hochanot-:jour(${Object.keys(HOCHANOT_JOURS).join("|")})`,
    redirect: (to: RouteLocation) => ({
      path: "/bibliotheque/moadim/hochanot",
      query: { jour: HOCHANOT_JOURS[String(to.params.jour)] },
    }),
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
  // Informations de l'équipe (nouveautés, incidents, questions). Les
  // notifications ouvrent /informations/:id (voir functions/src/announcements.ts).
  {
    path: "/informations",
    name: "announcements",
    component: AnnouncementsPage,
  },
  // Nous écrire : les messages envoyés à l'équipe et ses réponses (voir
  // docs/feedback.md), puis la page de chaque fil. L'app les relit sans
  // compte, par la clé de l'appareil ; sur le site, seul un compte relie un
  // message à la personne. La notification d'une réponse mène à la page du
  // fil (functions/src/support.ts).
  {
    path: "/contact",
    name: "support",
    component: SupportPage,
    meta: { requiresAuth: !isNativeApp },
  },
  {
    path: "/contact/:id",
    name: "support-thread",
    component: SupportThreadPage,
    meta: { requiresAuth: !isNativeApp },
  },
  {
    path: "/informations/:id",
    name: "announcement",
    component: AnnouncementDetailPage,
  },
  // La page de vote d'un sondage, pour les versions de l'app qui ne savent
  // pas l'afficher : elle s'ouvre dans le navigateur (hors des liens
  // d'application, voir BROWSER_ONLY_PATHS de scripts/lib/app-links.mjs).
  {
    path: "/sondage/:id",
    name: "announcement-poll",
    component: AnnouncementDetailPage,
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
      { path: "", name: "admin-dashboard", component: AdminDashboardPage },
      { path: "chiourim", name: "admin-chiourim", component: AdminChiourimPage },
      { path: "chiourim/:slug", name: "admin-chiour-edit", component: AdminChiourEditPage },
      { path: "auteurs", name: "admin-auteurs", component: AdminAuteursPage },
      { path: "auteurs/:auteurId", name: "admin-auteur-detail", component: AdminAuteurDetailPage },
      // Modération des sessions signalées (exigence App Store 1.2).
      { path: "sessions", name: "admin-sessions", component: AdminSessionsPage },
      // Nous écrire : les messages des utilisateurs, et les réponses.
      { path: "messages", name: "admin-support", component: AdminSupportPage },
      { path: "messages/:id", name: "admin-support-thread", component: AdminSupportThreadPage },
      // Informations de l'équipe : écrire, publier, notifier.
      { path: "informations", name: "admin-announcements", component: AdminAnnouncementsPage },
      {
        path: "informations/:id",
        name: "admin-announcement-edit",
        component: AdminAnnouncementEditPage,
      },
    ],
  },
  // Un lien public /lire (sans chaîne de lecture) est renvoyé vers la page
  // canonique de la bibliothèque, avant que la vue n'existe : le routeur
  // réutilise la même vue pour les deux adresses, une redirection au montage
  // laissait la page blanche (voir lireRedirect).
  {
    path: "/lire/:textId",
    name: "text-reading",
    meta: { offlineOk: true, plainBackground: true },
    beforeEnter: redirectPublicLire,
    component: TextReadingPage,
  },
  {
    path: "/lire/:textId/:section",
    name: "text-reading-section",
    meta: { offlineOk: true, plainBackground: true },
    beforeEnter: redirectPublicLire,
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
