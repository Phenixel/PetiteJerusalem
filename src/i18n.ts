import { createI18n } from "vue-i18n";
import fr from "./locales/fr";

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

/**
 * Seul le français (la langue de repli) est embarqué dans le bundle initial :
 * en + he représentaient ~60 kB de source chargés pour tout le monde. Les
 * autres locales arrivent par import dynamique, au démarrage pour la langue
 * détectée/choisie, ou au moment du changement de langue (setLocale).
 * En attendant le chunk (quelques dizaines de ms, puis cache navigateur),
 * vue-i18n retombe silencieusement sur le français.
 */
type LocaleMessages = typeof fr;

const localeLoaders: Record<SupportedLocale, (() => Promise<{ default: LocaleMessages }>) | null> = {
  fr: null,
  en: () => import("./locales/en"),
  he: () => import("./locales/he"),
};

const loadedLocales = new Set<SupportedLocale>(["fr"]);

export async function loadLocaleMessages(locale: SupportedLocale): Promise<void> {
  const loader = localeLoaders[locale];
  if (!loader || loadedLocales.has(locale)) return;
  try {
    const messages = await loader();
    i18n.global.setLocaleMessage(locale, messages.default);
    loadedLocales.add(locale);
  } catch {
    // Chunk introuvable (réseau, déploiement entre-temps) : le repli français
    // reste affiché ; le prochain setLocale retentera.
  }
}

const initialLocale = getInitialLocale();

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: initialLocale,
  fallbackLocale: "fr",
  // Le repli silencieux est le comportement voulu pendant le chargement d'une
  // locale : pas de log pour chaque clé en attente.
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    fr,
  },
});

if (initialLocale !== "fr") {
  void loadLocaleMessages(initialLocale);
}

export default i18n;
