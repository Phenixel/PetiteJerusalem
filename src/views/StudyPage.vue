<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { sessionService } from "../services/sessionService";
import { seoService } from "../services/seoService";
import { appendHebrewNumeral } from "../services/hebrewNumerals";
import { hubPath } from "../content/etudeTexts";

const { t } = useI18n();

const ALL_TYPE = "Tout";

const TYPES = [
  { key: ALL_TYPE, labelKey: "study.types.all" },
  { key: "Tehilim", labelKey: "study.types.tehilim" },
  { key: "Mishna", labelKey: "study.types.mishna" },
  { key: "Talmud Bavli", labelKey: "study.types.talmud" },
  { key: "Tanakh", labelKey: "study.types.tanakh" },
];

// Type tabs that map to an actual corpus (everything except the "Tout" tab).
const CORPUS_TYPES = TYPES.filter((ty) => ty.key !== ALL_TYPE);

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;
const selectedType = ref(ALL_TYPE);
const searchTerm = ref("");

// "Tout" shows every corpus at once; any other tab stays scoped to itself.
const isAllSelected = computed(() => selectedType.value === ALL_TYPE);

const filtered = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();
  return allTexts.filter((txt) => {
    const matchesTerm = term === "" || txt.name.toLowerCase().includes(term);
    const matchesType = isAllSelected.value || String(txt.type) === selectedType.value;
    return matchesTerm && matchesType;
  });
});

// Group results by type (a type heading is only shown on the "Tout" tab), then
// by book/seder, so each section stays readable.
const groupedByType = computed(() => {
  return CORPUS_TYPES.map((ty) => {
    const texts = filtered.value.filter((txt) => String(txt.type) === ty.key);
    const groups: Record<string, TextStudyJsonEntry[]> = {};
    for (const txt of texts) {
      (groups[txt.livre] ??= []).push(txt);
    }
    return { key: ty.key, labelKey: ty.labelKey, groups, count: texts.length };
  }).filter((group) => group.count > 0);
});

const hasResults = computed(() => filtered.value.length > 0);

function formatBookName(livre: string): string {
  return sessionService.formatBookName(livre);
}

onMounted(() => {
  const url = window.location.origin + "/bibliotheque";
  seoService.setMeta({
    title: `${t("study.title")} | Petite Jérusalem`,
    description: t("study.subtitle"),
    canonical: url,
  });
});
</script>

<template>
  <main class="mx-auto px-6 py-12">
    <!-- Hero -->
    <div class="text-center mb-10">
      <h1
        class="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-4 tracking-tight pb-1"
      >
        {{ t("study.title") }}
      </h1>
      <p class="text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed dark:text-gray-300">
        {{ t("study.subtitle") }}
      </p>
    </div>

    <!-- Controls -->
    <div class="flex flex-col items-center gap-4 mb-10">
      <div class="relative w-full md:w-96">
        <i
          class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/60 dark:text-gray-500"
        ></i>
        <input
          v-model="searchTerm"
          type="text"
          :placeholder="t('study.searchPlaceholder')"
          class="w-full pl-11 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-white/60 rounded-xl text-text-primary placeholder-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all dark:bg-gray-800/60 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
        />
        <button
          v-if="searchTerm"
          @click="searchTerm = ''"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/60 hover:text-text-primary transition-colors dark:text-gray-500 dark:hover:text-gray-300"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="flex flex-wrap gap-2 justify-center">
        <button
          v-for="ty in TYPES"
          :key="ty.key"
          @click="selectedType = ty.key"
          :class="[
            'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border',
            selectedType === ty.key
              ? 'bg-primary text-white border-primary shadow-md'
              : 'bg-white/60 text-text-secondary border-white/60 hover:bg-white/80 hover:text-text-primary dark:bg-gray-800/40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200',
          ]"
        >
          {{ t(ty.labelKey) }}
        </button>
      </div>
    </div>

    <!-- Results -->
    <div v-if="hasResults" class="max-w-5xl mx-auto space-y-12">
      <div v-for="typeGroup in groupedByType" :key="typeGroup.key" class="space-y-10">
        <!-- Type heading: shown only on the "Tout" tab, where several corpora mix. -->
        <h2
          v-if="isAllSelected"
          class="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
        >
          {{ t(typeGroup.labelKey) }}
        </h2>
        <section v-for="(texts, livre) in typeGroup.groups" :key="livre">
          <h3
            class="text-xl font-bold text-text-primary mb-4 pl-3 border-l-4 border-primary dark:text-gray-100"
          >
            {{ formatBookName(String(livre)) }}
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <router-link
              v-for="text in texts"
              :key="text.id"
              :to="hubPath(text)"
              class="flex items-center justify-between gap-2 p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/40 hover:border-primary hover:shadow-md transition-all group dark:bg-gray-800/60 dark:border-gray-700 dark:hover:border-primary"
            >
              <span class="min-w-0">
                <span class="block font-medium text-text-primary truncate dark:text-gray-200">
                  {{ appendHebrewNumeral(text.name) }}
                </span>
                <span
                  v-if="text.totalSections > 1"
                  class="text-xs text-text-secondary dark:text-gray-500"
                >
                  {{ t("study.sections", { count: text.totalSections }) }}
                </span>
              </span>
              <i
                class="fa-solid fa-book-open text-text-secondary/40 group-hover:text-primary transition-colors flex-shrink-0"
              ></i>
            </router-link>
          </div>
        </section>
      </div>
    </div>

    <!-- Empty -->
    <div v-else class="text-center py-16 text-text-secondary dark:text-gray-400">
      <i class="fa-solid fa-magnifying-glass text-3xl mb-3 block opacity-40"></i>
      <p>{{ t("study.noResults") }}</p>
    </div>
  </main>
</template>
