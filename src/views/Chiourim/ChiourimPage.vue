<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { chiourService } from "../../services/chiourService";
import type { Chiour } from "../../models/models";
import ChiourCard from "../../components/ChiourCard.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import AccountCta from "../../components/AccountCta.vue";
import { seoService } from "../../services/seoService";

const { t } = useI18n();

const chiourim = ref<Chiour[]>([]);
const dynamicCategories = ref<string[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);
const searchTerm = ref("");
const selectedCategory = ref<string>("all");

const loadChiourim = async () => {
  error.value = null;

  // Show cached data instantly if available
  const cached = chiourService.getCachedChiourim();
  if (cached) {
    chiourim.value = cached;
    isLoading.value = false;
  }

  if (cached && !chiourService.isCacheStale()) {
    // Cache fresh, just load categories for this component instance
    chiourService
      .getCategories()
      .then((cats) => {
        dynamicCategories.value = cats;
      })
      .catch(() => {});
    return;
  }

  // No cache or stale, fetch fresh data
  if (!cached) isLoading.value = true;
  try {
    const [fetchedChiourim, fetchedCategories] = await Promise.all([
      chiourService.getAllChiourim(),
      chiourService.getCategories(),
    ]);
    chiourim.value = fetchedChiourim;
    dynamicCategories.value = fetchedCategories;
  } catch (err) {
    if (!cached) {
      console.error("Erreur lors du chargement des chiourim:", err);
      error.value = err instanceof Error ? err.message : t("chiourim.loadError");
    }
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
  const url = window.location.origin + "/chiourim";
  seoService.setMeta({
    title: t("seo.chiourimTitle"),
    description: t("seo.chiourimDescription"),
    canonical: url,
    og: { url },
  });
});
</script>

<template>
  <main class="mx-auto px-6 py-12">
    <!-- Header -->
    <div class="text-center mb-12 animate-[fadeIn_0.5s_ease]">
      <h2 class="text-4xl md:text-5xl font-bold text-text-primary mb-4 tracking-tight">
        {{ t("chiourim.title") }}
      </h2>
      <p class="text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
        {{ t("chiourim.subtitle") }}
      </p>
    </div>

    <!-- Filtres -->
    <div
      class="mb-10 flex flex-col md:flex-row gap-4 items-center justify-center animate-[fadeIn_0.5s_ease]"
    >
      <!-- Barre de recherche -->
      <div class="relative w-full md:w-96">
        <AppIcon
          name="search"
          :size="16"
          class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/70 pointer-events-none"
        />
        <input
          v-model="searchTerm"
          type="text"
          :placeholder="t('chiourim.searchPlaceholder')"
          class="field !pl-11"
        />
        <button
          v-if="searchTerm"
          @click="searchTerm = ''"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/70 hover:text-text-primary transition-colors"
        >
          <AppIcon name="x" :size="14" />
        </button>
      </div>

      <!-- Filtre par catégorie -->
      <div class="flex flex-wrap gap-2 justify-center">
        <button
          @click="selectedCategory = 'all'"
          class="chip transition-colors"
          :class="
            selectedCategory === 'all'
              ? 'bg-primary text-white'
              : 'bg-black/5 text-text-secondary hover:text-text-primary dark:bg-white/10'
          "
        >
          {{ t("chiourim.allCategories") }}
        </button>
        <button
          v-for="cat in dynamicCategories"
          :key="cat"
          @click="selectedCategory = cat"
          class="chip transition-colors"
          :class="
            selectedCategory === cat
              ? 'bg-primary text-white'
              : 'bg-black/5 text-text-secondary hover:text-text-primary dark:bg-white/10'
          "
        >
          {{ cat }}
        </button>
      </div>
    </div>

    <div class="relative">
      <!-- Skeleton loading -->
      <div v-if="isLoading">
        <h3 class="text-2xl font-bold text-text-primary mb-6 flex items-baseline gap-3">
          {{ t("chiourim.availableChiourim") }}
          <span class="h-5 w-8 bg-black/10 rounded-lg animate-pulse dark:bg-white/10"></span>
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="n in 6" :key="n" class="card p-6 animate-pulse">
            <!-- Titre -->
            <div class="mb-3">
              <div class="h-5 bg-black/10 rounded-lg w-3/4 dark:bg-white/10"></div>
            </div>

            <!-- Badges catégories -->
            <div class="flex gap-2 mb-3">
              <div class="h-6 w-20 bg-primary/10 rounded-lg"></div>
              <div class="h-6 w-16 bg-primary/10 rounded-lg"></div>
            </div>

            <!-- Description -->
            <div class="space-y-2 mb-4">
              <div class="h-3 bg-black/10 rounded w-full dark:bg-white/10"></div>
              <div class="h-3 bg-black/10 rounded w-5/6 dark:bg-white/10"></div>
            </div>

            <!-- Auteur + niveau -->
            <div class="flex items-center gap-4 mb-3">
              <div class="h-4 bg-black/10 rounded w-28 dark:bg-white/10"></div>
              <div class="h-4 bg-black/10 rounded w-16 dark:bg-white/10"></div>
            </div>

            <!-- Footer -->
            <div class="pt-3">
              <div class="h-3 bg-black/10 rounded w-20 ml-auto dark:bg-white/10"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="flex flex-col items-center justify-center py-16 text-center">
        <AppIcon name="alert-triangle" :size="32" class="text-red-500 mb-4" />
        <p class="text-text-primary font-medium mb-6">{{ error }}</p>
        <button @click="loadChiourim" class="btn btn-soft">
          {{ t("common.retry") }}
        </button>
      </div>

      <!-- Liste des chiourim -->
      <div v-else-if="chiourim.length > 0">
        <div class="mb-6 animate-[fadeIn_0.5s_ease]">
          <h3 class="text-2xl font-bold text-text-primary mb-6 flex items-baseline gap-3">
            {{ t("chiourim.availableChiourim") }}
            <span class="text-sm font-normal text-text-secondary">{{ chiourimCount }}</span>
          </h3>

          <div
            v-if="filteredChiourim.length > 0"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <ChiourCard
              v-for="chiour in filteredChiourim"
              :key="chiour.name"
              :chiour="chiour"
              class="h-full"
            />
          </div>

          <!-- Aucun résultat de recherche -->
          <div v-else class="flex flex-col items-center justify-center py-16 text-center">
            <AppIcon name="search" :size="32" class="text-text-secondary/40 mb-4" />
            <p class="text-text-secondary text-lg">
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
      <div v-else class="flex flex-col items-center justify-center py-20 text-center">
        <AppIcon
          name="graduation-cap"
          :size="40"
          class="text-primary/50 mb-6"
          :stroke-width="1.75"
        />
        <h4 class="text-2xl font-bold text-text-primary mb-2">
          {{ t("chiourim.noChiourim") }}
        </h4>
        <p class="text-text-secondary">
          {{ t("chiourim.noChiourimDesc") }}
        </p>
      </div>
    </div>

    <AccountCta class="max-w-3xl mx-auto mt-12" />
  </main>
</template>
