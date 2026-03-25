<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { chiourService } from "../../services/chiourService";
import type { Chiour, ChiourCategory } from "../../models/models";
import ChiourCard from "../../components/ChiourCard.vue";
import { seoService } from "../../services/seoService";
import { authService } from "../../services/authService";

const { t } = useI18n();

const chiourim = ref<Chiour[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);
const isAuthenticated = ref(false);
const searchTerm = ref("");
const selectedCategory = ref<ChiourCategory | "all">("all");
let unsubscribeAuth: (() => void) | null = null;

const categories: Array<{ value: ChiourCategory | "all"; labelKey: string }> = [
  { value: "all", labelKey: "chiourim.allCategories" },
  { value: "guemara", labelKey: "chiourim.categories.guemara" },
  { value: "halakha", labelKey: "chiourim.categories.halakha" },
  { value: "paracha", labelKey: "chiourim.categories.paracha" },
  { value: "moussar", labelKey: "chiourim.categories.moussar" },
  { value: "hassidout", labelKey: "chiourim.categories.hassidout" },
  { value: "other", labelKey: "chiourim.categories.other" },
];

const loadChiourim = async () => {
  try {
    isLoading.value = true;
    error.value = null;
    const fetched = await chiourService.getAllChiourim();
    chiourim.value = chiourService.sortByDate(fetched);
  } catch (err) {
    console.error("Erreur lors du chargement des chiourim:", err);
    error.value = err instanceof Error ? err.message : t("chiourim.loadError");
  } finally {
    isLoading.value = false;
  }
};

const filteredChiourim = computed(() => {
  let result = chiourim.value;
  result = chiourService.filterByCategory(result, selectedCategory.value);
  result = chiourService.filterBySearch(result, searchTerm.value);
  return result;
});

const chiourimCount = computed(() => filteredChiourim.value.length);

onMounted(() => {
  loadChiourim();
  unsubscribeAuth = authService.onAuthChanged((user) => {
    isAuthenticated.value = !!user;
  });
  const url = window.location.origin + "/chiourim";
  seoService.setMeta({
    title: t("seo.chiourimTitle"),
    description: t("seo.chiourimDescription"),
    canonical: url,
    og: { url },
  });
});

onUnmounted(() => {
  if (unsubscribeAuth) unsubscribeAuth();
});
</script>

<template>
  <main class="mx-auto px-6 py-12">
    <!-- Header -->
    <div class="text-center mb-12 animate-[fadeIn_0.5s_ease]">
      <h2
        class="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-4 tracking-tight"
      >
        {{ t("chiourim.title") }}
      </h2>
      <p class="text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed dark:text-gray-300">
        {{ t("chiourim.subtitle") }}
      </p>
    </div>

    <!-- Filtres -->
    <div
      class="mb-10 flex flex-col md:flex-row gap-4 items-center justify-center animate-[fadeIn_0.5s_ease]"
    >
      <!-- Barre de recherche -->
      <div class="relative w-full md:w-96">
        <i
          class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/60 dark:text-gray-500"
        ></i>
        <input
          v-model="searchTerm"
          type="text"
          :placeholder="t('chiourim.searchPlaceholder')"
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

      <!-- Filtre par catégorie -->
      <div class="flex flex-wrap gap-2 justify-center">
        <button
          v-for="cat in categories"
          :key="cat.value"
          @click="selectedCategory = cat.value"
          :class="[
            'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border',
            selectedCategory === cat.value
              ? 'bg-primary text-white border-primary shadow-md'
              : 'bg-white/60 text-text-secondary border-white/60 hover:bg-white/80 hover:text-text-primary dark:bg-gray-800/40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200',
          ]"
        >
          {{ t(cat.labelKey) }}
        </button>
      </div>
    </div>

    <div class="relative">
      <!-- Loading -->
      <div
        v-if="isLoading"
        class="flex flex-col items-center justify-center py-20 bg-white/50 backdrop-blur-sm rounded-2xl dark:bg-gray-900/60"
      >
        <div
          class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"
        ></div>
        <p class="text-text-secondary font-medium animate-pulse dark:text-gray-300">
          {{ t("chiourim.loading") }}
        </p>
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        class="flex flex-col items-center justify-center p-12 text-center bg-red-50 rounded-2xl border border-red-100 dark:bg-red-900/10 dark:border-red-900/30"
      >
        <div
          class="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-2xl mb-4 dark:bg-red-900/20 dark:text-red-400"
        >
          <i class="fa-solid fa-exclamation-triangle"></i>
        </div>
        <p class="text-red-700 font-medium mb-6 dark:text-red-400">{{ error }}</p>
        <button
          @click="loadChiourim"
          class="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
        >
          {{ t("common.retry") }}
        </button>
      </div>

      <!-- Liste des chiourim -->
      <div v-else-if="chiourim.length > 0">
        <div class="mb-6 animate-[fadeIn_0.5s_ease]">
          <h3
            class="text-2xl font-bold text-text-primary mb-6 flex items-center gap-3 dark:text-gray-100"
          >
            <i class="fa-solid fa-graduation-cap text-primary"></i>
            {{ t("chiourim.availableChiourim") }}
            <span
              class="text-sm font-normal text-text-secondary bg-gray-100 px-3 py-1 rounded-full dark:bg-gray-800 dark:text-gray-400"
            >
              {{ chiourimCount }}
            </span>
          </h3>

          <div
            v-if="filteredChiourim.length > 0"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <ChiourCard
              v-for="chiour in filteredChiourim"
              :key="chiour.id"
              :chiour="chiour"
              class="h-full"
            />
          </div>

          <!-- Aucun résultat de recherche -->
          <div
            v-else
            class="flex flex-col items-center justify-center py-12 bg-white/40 backdrop-blur-sm rounded-xl border border-white/60 dark:bg-gray-800/40 dark:border-gray-700"
          >
            <div class="text-4xl mb-4">
              <i class="fa-solid fa-magnifying-glass text-text-secondary/40"></i>
            </div>
            <p class="text-text-secondary text-lg dark:text-gray-400">
              {{ t("chiourim.noResults") }}
            </p>
            <button
              @click="
                searchTerm = '';
                selectedCategory = 'all';
              "
              class="mt-4 text-primary font-medium hover:underline"
            >
              {{ t("chiourim.clearFilters") }}
            </button>
          </div>
        </div>
      </div>

      <!-- Aucun chiour -->
      <div
        v-else
        class="flex flex-col items-center justify-center py-20 text-center bg-white/60 backdrop-blur-sm rounded-3xl border border-white/60 dark:bg-gray-800/40 dark:border-gray-700"
      >
        <div class="text-6xl mb-6">
          <i class="fa-solid fa-graduation-cap text-text-secondary/30"></i>
        </div>
        <h4 class="text-2xl font-bold text-text-primary mb-2 dark:text-gray-200">
          {{ t("chiourim.noChiourim") }}
        </h4>
        <p class="text-text-secondary dark:text-gray-400">
          {{ t("chiourim.noChiourimDesc") }}
        </p>
      </div>
    </div>
  </main>
</template>
