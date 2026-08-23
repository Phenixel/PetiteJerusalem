import { ref } from "vue";
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

const localeLoaders: Record<SupportedLocale, (() => Promise<{ default: LocaleMessages }>) | null> =
  {
    fr: null,
    en: () => import("./locales/en"),
    he: () => import("./locales/he"),
  };

const loadedLocales = new Set<SupportedLocale>(["fr"]);

/**
 * Incrémenté chaque fois que les messages d'une langue viennent d'arriver.
 *
 * Le changement de langue est immédiat, mais les messages, eux, arrivent par
 * import dynamique : ce qui a été calculé entre les deux l'a été avec le repli
 * français. Les vues qui posent un titre de page (elles le font une fois, pas
 * dans un rendu) surveillent ce compteur pour le reposer dans la bonne langue.
 */
export const localeMessagesReady = ref(0);

export async function loadLocaleMessages(locale: SupportedLocale): Promise<void> {
  const loader = localeLoaders[locale];
  if (!loader || loadedLocales.has(locale)) return;
  try {
    const messages = await loader();
    i18n.global.setLocaleMessage(locale, messages.default);
    loadedLocales.add(locale);
    localeMessagesReady.value += 1;
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

/**
 * Applique une langue : messages chargés en tâche de fond (le français sert de
 * repli pendant le court chargement du chunk), langue mémorisée, `lang` et
 * `dir` du document mis à jour.
 *
 * Sert au sélecteur de langue et au routeur : une URL préfixée (/en/…, /he/…)
 * impose sa langue, sans quoi une page anglaise s'afficherait en français à
 * qui arrive d'un moteur de recherche.
 */
export function applyLocale(locale: SupportedLocale): Promise<void> {
  const loaded = loadLocaleMessages(locale);
  // `createI18n` ne reçoit que les messages français : vue-i18n en déduit que
  // la locale ne peut valoir que « fr ». Les autres arrivent bien plus tard,
  // par import dynamique ; le typage large rétablit ce que le code fait.
  (i18n.global.locale as unknown as { value: string }).value = locale;
  setStoredLocale(locale);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("lang", locale);
    document.documentElement.setAttribute("dir", locale === "he" ? "rtl" : "ltr");
  }
  // La locale est posée tout de suite (le français sert de repli le temps du
  // chunk) ; la promesse permet à qui en a besoin d'attendre les messages,
  // comme le routeur avant d'ouvrir une page traduite dont le titre en dépend.
  return loaded;
}

export default i18n;
