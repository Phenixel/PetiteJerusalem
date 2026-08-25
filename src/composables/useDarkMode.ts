import { ref, watchEffect } from "vue";
import { analyticsService } from "../services/analyticsService";

const isDark = ref(false);
let initialized = false;

function applyTheme() {
  if (typeof document !== "undefined") {
    if (isDark.value) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }
}

function initDarkMode() {
  if (initialized || typeof window === "undefined") return;

  isDark.value = window.matchMedia("(prefers-color-scheme: dark)").matches;

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    isDark.value = e.matches;
    // Bascule clair/sombre EN COURS de visite : l'app suit le réglage du
    // système, elle n'a pas d'interrupteur à elle. L'événement ne part donc
    // pas au démarrage (état initial, pas un changement), seulement quand le
    // système bascule sous l'application, ce qui arrive à l'heure du coucher
    // du soleil sur la plupart des téléphones, en pleine lecture du soir.
    analyticsService.capture("color_scheme_changed", { scheme: e.matches ? "dark" : "light" });
  });

  initialized = true;
}

initDarkMode();

export function useDarkMode() {
  watchEffect(() => applyTheme());

  return {
    isDark,
  };
}
