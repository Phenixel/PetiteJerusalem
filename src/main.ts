import "./assets/main.css";

import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import i18n from "./i18n";
import { isNativeApp } from "./composables/useNativeApp";

// App native : à faire de façon SYNCHRONE avant le premier rendu.
// - viewport-fit=cover fait passer la webview en vrai edge-to-edge (Capacitor
//   lit ce meta au DOMContentLoaded) : le fond de l'app remplit les zones de
//   la barre d'état et de la barre de gestes, les safe-areas prennent le relais.
// - user-scalable=no coupe le zoom de la webview : il agrandit la page entière
//   (barres comprises), déborde du viewport et ne se remet jamais droit. Dans
//   les pages de texte, le pincement pilote à la place la taille de lecture
//   (useReadingPinch), le réflexe reste le bon, l'effet devient utile.
// - la classe native-app active les styles réservés à l'app (main.css).
if (isNativeApp) {
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
    );
  document.documentElement.classList.add("native-app");
}

// Après un déploiement, les chunks lazy-loadés changent de hash : un onglet
// resté ouvert sur l'ancienne version obtient un 404 en naviguant (« Failed to
// fetch dynamically imported module ») et la navigation échoue, page blanche à
// la clé. On recharge une seule fois (garde sessionStorage pour ne pas boucler
// si le réseau est vraiment en panne) : le HTML frais référence les nouveaux
// chunks.
//
// Trois sources d'écoute, parce qu'elles ne se recouvrent pas :
//  - vite:preloadError, échec du PRÉchargement des dépendances d'un chunk ;
//  - router.onError, échec de l'import() du composant de route lui-même, qui
//    ne déclenche aucun vite:preloadError. C'est le cas réellement observé en
//    production, et il n'était pas rattrapé ;
//  - unhandledrejection, les import() hors routeur (services, composants).
const CHUNK_RELOAD_KEY = "pj_chunk_reload_at";

// Messages des navigateurs pour un module dynamique injoignable : Chrome
// (« Failed to fetch dynamically imported module »), Firefox (« error loading
// dynamically imported module »), Safari (« Importing a module script failed »).
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed/i;

function chunkNameFrom(message: string): string | null {
  const url = message.match(/https?:\/\/\S+?\.(?:js|mjs|css)/)?.[0];
  return url ? (url.split("/").pop() ?? null) : null;
}

/** Un seul rechargement par minute et par onglet : sinon un vrai incident réseau boucle. */
function claimReload(): boolean {
  try {
    const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
    if (Date.now() - lastReload < 60_000) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    // Stockage indisponible : on recharge quand même, sans garde.
  }
  return true;
}

/** Renvoie true si l'erreur est bien un chunk manquant ET qu'on recharge. */
function handleChunkLoadError(error: unknown, source: string): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (!CHUNK_ERROR.test(message)) return false;

  const reloading = claimReload();
  // Capture AVANT le rechargement : PostHog vide sa file en sendBeacon au
  // pagehide déclenché par reload(), l'événement n'est donc pas perdu.
  void import("./services/analyticsService")
    .then(({ analyticsService }) =>
      analyticsService.capture("chunk_load_error", {
        chunk: chunkNameFrom(message),
        route: window.location.pathname,
        source,
        reloaded: reloading,
      }),
    )
    .finally(() => {
      if (reloading) window.location.reload();
    });
  return reloading;
}

window.addEventListener("vite:preloadError", (event) => {
  // On n'étouffe l'erreur que si on la traite : au 2e échec d'affilée, elle
  // doit redevenir visible (Error tracking) plutôt que disparaître.
  if (handleChunkLoadError(event.payload, "vite_preload")) event.preventDefault();
});

window.addEventListener("unhandledrejection", (event) => {
  handleChunkLoadError(event.reason, "unhandled_rejection");
});

const app = createApp(App);

// Click outside directive for dropdowns
app.directive("click-outside", {
  mounted(el, binding) {
    el._clickOutside = (event: MouseEvent) => {
      if (!(el === event.target || el.contains(event.target as Node))) {
        binding.value(event);
      }
    };
    document.addEventListener("click", el._clickOutside);
  },
  unmounted(el) {
    document.removeEventListener("click", el._clickOutside);
  },
});

