import { computed, watch, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { applyLocale, type SupportedLocale, SUPPORTED_LOCALES } from "../i18n";
import { translatePath } from "../content/seoLocales";
import { setLocaleSpace } from "./useLocalePath";
import { analyticsService } from "../services/analyticsService";

export interface LocaleOption {
  code: SupportedLocale;
  label: string;
  flag: string;
  dir: "ltr" | "rtl";
}

export const availableLocales: LocaleOption[] = SUPPORTED_LOCALES.map((loc) => ({
  ...loc,
  dir: loc.code === "he" ? "rtl" : "ltr",
}));

export function useLocale() {
  const { locale } = useI18n();
  const route = useRoute();
  const router = useRouter();

  const currentLocale = computed(() => locale.value as SupportedLocale);

  const currentLocaleOption = computed(
    () => availableLocales.find((l) => l.code === currentLocale.value) ?? availableLocales[0],
  );

  const isRtl = computed(() => currentLocaleOption.value.dir === "rtl");

  function setLocale(newLocale: SupportedLocale) {
    // Chaque événement porte déjà `locale` (voir stampPlatform), mais rien ne
    // disait qui CHANGE de langue : la bascule volontaire ne se lisait nulle
    // part, alors qu'elle décide à elle seule de la valeur des pages traduites.
    const previousLocale = currentLocale.value;
    if (newLocale !== previousLocale) {
      analyticsService.capture("locale_changed", {
        locale: newLocale,
        previous_locale: previousLocale,
        // Une page traduite change aussi d'adresse : le reste du site n'en a
        // qu'une. Savoir d'où part la bascule dit si elle suit une page
        // indexée dans une autre langue, ou un simple choix de préférence.
        is_localized_page: translatePath(route.path, newLocale) !== null,
      });
    }
    // Locale non embarquée (en/he) : chargée à la volée ; le français sert de
    // repli pendant le court chargement du chunk.
    applyLocale(newLocale);
    updateDocumentDirection(newLocale);
    // Le sélecteur impose aussi l'espace de langue des liens (useLocalePath),
    // y compris le retour au français : sur une page sans préfixe, aucune
    // navigation ne le ferait à sa place.
    setLocaleSpace(newLocale);
    // Les pages traduites ont une adresse par langue : changer de langue y
    // change d'adresse, sinon l'URL contredirait ce qui est affiché. Ailleurs
    // (bibliothèque, chiourim), il n'y a qu'un document et qu'une adresse :
    // on ne bouge pas. `replace`, parce que ce n'est pas une étape de
    // navigation à défaire au bouton « retour ».
    const sibling = translatePath(route.path, newLocale);
    if (sibling && sibling !== route.path) {
      void router.replace({ path: sibling, query: route.query, hash: route.hash });
    }
  }

  function updateDocumentDirection(localeCode: SupportedLocale) {
    const localeOption = availableLocales.find((l) => l.code === localeCode);
    const dir = localeOption?.dir ?? "ltr";
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", localeCode);
  }

  onMounted(() => {
    updateDocumentDirection(currentLocale.value);
  });

  watch(currentLocale, (newLocale) => {
    updateDocumentDirection(newLocale);
  });

  return {
    currentLocale,
    currentLocaleOption,
    isRtl,
    availableLocales,
    setLocale,
  };
}
