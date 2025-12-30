import { createI18n } from "vue-i18n";
import fr from "./locales/fr.json";
import en from "./locales/en.json";
import he from "./locales/he.json";

export type SupportedLocale = "fr" | "en" | "he";

const STORAGE_KEY = "petite-jerusalem-locale";

export function getBrowserLocale(): SupportedLocale | null {
  if (typeof navigator === "undefined") return null;

  const browserLang = navigator.language.split("-")[0];
  if (["fr", "en", "he"].includes(browserLang)) {
    return browserLang as SupportedLocale;
  }
  return null;
}

function getStoredLocale(): SupportedLocale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && ["fr", "en", "he"].includes(stored)) {
    return stored as SupportedLocale;
  }

  const browserLocale = getBrowserLocale();
  if (browserLocale) {
    return browserLocale;
  }

  return "fr";
}

export function setStoredLocale(locale: SupportedLocale): void {
  localStorage.setItem(STORAGE_KEY, locale);
}

export const i18n = createI18n({
  legacy: false,
  locale: getStoredLocale(),
  fallbackLocale: "fr",
  messages: {
    fr,
    en,
    he,
  },
});

export default i18n;
