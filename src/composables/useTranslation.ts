import { readonly, ref } from "vue";
import { analyticsService } from "../services/analyticsService";
import { devicePreference } from "../services/devicePreference";

/**
 * La traduction sous le texte hébreu : affichée ou non, et dans quelle langue.
 *
 * C'est un parti pris de lecture, comme masquer les halakhot : il tient d'un
 * texte à l'autre jusqu'à ce qu'on le change, gardé sur l'appareil (voir
 * devicePreference). Éteint au départ : la page se lit en hébreu comme
 * avant, et la commande « Traduction » de la barre d'outils l'allume.
 *
 * La langue suit d'abord le choix fait (un francophone peut préférer
 * l'anglais de Steinsaltz à la traduction de Schwab), puis celle de
 * l'interface, puis ce qui existe : un texte que nous n'avons qu'en anglais
 * se lit en anglais plutôt que pas du tout (voir pickTranslationLang).
 */
const SHOWN_KEY = "pj-translation";
const LANG_KEY = "pj-translation-lang";

/** Les langues de traduction que le lecteur sait proposer. */
export const TRANSLATION_LANGS = ["fr", "en"] as const;

function parseShown(value: string | null): boolean | null {
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}

function parseLang(value: string | null): string | null {
  return (TRANSLATION_LANGS as readonly string[]).includes(value ?? "") ? value : null;
}

const shownStore = devicePreference(SHOWN_KEY, parseShown, (value) => (value ? "1" : "0"));
const langStore = devicePreference(LANG_KEY, parseLang, (value) => value);

const storedShown = shownStore.read();
const storedLang = langStore.read();
const shown = ref(storedShown ?? false);
const chosenLang = ref<string | null>(storedLang);
let restored = storedShown !== null || storedLang !== null;

/** La traduction est-elle affichée sous le texte ? */
export const translationShown = readonly(shown);
/** La langue choisie, ou null tant que personne n'en a choisi. */
export const translationLangChoice = readonly(chosenLang);

export function setTranslationShown(value: boolean, lang: string | null = null): void {
  restored = true;
  if (value === shown.value) return;
  shown.value = value;
  shownStore.write(value);
  analyticsService.capture("translation_toggled", { enabled: value, lang });
}

export function setTranslationLang(lang: string): void {
  restored = true;
  if (lang === chosenLang.value || parseLang(lang) === null) return;
  chosenLang.value = lang;
  langStore.write(lang);
  analyticsService.capture("translation_language_changed", { lang });
}

/**
 * La langue dans laquelle lire un texte : le choix fait s'il existe pour ce
 * texte, sinon la langue de l'interface, sinon l'anglais, sinon le français.
 * Null quand le texte n'est traduit dans aucune.
 */
export function pickTranslationLang(
  available: readonly string[],
  locale: string,
  choice: string | null,
): string | null {
  const order = [choice, locale, "en", "fr"];
  return order.find((lang): lang is string => !!lang && available.includes(lang)) ?? null;
}

/** Reprend le réglage gardé par le natif quand le localStorage n'a rien. */
export async function restoreTranslationFromDevice(): Promise<void> {
  if (restored) return;
  restored = true;
  const [savedShown, savedLang] = await Promise.all([shownStore.restore(), langStore.restore()]);
  if (savedShown !== null) shown.value = savedShown;
  if (savedLang !== null) chosenLang.value = savedLang;
}
