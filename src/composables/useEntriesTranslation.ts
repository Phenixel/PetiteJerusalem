import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { TextStudyJsonEntry } from "../models/models";
import { translationLangs } from "../services/textService";
import { pickTranslationLang, TRANSLATION_LANGS, translationLangChoice } from "./useTranslation";

/**
 * The « Translation » setting of a page that reads several texts one after
 * the other (the chnei mikra, the Tehilim of the day, the daily reading of
 * Mon parcours, a session's texts): each text (DailyReadingItem) follows the
 * setting on its own, and the reading menu needs to know whether to offer
 * it, and in which languages.
 *
 * `langs` are the languages at least one of the texts is translated into,
 * the interface's first (as in the library reader); `lang` is the one the
 * translation would take. Empty while the index is read, and offline (the
 * index cannot be read): the menu then offers no command that would fail.
 */
export function useEntriesTranslation(entries: () => TextStudyJsonEntry[]) {
  const { locale } = useI18n();
  const available = ref<string[]>([]);

  let sequence = 0;
  watch(
    () =>
      entries()
        .map((entry) => entry.id)
        .join(","),
    async () => {
      const mine = ++sequence;
      const perEntry = await Promise.all(entries().map((entry) => translationLangs(entry)));
      if (mine !== sequence) return;
      available.value = TRANSLATION_LANGS.filter((lang) =>
        perEntry.some((langs) => langs.includes(lang)),
      );
    },
    { immediate: true },
  );

  const langs = computed(() =>
    [...available.value].sort((a, b) => Number(b === locale.value) - Number(a === locale.value)),
  );
  const lang = computed(() =>
    pickTranslationLang(available.value, locale.value, translationLangChoice.value),
  );

  return { langs, lang };
}
