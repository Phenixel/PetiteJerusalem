import { ref, watchEffect } from "vue";

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
  });

  initialized = true;
}

initDarkMode();

export function useDarkMode() {
  watchEffect(() => applyTheme());

  const toggleDark = () => {
    isDark.value = !isDark.value;
  };

  return {
    isDark,
    toggleDark,
  };
}
