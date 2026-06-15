<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import textStudiesJson from "../../datas/textStudies.json";
import type { TextStudiesJson } from "../../models/models";
import { fetchSefariaText, getSefariaRef, type SefariaText } from "../../services/sefariaService";

const route = useRoute();
const router = useRouter();

const textId = computed(() => String(route.params.textId));
const sectionParam = computed(() =>
  route.params.section ? Number(route.params.section) : undefined,
);

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;

const textEntry = computed(() =>
  allTexts.find((t) => String(t.id) === textId.value) ?? null,
);

const showChapterList = computed(
  () => textEntry.value !== null && textEntry.value.totalSections > 1 && sectionParam.value === undefined,
);

const sefariaRef = computed(() => {
  if (!textEntry.value) return null;
  return getSefariaRef(textEntry.value.link, sectionParam.value);
});

const loading = ref(false);
const error = ref<string | null>(null);
const content = ref<SefariaText | null>(null);
const showTranslation = ref(false);

async function loadText() {
  if (!sefariaRef.value || showChapterList.value) return;
  loading.value = true;
  error.value = null;
  content.value = null;
  try {
    content.value = await fetchSefariaText(sefariaRef.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Erreur inconnue";
  } finally {
    loading.value = false;
  }
}

onMounted(loadText);
watch([sefariaRef, showChapterList], loadText);

function goToChapter(chapter: number) {
  router.push({
    name: "text-reading-section",
    params: { textId: textId.value, section: chapter },
  });
}

function goBack() {
  if (sectionParam.value !== undefined) {
    router.push({ name: "text-reading", params: { textId: textId.value } });
  } else {
    router.back();
  }
}

function prevSection() {
  if (sectionParam.value !== undefined && sectionParam.value > 1) {
    goToChapter(sectionParam.value - 1);
  }
}

function nextSection() {
  if (
    textEntry.value &&
    sectionParam.value !== undefined &&
    sectionParam.value < textEntry.value.totalSections
  ) {
    goToChapter(sectionParam.value + 1);
  }
}

const chapters = computed(() =>
  textEntry.value
    ? Array.from({ length: textEntry.value.totalSections }, (_, i) => i + 1)
    : [],
);
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
    <!-- Header -->
    <div class="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-amber-100 dark:border-gray-800 shadow-sm">
      <div class="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        <button
          @click="goBack"
          class="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary dark:text-gray-400 dark:hover:text-primary transition-colors"
        >
          <i class="fa-solid fa-arrow-left text-xs"></i>
          Retour
        </button>

        <div class="flex-1 min-w-0" v-if="textEntry">
          <p class="text-xs text-text-secondary dark:text-gray-500 truncate">{{ textEntry.livre }}</p>
          <h1 class="text-sm font-semibold text-text-primary dark:text-gray-100 truncate">
            {{ textEntry.name }}
            <span v-if="sectionParam" class="text-text-secondary dark:text-gray-400 font-normal">
              — Chapitre {{ sectionParam }}
            </span>
          </h1>
        </div>

        <button
          v-if="content"
          @click="showTranslation = !showTranslation"
          class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors"
          :class="showTranslation
            ? 'bg-primary text-white border-primary'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-text-secondary dark:text-gray-400 hover:border-primary hover:text-primary'"
        >
          <i class="fa-solid fa-language"></i>
          Traduction
        </button>
      </div>
    </div>

    <div class="max-w-3xl mx-auto px-4 py-8">

      <!-- Text not found -->
      <div v-if="!textEntry" class="text-center py-16 text-text-secondary dark:text-gray-400">
        <i class="fa-solid fa-circle-exclamation text-3xl mb-3"></i>
        <p>Texte introuvable.</p>
      </div>

      <!-- Chapter list (for multi-section texts) -->
      <div v-else-if="showChapterList">
        <div class="text-center mb-8">
          <h2 class="text-2xl font-bold text-text-primary dark:text-gray-100 mb-1">
            {{ textEntry.name }}
          </h2>
          <p class="text-text-secondary dark:text-gray-400 text-sm">
            {{ textEntry.totalSections }} chapitre{{ textEntry.totalSections > 1 ? "s" : "" }}
          </p>
        </div>

        <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          <button
            v-for="ch in chapters"
            :key="ch"
            @click="goToChapter(ch)"
            class="aspect-square rounded-xl border border-amber-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-text-primary dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-gray-700 hover:border-primary dark:hover:border-primary transition-all hover:scale-105 hover:shadow-md"
          >
            {{ ch }}
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="flex flex-col items-center justify-center py-24 gap-4">
        <div class="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p class="text-text-secondary dark:text-gray-400 text-sm">Chargement du texte…</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-16">
        <i class="fa-solid fa-triangle-exclamation text-amber-500 text-3xl mb-3"></i>
        <p class="text-text-secondary dark:text-gray-400 mb-4">{{ error }}</p>
        <button
          @click="loadText"
          class="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-colors"
        >
          Réessayer
        </button>
      </div>

      <!-- Text content -->
      <div v-else-if="content">
        <!-- Navigation chapitres -->
        <div
          v-if="textEntry && textEntry.totalSections > 1 && sectionParam"
          class="flex items-center justify-between mb-6"
        >
          <button
            @click="prevSection"
            :disabled="sectionParam <= 1"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            :class="sectionParam <= 1
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'text-text-secondary dark:text-gray-400 hover:text-primary hover:bg-amber-50 dark:hover:bg-gray-800'"
          >
            <i class="fa-solid fa-chevron-right text-xs"></i>
            Chapitre {{ sectionParam - 1 }}
          </button>

          <span class="text-xs text-text-secondary dark:text-gray-500 bg-amber-50 dark:bg-gray-800 px-3 py-1 rounded-full border border-amber-100 dark:border-gray-700">
            {{ sectionParam }} / {{ textEntry.totalSections }}
          </span>

          <button
            @click="nextSection"
            :disabled="sectionParam >= textEntry.totalSections"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            :class="sectionParam >= textEntry.totalSections
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'text-text-secondary dark:text-gray-400 hover:text-primary hover:bg-amber-50 dark:hover:bg-gray-800'"
          >
            Chapitre {{ sectionParam + 1 }}
            <i class="fa-solid fa-chevron-left text-xs"></i>
          </button>
        </div>

        <!-- Référence -->
        <p class="text-center text-xs text-text-secondary dark:text-gray-500 mb-6" v-if="content.heRef">
          {{ content.heRef }}
        </p>

        <!-- Versets -->
        <div class="space-y-4">
          <div
            v-for="(verse, index) in content.he"
            :key="index"
            class="group"
          >
            <!-- Numéro de verset -->
            <div class="flex items-start gap-3">
              <span class="mt-1 flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-amber-100 dark:bg-gray-800 text-xs text-amber-700 dark:text-amber-400 font-semibold select-none">
                {{ index + 1 }}
              </span>

              <div class="flex-1 space-y-2">
                <!-- Texte hébreu -->
                <p
                  dir="rtl"
                  class="text-lg leading-loose text-text-primary dark:text-gray-100 font-medium"
                  style="font-family: 'Noto Serif Hebrew', 'David Libre', 'Times New Roman', serif;"
                  v-html="verse"
                ></p>

                <!-- Traduction anglaise -->
                <p
                  v-if="showTranslation && content.text[index]"
                  class="text-sm leading-relaxed text-text-secondary dark:text-gray-400 border-l-2 border-amber-200 dark:border-gray-700 pl-3 italic"
                  v-html="content.text[index]"
                ></p>
              </div>
            </div>

            <div class="mt-3 border-b border-amber-50 dark:border-gray-800/60"></div>
          </div>
        </div>

        <!-- Navigation bas de page -->
        <div
          v-if="textEntry && textEntry.totalSections > 1 && sectionParam"
          class="flex items-center justify-between mt-10 pt-6 border-t border-amber-100 dark:border-gray-800"
        >
          <button
            @click="prevSection"
            :disabled="sectionParam <= 1"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all"
            :class="sectionParam <= 1
              ? 'text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-800 cursor-not-allowed'
              : 'border-amber-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-amber-50 dark:hover:bg-gray-800'"
          >
            <i class="fa-solid fa-chevron-right text-xs"></i>
            Précédent
          </button>

          <button
            @click="goBack"
            class="text-xs text-text-secondary dark:text-gray-500 hover:text-primary transition-colors"
          >
            Tous les chapitres
          </button>

          <button
            @click="nextSection"
            :disabled="sectionParam >= textEntry.totalSections"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all"
            :class="sectionParam >= textEntry.totalSections
              ? 'text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-800 cursor-not-allowed'
              : 'border-amber-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-amber-50 dark:hover:bg-gray-800'"
          >
            Suivant
            <i class="fa-solid fa-chevron-left text-xs"></i>
          </button>
        </div>

        <!-- Attribution Sefaria -->
        <div class="mt-10 pt-6 border-t border-amber-100 dark:border-gray-800 text-center">
          <p class="text-xs text-text-secondary dark:text-gray-600">
            Texte fourni par
            <a
              href="https://www.sefaria.org"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:underline"
            >Sefaria</a>
            (licence CC BY-NC)
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
