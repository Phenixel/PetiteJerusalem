<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import textStudiesJson from "../../datas/textStudies.json";
import type { TextStudiesJson } from "../../models/models";
import { loadText, type TextContent, type TextSection } from "../../services/textService";

const route = useRoute();
const router = useRouter();

const textId = computed(() => String(route.params.textId));
const sectionParam = computed(() =>
  route.params.section ? Number(route.params.section) : undefined,
);

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;
const textEntry = computed(() => allTexts.find((t) => String(t.id) === textId.value) ?? null);

const loading = ref(false);
const error = ref<string | null>(null);
const content = ref<TextContent | null>(null);
const showTranslation = ref(false);

const isSingleSection = computed(
  () => content.value !== null && content.value.sections.length === 1,
);

const showSectionList = computed(
  () => !isSingleSection.value && sectionParam.value === undefined,
);

const currentSection = computed<TextSection | null>(() => {
  if (!content.value) return null;
  if (isSingleSection.value) return content.value.sections[0];
  if (sectionParam.value !== undefined) {
    return content.value.sections.find((s) => s.index === sectionParam.value) ?? null;
  }
  return null;
});

async function loadContent() {
  if (!textEntry.value) return;
  loading.value = true;
  error.value = null;
  content.value = null;
  try {
    content.value = await loadText(textEntry.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Erreur inconnue";
  } finally {
    loading.value = false;
  }
}

onMounted(loadContent);
watch(textId, loadContent);

function goToSection(index: number) {
  router.push({
    name: "text-reading-section",
    params: { textId: textId.value, section: index },
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
  if (!currentSection.value || !content.value) return;
  const idx = content.value.sections.indexOf(currentSection.value);
  if (idx > 0) goToSection(content.value.sections[idx - 1].index);
}

function nextSection() {
  if (!currentSection.value || !content.value) return;
  const idx = content.value.sections.indexOf(currentSection.value);
  if (idx < content.value.sections.length - 1)
    goToSection(content.value.sections[idx + 1].index);
}

const hasPrev = computed(() => {
  if (!currentSection.value || !content.value) return false;
  return content.value.sections.indexOf(currentSection.value) > 0;
});

const hasNext = computed(() => {
  if (!currentSection.value || !content.value) return false;
  const idx = content.value.sections.indexOf(currentSection.value);
  return idx < content.value.sections.length - 1;
});
</script>

<template>
  <div
    class="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950"
  >
    <!-- Header -->
    <div
      class="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-amber-100 dark:border-gray-800 shadow-sm"
    >
      <div class="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        <button
          @click="goBack"
          class="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary dark:text-gray-400 dark:hover:text-primary transition-colors flex-shrink-0"
        >
          <i class="fa-solid fa-arrow-left text-xs"></i>
          Retour
        </button>

        <div class="flex-1 min-w-0" v-if="textEntry">
          <p class="text-xs text-text-secondary dark:text-gray-500 truncate">
            {{ textEntry.livre }}
          </p>
          <h1 class="text-sm font-semibold text-text-primary dark:text-gray-100 truncate">
            {{ textEntry.name }}
            <span
              v-if="currentSection && !isSingleSection"
              class="text-text-secondary dark:text-gray-400 font-normal"
            >
              — {{ currentSection.label }}
            </span>
          </h1>
        </div>

        <button
          v-if="currentSection"
          @click="showTranslation = !showTranslation"
          class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors flex-shrink-0"
          :class="
            showTranslation
              ? 'bg-primary text-white border-primary'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-text-secondary dark:text-gray-400 hover:border-primary hover:text-primary'
          "
        >
          <i class="fa-solid fa-language"></i>
          EN
        </button>
      </div>
    </div>

    <div class="max-w-3xl mx-auto px-4 py-8">
      <!-- Text not found -->
      <div v-if="!textEntry" class="text-center py-16 text-text-secondary dark:text-gray-400">
        <i class="fa-solid fa-circle-exclamation text-3xl mb-3 block"></i>
        <p>Texte introuvable.</p>
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="flex flex-col items-center justify-center py-24 gap-4">
        <div
          class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"
        ></div>
        <p class="text-text-secondary dark:text-gray-400 text-sm">Chargement…</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-16">
        <i class="fa-solid fa-triangle-exclamation text-amber-500 text-3xl mb-3 block"></i>
        <p class="text-text-secondary dark:text-gray-400 mb-4">{{ error }}</p>
        <button
          @click="loadContent"
          class="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-colors"
        >
          Réessayer
        </button>
      </div>

      <!-- Section grid (multi-section texts) -->
      <div v-else-if="content && showSectionList">
        <div class="text-center mb-8">
          <h2 class="text-2xl font-bold text-text-primary dark:text-gray-100 mb-1">
            {{ content.title }}
          </h2>
          <p class="text-text-secondary dark:text-gray-400 text-sm">
            {{ content.sections.length }} section{{ content.sections.length > 1 ? "s" : "" }}
          </p>
        </div>

        <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          <button
            v-for="section in content.sections"
            :key="section.index"
            @click="goToSection(section.index)"
            class="aspect-square rounded-xl border border-amber-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-text-primary dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-gray-700 hover:border-primary dark:hover:border-primary transition-all hover:scale-105 hover:shadow-md flex items-center justify-center p-1 text-center leading-tight"
          >
            {{ section.label.replace("Chapitre ", "").replace("Daf ", "") }}
          </button>
        </div>
      </div>

      <!-- Text content -->
      <div v-else-if="content && currentSection">
        <!-- Navigation haut -->
        <div
          v-if="!isSingleSection"
          class="flex items-center justify-between mb-6"
        >
          <button
            @click="prevSection"
            :disabled="!hasPrev"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            :class="
              !hasPrev
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'text-text-secondary dark:text-gray-400 hover:text-primary hover:bg-amber-50 dark:hover:bg-gray-800'
            "
          >
            <i class="fa-solid fa-chevron-right text-xs"></i>
            Précédent
          </button>

          <span
            class="text-xs text-text-secondary dark:text-gray-500 bg-amber-50 dark:bg-gray-800 px-3 py-1 rounded-full border border-amber-100 dark:border-gray-700"
          >
            {{ currentSection.label }}
          </span>

          <button
            @click="nextSection"
            :disabled="!hasNext"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            :class="
              !hasNext
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'text-text-secondary dark:text-gray-400 hover:text-primary hover:bg-amber-50 dark:hover:bg-gray-800'
            "
          >
            Suivant
            <i class="fa-solid fa-chevron-left text-xs"></i>
          </button>
        </div>

        <!-- Versets / lignes -->
        <div class="space-y-4">
          <div
            v-for="(line, index) in currentSection.he"
            :key="index"
            class="group"
          >
            <div class="flex items-start gap-3">
              <span
                class="mt-1.5 flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-amber-100 dark:bg-gray-800 text-xs text-amber-700 dark:text-amber-400 font-semibold select-none"
              >
                {{ index + 1 }}
              </span>

              <div class="flex-1 space-y-2">
                <p
                  dir="rtl"
                  class="text-lg leading-loose text-text-primary dark:text-gray-100 font-medium"
                  style="font-family: 'Noto Serif Hebrew', 'David Libre', 'Times New Roman', serif"
                >
                  {{ line }}
                </p>

                <p
                  v-if="showTranslation && currentSection.en[index]"
                  class="text-sm leading-relaxed text-text-secondary dark:text-gray-400 border-l-2 border-amber-200 dark:border-gray-700 pl-3 italic"
                >
                  {{ currentSection.en[index] }}
                </p>
              </div>
            </div>

            <div class="mt-3 border-b border-amber-50 dark:border-gray-800/60"></div>
          </div>
        </div>

        <!-- Navigation bas -->
        <div
          v-if="!isSingleSection"
          class="flex items-center justify-between mt-10 pt-6 border-t border-amber-100 dark:border-gray-800"
        >
          <button
            @click="prevSection"
            :disabled="!hasPrev"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all"
            :class="
              !hasPrev
                ? 'text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-800 cursor-not-allowed'
                : 'border-amber-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-amber-50 dark:hover:bg-gray-800'
            "
          >
            <i class="fa-solid fa-chevron-right text-xs"></i>
            Précédent
          </button>

          <button
            @click="goBack"
            class="text-xs text-text-secondary dark:text-gray-500 hover:text-primary transition-colors"
          >
            Toutes les sections
          </button>

          <button
            @click="nextSection"
            :disabled="!hasNext"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all"
            :class="
              !hasNext
                ? 'text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-800 cursor-not-allowed'
                : 'border-amber-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-amber-50 dark:hover:bg-gray-800'
            "
          >
            Suivant
            <i class="fa-solid fa-chevron-left text-xs"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
