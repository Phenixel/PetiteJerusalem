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
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LOCALES.some((l) => l.code === stored)) {
    return stored as SupportedLocale;
  }
  return "fr";
}

export function setStoredLocale(locale: SupportedLocale): void {
  localStorage.setItem(STORAGE_KEY, locale);
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
