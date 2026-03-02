import { computed, watch, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { setStoredLocale, type SupportedLocale, SUPPORTED_LOCALES } from "../i18n";

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

  const currentLocale = computed(() => locale.value as SupportedLocale);

  const currentLocaleOption = computed(
    () => availableLocales.find((l) => l.code === currentLocale.value) ?? availableLocales[0],
  );

  const isRtl = computed(() => currentLocaleOption.value.dir === "rtl");

  function setLocale(newLocale: SupportedLocale) {
    locale.value = newLocale;
    setStoredLocale(newLocale);
    updateDocumentDirection(newLocale);
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
