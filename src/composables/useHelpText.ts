import { useI18n } from "vue-i18n";
import type { HelpLocale, HelpText } from "../content/help/catalog";

/**
 * Reads a help text (catalog.ts) in the language on screen: written out in
 * the three languages, or borrowed from the app's own words.
 */
export function useHelpText() {
  const { t, locale } = useI18n();
  return (text: HelpText): string =>
    "key" in text ? t(text.key) : (text[locale.value as HelpLocale] ?? text.fr);
}
