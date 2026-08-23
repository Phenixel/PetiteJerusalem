import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  DEFAULT_SEO_LOCALE,
  localeOfPath,
  sectionPath,
  type SeoLocale,
  type SeoSection,
} from "../content/seoLocales";

/**
 * L'espace de langue de la session : celui de la dernière URL préfixée
 * ouverte, ou du dernier choix fait au sélecteur de langue.
 *
 * Les pages traduites ont une adresse par langue (/horaires,
 * /en/shabbat-times, /he/zmanei-shabbat), mais beaucoup de pages n'en ont
 * qu'une (bibliothèque, chiourim, profil...). Sans mémoire, les traverser
 * ferait retomber les liens dans l'espace français : un visiteur venu d'un
 * résultat anglais perdait son /en au premier passage par la bibliothèque,
 * et l'URL qu'il partageait ensuite s'ouvrait en français chez son
 * destinataire. L'espace colle donc à la session : il ne change que par une
 * URL préfixée ou par le sélecteur, jamais parce qu'une page n'a pas de
 * préfixe. En session, pas en stockage : au prochain lancement, c'est de
 * nouveau l'adresse ouverte qui décide.
 *
 * Le français d'origine reste préservé : qui n'a jamais touché /en ni /he
 * garde l'espace par défaut, et rien ne le pousse vers un préfixe.
 */
const spaceLocale = ref<SeoLocale>(DEFAULT_SEO_LOCALE);

/**
 * Impose l'espace de langue : le sélecteur de langue (useLocale) l'appelle,
 * y compris pour revenir au français. Les tests s'en servent pour repartir
 * d'une session neuve.
 */
export function setLocaleSpace(locale: SeoLocale): void {
  spaceLocale.value = locale;
}

/**
 * Le chemin d'une section traduite, dans l'espace de langue de la session.
 *
 * Sur une adresse préfixée, l'espace est celui de l'URL ; ailleurs, celui
 * que la session a retenu. Le suivi se fait ici même : la barre basse, la
 * barre de navigation et le pied de page vivent dans App.vue, il y a donc
 * toujours un abonné pour voir passer une URL préfixée.
 */
export function useLocalePath() {
  const route = useRoute();
  watch(
    () => route.path,
    (path) => {
      const urlLocale = localeOfPath(path);
      if (urlLocale !== DEFAULT_SEO_LOCALE) spaceLocale.value = urlLocale;
    },
    { immediate: true },
  );
  const pathLocale = computed(() => {
    const urlLocale = localeOfPath(route.path);
    return urlLocale !== DEFAULT_SEO_LOCALE ? urlLocale : spaceLocale.value;
  });

  return {
    pathLocale,
    localePath: (section: SeoSection, ...rest: string[]) =>
      sectionPath(section, pathLocale.value, ...rest),
  };
}
