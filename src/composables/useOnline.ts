import { readonly, ref } from "vue";

/**
 * État de la connexion réseau, partagé par toute l'app.
 *
 * Basé sur `navigator.onLine` + les événements online/offline du navigateur
 * (fiables dans la webview Capacitor comme sur le web). Sert à afficher un
 * message « Connexion impossible » sur les pages qui ne fonctionnent pas hors
 * ligne (voir meta.offlineOk dans router/routes.ts et App.vue).
 */
const online = ref(typeof navigator === "undefined" ? true : navigator.onLine);

if (typeof window !== "undefined") {
  window.addEventListener("online", () => (online.value = true));
  window.addEventListener("offline", () => (online.value = false));
}

export function useOnline() {
  return readonly(online);
}
