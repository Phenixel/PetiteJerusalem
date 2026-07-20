import { createI18n } from "vue-i18n";
import fr from "./locales/fr";
import en from "./locales/en";
import he from "./locales/he";

export type SupportedLocale = "fr" | "en" | "he";

export const SUPPORTED_LOCALES = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "he", label: "עברית", flag: "🇮🇱" },
] as const;

const STORAGE_KEY = "petite-jerusalem-locale";

function getStoredLocale(): SupportedLocale | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.some((l) => l.code === stored)) {
      return stored as SupportedLocale;
    }
  } catch {
    // localStorage indisponible (tests Node, navigation privée…)
  }
  return null;
}

function getDeviceLocale(): SupportedLocale | null {
  if (typeof navigator === "undefined") return null;
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    let code = candidate?.slice(0, 2).toLowerCase();
    if (code === "iw") code = "he"; // ancien code ISO de l'hébreu, encore renvoyé par certains Android
    if (SUPPORTED_LOCALES.some((l) => l.code === code)) {
      return code as SupportedLocale;
    }
  }
  return null;
}

/**
 * Choix explicite de l'utilisateur s'il existe, sinon la langue de l'appareil
 * (navigator.language reflète la langue système, dans la webview Capacitor
 * comme sur le web), sinon le français.
 */
function getInitialLocale(): SupportedLocale {
  return getStoredLocale() ?? getDeviceLocale() ?? "fr";
}

export function setStoredLocale(locale: SupportedLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // localStorage indisponible : la locale ne sera pas persistée
  }
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: getInitialLocale(),
  fallbackLocale: "fr",
  messages: {
    fr,
    en,
    he,
  },
});

export default i18n;
