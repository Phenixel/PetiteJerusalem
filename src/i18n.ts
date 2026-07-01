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

function getStoredLocale(): SupportedLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.some((l) => l.code === stored)) {
      return stored as SupportedLocale;
    }
  } catch {
    // localStorage indisponible (tests Node, navigation privée…)
  }
  return "fr";
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
  locale: getStoredLocale(),
  fallbackLocale: "fr",
  messages: {
    fr,
    en,
    he,
  },
});

export default i18n;