app.use(router);
app.use(i18n);

// Le composant de route est importé APRÈS les gardes et AVANT que l'URL ne
// change : quand son chunk a disparu (déploiement), l'échec remonte ici, pas
// dans vite:preloadError, et l'utilisateur reste bloqué sur la page de départ
// sans rien voir. C'est exactement ce qui s'est produit en prod le 28/07.
router.onError((error) => handleChunkLoadError(error, "router"));

// Les erreurs de rendu/handlers Vue ne remontent pas jusqu'à window.onerror :
// sans ce handler, elles seraient invisibles dans l'Error tracking PostHog.
app.config.errorHandler = (err, _instance, info) => {
  console.error("Erreur Vue non gérée:", err, info);
  import("./services/analyticsService").then(({ analyticsService }) =>
    analyticsService.captureException(err, { vue_error_info: info }),
  );
};

app.mount("#app");

// Suivi produit + traque d'erreurs (PostHog, prod uniquement). Import
// dynamique et best-effort : jamais bloquant pour le démarrage.
import("./services/analyticsService").then(({ analyticsService }) => analyticsService.init());

// Textes gardés sur l'appareil : si le site en sert une version plus récente
// (un passage ajouté, une correction), on la reprend en tâche de fond. Sans
// cela, un texte téléchargé une fois resterait celui de ce jour-là.
import("./services/offlineLibraryService").then(({ refreshStaleDownloads }) =>
  refreshStaleDownloads(),
);

// App native uniquement, imports dynamiques pour ne rien ajouter au bundle
// initial du site web.
import("./composables/useNativeApp").then(({ isNativeApp }) => {
  if (!isNativeApp) return;
  // Notifications push : deep-links au toucher + affichage en premier plan.
  import("./services/pushService").then(({ pushService }) => pushService.init(router));
  // Widgets d'écran d'accueil : pousse les horaires et la lecture du jour au
  // natif (lancement, retour au premier plan, changement de lieu…).
  import("./services/widgetService").then(({ widgetService }) => widgetService.init());
  // Bandeau de mise à jour : compare le binaire installé à la version publiée
  // sur le store (lancement, puis retour au premier plan).
  import("./services/appUpdateService").then(({ appUpdateService }) => appUpdateService.init());
  // La WebView Android applique l'échelle de police système (textZoom), ce qui
  // casse les mises en page (textes agrandis, débordements). On la neutralise :
  // la taille de lecture se règle dans l'app (useReadingSize).
  import("@capacitor/text-zoom")
    .then(({ TextZoom }) => TextZoom.set({ value: 1 }))
    .catch(() => {
      // Vieux binaire sans le plugin : sans gravité.
    });
  // Bouton retour matériel Android : sans listener, il quitte l'app au lieu
  // de revenir en arrière dans la navigation.
  import("@capacitor/app").then(({ App: CapacitorApp }) => {
    // Deux façons d'entrer dans l'app par une URL, même traitement :
    //  - toucher un widget, dont l'intent porte une URL du site (https sur
    //    Android, scheme petitejerusalem:// sur iOS) ;
    //  - ouvrir un lien du site depuis un message ou un navigateur, quand le
    //    système a vérifié le domaine (App Links / Universal Links, voir
    //    docs/app-links.md) : le lien partagé arrive ici plutôt que dans le
    //    navigateur.
    // Seules ces URLs-là naviguent, tout autre lien délivré ici (callback
    // OAuth natif, intent tiers) doit laisser l'app où elle est, sous peine
    // d'arracher l'utilisateur vers une 404 en pleine connexion Google par
    // exemple.
    CapacitorApp.addListener("appUrlOpen", ({ url }) => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return; // URL illisible : on reste où on est.
      }
      if (parsed.hostname !== "petite-jerusalem.fr") return;
      // Au démarrage à froid, l'événement (retenu par Capacitor) arrive
      // pendant la navigation initiale : attendre le router pour que le
      // deep-link ne soit pas écarté par elle.
      void router.isReady().then(() => router.push(parsed.pathname + parsed.search + parsed.hash));
    });
    CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        router.back();
      } else {
        // Sur la home : comportement Android standard, l'app passe en arrière-plan.
        CapacitorApp.minimizeApp();
      }
    });
  });
});
