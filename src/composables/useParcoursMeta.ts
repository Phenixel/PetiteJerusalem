import { watch } from "vue";
import { useI18n } from "vue-i18n";
import { SITE_URL } from "../config/site";
import { localeMessagesReady } from "../i18n";
import { pageTitle, seoService } from "../services/seoService";

/**
 * Le titre et la description d'une page de Mon parcours. Des pages
 * personnelles, derrière un compte sur le site : rien à indexer.
 * Rejoué au changement de langue (les messages en et he arrivent après le
 * montage).
 */
export function useParcoursMeta(titleKey: string, path: string): void {
  const { t, locale } = useI18n();
  watch(
    [locale, localeMessagesReady],
    () => {
      seoService.setMeta({
        title: pageTitle(t(titleKey), titleKey === "parcours.title" ? null : t("parcours.title")),
        description: t("parcours.pageDescription"),
        canonical: SITE_URL + path,
        robots: "noindex",
      });
    },
    { immediate: true },
  );
}
