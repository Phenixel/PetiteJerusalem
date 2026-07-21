<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { chiourService } from "../../services/chiourService";
import { serieService, type Serie } from "../../services/serieService";
import type { Chiour } from "../../models/models";
import ChiourCard from "../../components/ChiourCard.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import { seoService } from "../../services/seoService";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const auteurName = ref<string | null>(null);
const chiourim = ref<Chiour[]>([]);
const allSeries = ref<Serie[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);
const searchTerm = ref("");

const filteredChiourim = computed(() => {
  return chiourService.filterBySearch(chiourim.value, searchTerm.value);
});

// Groupes série (dans l'ordre des séries), puis les chiourim hors série.
const serieGroups = computed(() => {
  const bySerieId = new Map<string, Chiour[]>();
  for (const c of filteredChiourim.value) {
    if (!c.serieId) continue;
    const list = bySerieId.get(c.serieId) ?? [];
    list.push(c);
    bySerieId.set(c.serieId, list);
  }
  return allSeries.value
    .filter((s) => bySerieId.has(s.id))
    .map((s) => ({ serie: s, episodes: serieService.episodesOf(s.id, filteredChiourim.value) }));
});

const horsSerie = computed(() =>
  filteredChiourim.value.filter((c) => !c.serieId || !allSeries.value.some((s) => s.id === c.serieId)),
);

const categories = computed(() => {
  const cats = new Set<string>();
  for (const c of chiourim.value) {
    for (const cat of c.categories) cats.add(cat);
  }
  return Array.from(cats).sort();
});

function applyAuteur(all: Chiour[], slug: string): boolean {
  const name = chiourService.findAuteurBySlug(all, slug);
  if (!name) return false;
  auteurName.value = name;
  chiourim.value = chiourService.filterByAuteur(all, name);
  serieService
    .getAllSeries()
    .then((series) => {
      allSeries.value = series;
    })
    .catch(() => {});
  seoService.setMeta({
    title: `${name} – ${t("chiourim.title")} – Petite Jerusalem`,
    description: t("auteurPage.seoDescription", { auteur: name }),
    canonical: window.location.origin + `/chiourim/auteur/${slug}`,
  });
  return true;
}

const loadAuteur = async () => {
  const slug = route.params.auteur as string;
  error.value = null;

  // Instant display from cache
  const cached = chiourService.getCachedChiourim();
  if (cached && applyAuteur(cached, slug)) {
    isLoading.value = false;
    if (chiourService.isCacheStale()) {
      chiourService.getAllChiourim().then((fresh) => applyAuteur(fresh, slug)).catch(() => {});
    }
    return;
  }

  // No cache, full load
  try {
    isLoading.value = true;
    const all = await chiourService.getAllChiourim();
    if (!applyAuteur(all, slug)) {
      error.value = t("auteurPage.notFound");
    }
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
    <!-- Back link -->
    <button @click="router.push('/chiourim')" class="back-link mb-8">
      <AppIcon name="chevron-left" :size="14" />
      {{ t("detailChiour.backToList") }}
    </button>

    <!-- Skeleton loading -->
    <div v-if="isLoading" class="animate-pulse">
      <div class="mb-12">
        <div class="h-9 bg-black/10 rounded-lg w-64 mb-3 dark:bg-white/10"></div>
        <div class="h-4 bg-black/10 rounded w-32 dark:bg-white/10"></div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="n in 3" :key="n" class="card p-6 animate-pulse">
          <div class="h-5 bg-black/10 rounded-lg w-3/4 mb-3 dark:bg-white/10"></div>
          <div class="flex gap-2 mb-3">
            <div class="h-6 w-20 bg-primary/10 rounded-lg"></div>
          </div>
          <div class="space-y-2 mb-4">
            <div class="h-3 bg-black/10 rounded w-full dark:bg-white/10"></div>
            <div class="h-3 bg-black/10 rounded w-5/6 dark:bg-white/10"></div>
          </div>
          <div class="h-4 bg-black/10 rounded w-28 dark:bg-white/10"></div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-16 text-center">
      <AppIcon name="alert-triangle" :size="32" class="text-red-500 mb-4" />
      <p class="text-text-primary font-medium mb-6">{{ error }}</p>
      <button @click="router.push('/chiourim')" class="btn btn-soft">
        {{ t("detailChiour.backToList") }}
      </button>
    </div>

    <!-- Content -->
    <div v-else-if="auteurName" class="animate-[fadeIn_0.3s_ease]">
      <!-- Author header -->
      <div
        class="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6"
      >
        <div>
          <h1 class="text-3xl md:text-4xl font-bold text-text-primary mb-2">
            {{ auteurName }}
          </h1>
          <p class="text-text-secondary">
            {{ t("auteurPage.chiourimCount", { count: chiourim.length }) }}
          </p>

          <!-- Categories de l'auteur -->
          <div v-if="categories.length" class="flex flex-wrap gap-2 mt-4">
            <span v-for="cat in categories" :key="cat" class="chip bg-primary/10 text-primary">
              {{ cat }}
            </span>
          </div>
        </div>

        <!-- Search -->
        <div class="relative w-full md:w-80 shrink-0">
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
      </div>

      <!-- Chiourim list : séries d'abord, puis hors série -->
      <div v-if="filteredChiourim.length > 0" class="space-y-10">
        <section v-for="group in serieGroups" :key="group.serie.id">
          <div class="flex items-baseline justify-between gap-4 mb-4">
            <h2 class="text-xl font-bold text-text-primary flex items-center gap-2">
              <AppIcon name="book-open" :size="18" class="text-secondary" />
              {{ group.serie.name }}
            </h2>
            <router-link
              :to="`/chiourim/serie/${group.serie.id}`"
              class="text-sm text-primary font-medium hover:underline shrink-0"
            >
              {{ t("serie.seeAll") }}
            </router-link>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <ChiourCard
              v-for="chiour in group.episodes"
              :key="chiour.slug"
              :chiour="chiour"
              :serie-name="group.serie.name"
              class="h-full"
            />
          </div>
        </section>

        <section v-if="horsSerie.length > 0">
          <h2
            v-if="serieGroups.length > 0"
            class="text-xl font-bold text-text-primary mb-4"
          >
            {{ t("serie.outOfSerie") }}
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <ChiourCard
              v-for="chiour in horsSerie"
              :key="chiour.slug"
              :chiour="chiour"
              class="h-full"
            />
          </div>
        </section>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-16 text-center">
        <AppIcon name="search" :size="32" class="text-text-secondary/40 mb-4" />
        <p class="text-text-secondary text-lg">
          {{ t("chiourim.noResults") }}
        </p>
        <button @click="searchTerm = ''" class="mt-4 text-primary font-medium hover:underline">
          {{ t("chiourim.clearFilters") }}
        </button>
      </div>
    </div>
  </main>
</template>
