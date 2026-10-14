<script setup lang="ts">
/**
 * Un texte chaque jour : un psaume, une page qu'on aime, relus en entier.
 * C'est la lecture du jour d'avant ; on le cherche dans le catalogue comme
 * dans la bibliothèque.
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import textStudiesJson from "../../../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../../../models/models";
import { corpusOf } from "../../../content/etudeTexts";
import { texteTitle } from "../../../services/chiourTexte";
import { filterBySearch } from "../../../services/catalogSearch";
import CatalogSearchField from "../../CatalogSearchField.vue";

defineProps<{ taken: number[] }>();
const emit = defineEmits<{ (e: "pick", entry: TextStudyJsonEntry): void }>();

const { t, locale } = useI18n();

/** Ce qu'on étudie : la liturgie a sa page, le Sidour. */
const READABLE = new Set(["tehilim", "michna", "talmud", "tanakh", "moussar"]);
const texts = (textStudiesJson as TextStudiesJson).textStudies.filter((e) =>
  READABLE.has(corpusOf(e)),
);

const term = ref("");
const results = computed(() =>
  term.value.trim().length < 2 ? [] : filterBySearch(texts, term.value).slice(0, 8),
);
</script>

<template>
  <div>
    <CatalogSearchField v-model:term="term" :placeholder="t('parcours.create.searchAny')" />
    <div v-if="results.length" class="card mt-4 divide-y divide-line overflow-hidden">
      <button
        v-for="entry in results"
        :key="entry.id"
        type="button"
        class="flex min-h-14 w-full items-center px-4 py-2.5 text-start hover:bg-surface-soft disabled:opacity-60"
        :disabled="taken.includes(Number(entry.id))"
        @click="emit('pick', entry)"
      >
        <span class="min-w-0 flex-1">
          <span class="block text-[15px] font-bold">{{ texteTitle(entry, locale) }}</span>
          <span
            v-if="taken.includes(Number(entry.id))"
            class="block text-[13px] text-text-secondary"
          >
            {{ t("parcours.create.taken") }}
          </span>
        </span>
      </button>
    </div>
    <p v-else-if="term.trim().length >= 2" class="mt-4 text-sm text-text-secondary">
      {{ t("parcours.create.noText") }}
    </p>
    <p v-else class="mt-4 text-sm text-text-secondary">{{ t("parcours.create.dailyTextHint") }}</p>
  </div>
</template>
