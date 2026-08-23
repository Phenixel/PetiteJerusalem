import { computed } from "vue";
import { useRoute } from "vue-router";
import { localeOfPath, sectionPath, type SeoSection } from "../content/seoLocales";

/**
 * Le chemin d'une section traduite, dans l'espace de langue où l'on se trouve.
 *
 * Les pages traduites ont une adresse par langue (/horaires,
 * /en/shabbat-times, /he/zmanei-shabbat). Un lien écrit en dur ramènerait un
 * visiteur venu d'un résultat anglais dans l'espace français à son premier
 * clic, et l'onglet actif ne se reconnaîtrait plus. La langue est celle de
 * l'URL ouverte, pas celle de l'interface : sur une adresse sans préfixe (le
 * français, l'historique) on y reste, quelle que soit la langue affichée ;
 * c'est le sélecteur de langue, et lui seul, qui fait changer d'espace.
 */
export function useLocalePath() {
  const route = useRoute();
  const pathLocale = computed(() => localeOfPath(route.path));

  return {
    pathLocale,
    localePath: (section: SeoSection, ...rest: string[]) =>
      sectionPath(section, pathLocale.value, ...rest),
  };
}
