<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { chiourService } from "../../services/chiourService";
import type { Chiour } from "../../models/models";
import ChiourCard from "../../components/ChiourCard.vue";
import { seoService } from "../../services/seoService";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const auteurName = ref<string | null>(null);
const chiourim = ref<Chiour[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);
const searchTerm = ref("");

const filteredChiourim = computed(() => {
  return chiourService.filterBySearch(chiourim.value, searchTerm.value);
});

const categories = computed(() => {
  const cats = new Set<string>();
  for (const c of chiourim.value) {
    for (const cat of c.categories) cats.add(cat);
  }
  return Array.from(cats).sort();
});

const loadAuteur = async () => {
  try {
    isLoading.value = true;
    error.value = null;

    const slug = route.params.auteur as string;
    const all = await chiourService.getAllChiourim();

    const name = chiourService.findAuteurBySlug(all, slug);
    if (!name) {
      error.value = t("auteurPage.notFound");
      return;
    }

    auteurName.value = name;
    chiourim.value = chiourService.filterByAuteur(all, name);

    seoService.setMeta({
      title: `${name} – ${t("chiourim.title")} – Petite Jerusalem`,
      description: t("auteurPage.seoDescription", { auteur: name }),
      canonical: window.location.origin + `/chiourim/auteur/${slug}`,
    });
  } catch (err) {
    console.error("Erreur lors du chargement de l'auteur:", err);
    error.value = err instanceof Error ? err.message : t("chiourim.loadError");
  } finally {
    isLoading.value = false;
  }
};

onMounted(loadAuteur);
watch(() => route.params.auteur, loadAuteur);
</script>

<template>
  <main class="mx-auto px-6 py-12 max-w-6xl">
    <!-- Back button -->
    <button
      @click="router.push('/chiourim')"
      class="mb-8 flex items-center gap-2 text-text-secondary hover:text-primary transition-colors group dark:text-gray-400 dark:hover:text-primary"
    >
      <i class="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
      {{ t("detailChiour.backToList") }}
    </button>

    <!-- Skeleton loading -->
    <div v-if="isLoading" class="animate-pulse">
      <div class="text-center mb-12">
        <div class="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-4 dark:bg-gray-700"></div>
        <div class="h-8 bg-gray-200 rounded-lg w-48 mx-auto mb-3 dark:bg-gray-700"></div>
        <div class="h-4 bg-gray-200 rounded w-32 mx-auto dark:bg-gray-700"></div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="n in 3"
          :key="n"
          class="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-white/60 dark:bg-gray-800/60 dark:border-gray-700 animate-pulse"
        >
          <div class="h-5 bg-gray-200 rounded-lg w-3/4 mb-3 dark:bg-gray-700"></div>
          <div class="flex gap-2 mb-3">
            <div class="h-6 w-20 bg-primary/10 rounded-full"></div>
          </div>
          <div class="space-y-2 mb-4">
            <div class="h-3 bg-gray-200 rounded w-full dark:bg-gray-700"></div>
            <div class="h-3 bg-gray-200 rounded w-5/6 dark:bg-gray-700"></div>
          </div>
          <div class="h-4 bg-gray-200 rounded w-28 dark:bg-gray-700"></div>
        </div>
      </div>
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
        @click="router.push('/chiourim')"
        class="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors"
      >
        {{ t("detailChiour.backToList") }}
      </button>
    </div>

    <!-- Content -->
    <div v-else-if="auteurName" class="animate-[fadeIn_0.3s_ease]">
      <!-- Author header -->
      <div class="text-center mb-12">
        <div
          class="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
        >
          <i class="fa-solid fa-chalkboard-user text-white text-3xl"></i>
        </div>
        <h1
          class="text-3xl md:text-4xl font-bold text-text-primary mb-2 dark:text-gray-100"
        >
          {{ auteurName }}
        </h1>
        <p class="text-text-secondary dark:text-gray-400">
          {{ t("auteurPage.chiourimCount", { count: chiourim.length }) }}
        </p>

        <!-- Categories de l'auteur -->
        <div v-if="categories.length" class="flex flex-wrap gap-2 justify-center mt-4">
          <span
            v-for="cat in categories"
            :key="cat"
            class="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider dark:bg-primary/20"
          >
            {{ cat }}
          </span>
        </div>
      </div>

      <!-- Search -->
      <div class="mb-8 flex justify-center">
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
      </div>

      <!-- Chiourim list -->
      <div
        v-if="filteredChiourim.length > 0"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        <ChiourCard
          v-for="chiour in filteredChiourim"
          :key="chiour.slug"
          :chiour="chiour"
          class="h-full"
        />
      </div>

      <div
        v-else
        class="flex flex-col items-center justify-center py-12 bg-white/40 backdrop-blur-sm rounded-xl border border-white/60 dark:bg-gray-800/40 dark:border-gray-700"
      >
        <i class="fa-solid fa-magnifying-glass text-4xl text-text-secondary/40 mb-4"></i>
        <p class="text-text-secondary text-lg dark:text-gray-400">
          {{ t("chiourim.noResults") }}
        </p>
        <button
          @click="searchTerm = ''"
          class="mt-4 text-primary font-medium hover:underline"
        >
          {{ t("chiourim.clearFilters") }}
        </button>
      </div>
    </div>
  </main>
</template>
