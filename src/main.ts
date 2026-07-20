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
// - la classe native-app active les styles réservés à l'app (main.css).
if (isNativeApp) {
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute("content", "width=device-width, initial-scale=1.0, viewport-fit=cover");
  document.documentElement.classList.add("native-app");
}

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

app.mount("#app");

// App native uniquement — imports dynamiques pour ne rien ajouter au bundle
// initial du site web.
import("./composables/useNativeApp").then(({ isNativeApp }) => {
  if (!isNativeApp) return;
  // Navigation quand on touche une notification push.
  import("./services/pushService").then(({ pushService }) => pushService.initDeepLinks(router));
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
