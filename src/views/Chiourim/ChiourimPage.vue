<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { chiourService } from "../../services/chiourService";
import { serieService, type Serie } from "../../services/serieService";
import type { Chiour } from "../../models/models";
import { useSearchTracking } from "../../composables/useSearchTracking";
import PageTabs from "../../components/PageTabs.vue";
import { STUDY_TABS } from "../../config/pageTabs";
import AppIcon from "../../components/icons/AppIcon.vue";
import AccountCta from "../../components/AccountCta.vue";
import CollapseTransition from "../../components/CollapseTransition.vue";
import ChiourRail from "../../components/chiourim/ChiourRail.vue";
import ChiourTrackRow from "../../components/chiourim/ChiourTrackRow.vue";
import ResumeTile from "../../components/chiourim/ResumeTile.vue";
import SerieTile from "../../components/chiourim/SerieTile.vue";
import ChiourCover from "../../components/chiourim/ChiourCover.vue";
import { inProgressSlugs } from "../../services/listeningProgress";
import { seoService } from "../../services/seoService";
import { isNativeApp } from "../../composables/useNativeApp";
import { liveValue } from "../../composables/liveInput";
import { useSearchMode } from "../../composables/useSearchMode";
import { analyticsService } from "../../services/analyticsService";
import { SITE_URL } from "../../config/site";

/**
 * Le catalogue des cours, à la manière d'une application d'écoute : on
 * reprend ce qu'on a commencé, on parcourt les séries comme des albums et les
 * rabbanim comme des artistes, on lance un cours d'un geste. La recherche et
 * les thèmes resserrent tout en une seule liste.
 */

const { t } = useI18n();

const chiourim = ref<Chiour[]>([]);
const series = ref<Serie[]>([]);
const dynamicCategories = ref<string[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);
const searchTerm = ref("");
const { searching } = useSearchMode(searchTerm);
const selectedCategory = ref<string>("all");
/** Le rav choisi dans les filtres, null pour tous. */
const selectedRav = ref<string | null>(null);
/** Le panneau des filtres, ouvert par le bouton « Filtres ». */
const filtersOpen = ref(false);

/** Combien de cours la liste complète montre d'abord, puis à chaque « Afficher plus ». */
const PAGE = 20;
const shown = ref(PAGE);

const loadChiourim = async () => {
  error.value = null;

  // Le catalogue en cache s'affiche tout de suite.
  const cached = chiourService.getCachedChiourim();
  if (cached) {
    chiourim.value = cached;
    isLoading.value = false;
  }
  serieService
    .getAllSeries()
    .then((list) => {
      series.value = list;
    })
    .catch(() => {});

  if (cached && !chiourService.isCacheStale()) {
    chiourService
      .getCategories()
      .then((cats) => {
        dynamicCategories.value = cats;
      })
      .catch(() => {});
    return;
  }

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

/** On parcourt le catalogue (rangées) tant qu'on ne cherche ni ne filtre. */
const browsing = computed(
  () => !searchTerm.value.trim() && selectedCategory.value === "all" && !selectedRav.value,
);

const filteredChiourim = computed(() => {
  let result = chiourim.value;
  result = chiourService.filterByCategory(result, selectedCategory.value);
  if (selectedRav.value) result = chiourService.filterByAuteur(result, selectedRav.value);
  result = chiourService.filterBySearch(result, searchTerm.value);
  return result;
});

// --- Les filtres ---

/** Les filtres posés, en pastilles qu'on retire d'un geste sous la recherche. */
const activeFilters = computed(() => {
  const list: { key: string; label: string; clear: () => void }[] = [];
  if (selectedCategory.value !== "all")
    list.push({
      key: "category",
      label: selectedCategory.value,
      clear: () => (selectedCategory.value = "all"),
    });
  if (selectedRav.value)
    list.push({ key: "rav", label: selectedRav.value, clear: () => (selectedRav.value = null) });
  return list;
});

function toggleCategory(cat: string) {
  selectedCategory.value = selectedCategory.value === cat ? "all" : cat;
}

function toggleRav(name: string) {
  selectedRav.value = selectedRav.value === name ? null : name;
}

function clearFilters() {
  selectedCategory.value = "all";
  selectedRav.value = null;
}

watch(filtersOpen, (open) => {
  if (open)
    analyticsService.capture("chiourim_filters_opened", { results_count: chiourimCount.value });
});

watch(selectedRav, (auteur) => {
  analyticsService.capture("chiourim_rav_filtered", {
    auteur,
    results_count: chiourimCount.value,
  });
});

const chiourimCount = computed(() => filteredChiourim.value.length);

// --- Les rangées ---

const bySlug = computed(() => new Map(chiourim.value.map((c) => [c.slug, c])));

/** Les épisodes d'une série, dans l'ordre : la file d'un cours repris. */
function serieQueue(chiour: Chiour): Chiour[] {
  return chiour.serieId ? serieService.episodesOf(chiour.serieId, chiourim.value) : [chiour];
}

const resumeItems = computed(() =>
  inProgressSlugs()
    .map((slug) => bySlug.value.get(slug))
    .filter((c): c is Chiour => !!c && !!c.mediaUrl)
    .slice(0, 12),
);

/** Les séries qui ont des cours publiés, les plus fournies d'abord. */
const serieTiles = computed(() =>
  series.value
    .map((serie) => {
      const episodes = chiourim.value.filter((c) => c.serieId === serie.id);
      const auteur = episodes.find((c) => c.auteur)?.auteur ?? null;
      const latest = Math.max(0, ...episodes.map((c) => c.addedAt ?? 0));
      return { serie, count: episodes.length, auteur, latest };
    })
    .filter((tile) => tile.count > 0)
    .sort((a, b) => b.latest - a.latest || b.count - a.count),
);

const rabbanim = computed(() => {
  const counts = new Map<string, { name: string; seed: string; count: number }>();
  for (const c of chiourim.value) {
    if (!c.auteur) continue;
    const entry = counts.get(c.auteur) ?? {
      name: c.auteur,
      seed: c.auteurId ?? c.auteur,
      count: 0,
    };
    entry.count += 1;
    counts.set(c.auteur, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
});

/** Les derniers mis en ligne. */
const latest = computed(() =>
  [...chiourim.value]
    .filter((c) => c.addedAt)
    .sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))
    .slice(0, 6),
);

const allVisible = computed(() => filteredChiourim.value.slice(0, shown.value));

watch([searchTerm, selectedCategory, selectedRav], () => {
  shown.value = PAGE;
});

/**
 * Le catalogue des chiourim n'avait aucun événement à lui : le suivi ne
 * commençait qu'au lancement d'un audio (`chiour_played`), sans jamais dire
 * combien de visiteurs parcourent la liste sans rien écouter. Même trio que
 * la page de chaîne : la vue, le filtre, la recherche.
 */
watch(selectedCategory, (category) => {
  analyticsService.capture("chiourim_category_filtered", {
    category,
    results_count: chiourimCount.value,
  });
});

// Une seule fois par visite, comme `session_search_used` : chaque frappe
// noierait les stats.
let hasTrackedSearch = false;
watch(searchTerm, (value) => {
  if (!value.trim() || hasTrackedSearch) return;
  hasTrackedSearch = true;
  analyticsService.capture("chiourim_search_used", { category: selectedCategory.value });
});

// La recherche posée, avec son terme et ce qu'elle trouve (useSearchTracking).
// Un cours ouvert l'envoie aussitôt : c'est elle qui y a mené.
const searchTracking = useSearchTracking({
  term: searchTerm,
  resultsCount: () => chiourimCount.value,
  track: (search) =>
    analyticsService.capture("chiourim_search_performed", {
      category: selectedCategory.value,
      ...search,
    }),
});

function auteurPath(name: string): string {
  return `/chiourim/auteur/${chiourService.generateAuteurSlug(name)}`;
}

onMounted(() => {
  loadChiourim();
  analyticsService.capture("chiourim_viewed");
  const url = SITE_URL + "/chiourim";
  seoService.setMeta({
    title: t("seo.chiourimTitle"),
    description: t("seo.chiourimDescription"),
    canonical: url,
    og: { url },
  });
});
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-12">
    <!-- En-tête (le sous-titre ne sert que le site : SEO et découverte).
         Replié pendant une recherche : la barre glisse en haut de l'écran et
         les résultats occupent la place laissée par le clavier. -->
    <CollapseTransition>
      <div
        v-show="!searching"
        class="text-center animate-[fadeIn_0.5s_ease]"
        :class="isNativeApp ? 'mb-6' : 'mb-10'"
      >
        <!-- App native : les chiourim sont le deuxième onglet de l'Étude, et
             les onglets tiennent lieu de titre (voir PageTabs). -->
        <PageTabs
          v-if="isNativeApp"
          :tabs="STUDY_TABS"
          event="library_tab_switched"
          :label="t('common.study')"
        />
        <h2
          class="font-display text-4xl md:text-5xl font-bold text-text-primary tracking-tight"
          :class="isNativeApp ? 'sr-only' : ''"
        >
          {{ t("chiourim.title") }}
        </h2>
        <p
          v-if="!isNativeApp"
          class="mt-4 text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed"
        >
          {{ t("chiourim.subtitle") }}
        </p>
      </div>
    </CollapseTransition>

    <!-- La recherche et le bouton des filtres, sur une ligne ; collante dans
         l'app pour rester sous le pouce au défilement. -->
    <div
      :class="isNativeApp ? 'app-sticky-search' : ''"
      class="mx-auto mb-3 flex max-w-2xl items-center gap-2 animate-[fadeIn_0.5s_ease]"
    >
      <div class="relative min-w-0 flex-1">
        <AppIcon
          name="search"
          :size="16"
          class="absolute start-4 top-1/2 -translate-y-1/2 text-text-secondary/70 pointer-events-none"
        />
        <input
          :value="searchTerm"
          @input="searchTerm = liveValue($event)"
          type="text"
          :placeholder="t('chiourim.searchPlaceholder')"
          class="field !ps-11 !pe-10"
        />
        <button
          v-if="searchTerm"
          @click="searchTerm = ''"
          class="absolute end-3 top-1/2 -translate-y-1/2 text-text-secondary/70 hover:text-text-primary transition-colors"
          :aria-label="t('chiourim.clearSearch')"
        >
          <AppIcon name="x" :size="14" />
        </button>
      </div>
      <button
        type="button"
        class="filters-btn"
        :class="filtersOpen || activeFilters.length ? 'filters-btn--on' : ''"
        :aria-expanded="filtersOpen"
        aria-controls="chiourim-filters"
        @click="filtersOpen = !filtersOpen"
      >
        <AppIcon name="settings" :size="17" />
        <!-- Caché à l'œil sur téléphone, faute de place, mais toujours dit -->
        <span class="sr-only sm:not-sr-only">{{ t("chiourim.filters.button") }}</span>
        <span v-if="activeFilters.length" class="filters-count">{{ activeFilters.length }}</span>
      </button>
    </div>

    <!-- Le panneau des filtres : les thèmes, les rabbanim -->
    <CollapseTransition>
      <section
        v-if="filtersOpen"
        id="chiourim-filters"
        class="card mx-auto mb-4 max-w-2xl p-4 md:p-5"
        :aria-label="t('chiourim.filters.button')"
      >
        <h3 class="filters-label">{{ t("chiourim.filters.themes") }}</h3>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="cat in dynamicCategories"
            :key="cat"
            type="button"
            class="chip transition-colors"
            :class="
              selectedCategory === cat
                ? 'bg-brand text-on-brand'
                : 'bg-black/5 text-text-secondary hover:text-text-primary dark:bg-white/10'
            "
            :aria-pressed="selectedCategory === cat"
            @click="toggleCategory(cat)"
          >
            {{ cat }}
          </button>
        </div>

        <h3 v-if="rabbanim.length > 1" class="filters-label mt-5">
          {{ t("chiourim.rabbanim") }}
        </h3>
        <div v-if="rabbanim.length > 1" class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="rav in rabbanim"
            :key="rav.name"
            type="button"
            class="chip inline-flex items-center gap-2 !ps-1 transition-colors"
            :class="
              selectedRav === rav.name
                ? 'bg-brand text-on-brand'
                : 'bg-black/5 text-text-secondary hover:text-text-primary dark:bg-white/10'
            "
            :aria-pressed="selectedRav === rav.name"
            @click="toggleRav(rav.name)"
          >
            <ChiourCover :seed="rav.seed" :label="rav.name" size="avatar" round />
            {{ rav.name }}
          </button>
        </div>

        <div class="mt-5 flex items-center justify-between gap-3">
          <button
            v-if="activeFilters.length"
            type="button"
            class="text-sm font-semibold text-text-secondary hover:text-primary"
            @click="clearFilters"
          >
            {{ t("chiourim.filters.clear") }}
          </button>
          <button type="button" class="btn btn-primary ms-auto" @click="filtersOpen = false">
            {{ t("chiourim.filters.show", { count: chiourimCount }) }}
          </button>
        </div>
      </section>
    </CollapseTransition>

    <!-- Les filtres posés, panneau fermé : une pastille chacun, qu'on retire -->
    <div
      v-if="!filtersOpen && activeFilters.length"
      class="mx-auto mb-4 flex max-w-2xl flex-wrap items-center gap-2"
    >
      <button
        v-for="filter in activeFilters"
        :key="filter.key"
        type="button"
        class="chip inline-flex items-center gap-1.5 bg-brand text-on-brand"
        :aria-label="t('chiourim.filters.remove', { filter: filter.label })"
        @click="filter.clear()"
      >
        {{ filter.label }}
        <AppIcon name="x" :size="12" />
      </button>
    </div>

    <div :class="isNativeApp ? 'mb-6' : 'mb-10'"></div>

    <!-- Chargement -->
    <div v-if="isLoading" class="animate-pulse space-y-10" aria-hidden="true">
      <div>
        <div class="mb-4 h-7 w-40 rounded-lg bg-black/10 dark:bg-white/10"></div>
        <div class="flex gap-4 overflow-hidden">
          <div
            v-for="n in 5"
            :key="n"
            class="aspect-square w-36 shrink-0 rounded-card bg-black/10 sm:w-44 dark:bg-white/10"
          ></div>
        </div>
      </div>
      <div class="space-y-3">
        <div v-for="n in 6" :key="n" class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-md bg-black/10 dark:bg-white/10"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 w-2/3 rounded bg-black/10 dark:bg-white/10"></div>
            <div class="h-3 w-1/3 rounded bg-black/10 dark:bg-white/10"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Erreur -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-16 text-center">
      <AppIcon name="alert-triangle" :size="32" class="text-red-500 mb-4" />
      <p class="text-text-primary font-medium mb-6">{{ error }}</p>
      <button @click="loadChiourim" class="btn btn-soft">
        {{ t("common.retry") }}
      </button>
    </div>

    <!-- Aucun cours -->
    <div
      v-else-if="chiourim.length === 0"
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <AppIcon name="graduation-cap" :size="40" class="text-primary/50 mb-6" :stroke-width="1.75" />
      <h3 class="text-2xl font-bold text-text-primary mb-2">
        {{ t("chiourim.noChiourim") }}
      </h3>
      <p class="text-text-secondary">
        {{ t("chiourim.noChiourimDesc") }}
      </p>
    </div>

    <!-- Parcourir : les rangées -->
    <div v-else-if="browsing" class="space-y-12 animate-[fadeIn_0.4s_ease]">
      <ChiourRail v-if="resumeItems.length" :title="t('chiourim.resume')">
        <ResumeTile
          v-for="chiour in resumeItems"
          :key="chiour.slug"
          :chiour="chiour"
          :queue="serieQueue(chiour)"
        />
      </ChiourRail>

      <ChiourRail v-if="serieTiles.length" :title="t('chiourim.series')">
        <SerieTile
          v-for="tile in serieTiles"
          :key="tile.serie.id"
          :to="`/chiourim/serie/${tile.serie.id}`"
          :seed="tile.serie.id"
          :name="tile.serie.name"
          :cover-sub="tile.auteur"
          :sub="
            [tile.auteur, t('chiourim.coursesCount', { count: tile.count })]
              .filter(Boolean)
              .join(' · ')
          "
        />
      </ChiourRail>

      <ChiourRail v-if="rabbanim.length" :title="t('chiourim.rabbanim')">
        <SerieTile
          v-for="rav in rabbanim"
          :key="rav.name"
          :to="auteurPath(rav.name)"
          :seed="rav.seed"
          :name="rav.name"
          :sub="t('chiourim.coursesCount', { count: rav.count })"
          round
        />
      </ChiourRail>

      <section v-if="latest.length">
        <h2 class="mb-3 font-display text-2xl font-bold tracking-tight text-text-primary">
          {{ t("chiourim.latest") }}
        </h2>
        <div class="-mx-2">
          <ChiourTrackRow
            v-for="chiour in latest"
            :key="chiour.slug"
            :chiour="chiour"
            :list="latest"
            source="catalogue"
            :context="t('chiourim.latest')"
          />
        </div>
      </section>

      <section>
        <h2
          class="mb-3 flex items-baseline gap-3 font-display text-2xl font-bold tracking-tight text-text-primary"
        >
          {{ t("chiourim.allCourses") }}
          <span class="font-sans text-sm font-normal text-text-secondary">{{
            chiourim.length
          }}</span>
        </h2>
        <div class="-mx-2">
          <ChiourTrackRow
            v-for="chiour in allVisible"
            :key="chiour.slug"
            :chiour="chiour"
            :list="allVisible"
            source="catalogue"
            :context="t('chiourim.allCourses')"
          />
        </div>
        <div v-if="filteredChiourim.length > shown" class="mt-4 flex justify-center">
          <button class="btn btn-soft" @click="shown += PAGE">
            {{ t("chiourim.showMore") }}
          </button>
        </div>
      </section>
    </div>

    <!-- Rechercher, filtrer : une seule liste -->
    <section v-else class="animate-[fadeIn_0.3s_ease]">
      <h2 class="mb-3 flex items-baseline gap-3 text-xl font-bold text-text-primary">
        {{ t("chiourim.availableChiourim") }}
        <span class="text-sm font-normal text-text-secondary">{{ chiourimCount }}</span>
      </h2>
      <div v-if="filteredChiourim.length > 0" class="-mx-2">
        <ChiourTrackRow
          v-for="chiour in allVisible"
          :key="chiour.slug"
          :chiour="chiour"
          :list="allVisible"
          source="catalogue"
          @played="searchTracking.flush()"
        />
        <div v-if="filteredChiourim.length > shown" class="mt-4 flex justify-center">
          <button class="btn btn-soft" @click="shown += PAGE">
            {{ t("chiourim.showMore") }}
          </button>
        </div>
      </div>
      <div v-else class="flex flex-col items-center justify-center py-16 text-center">
        <AppIcon name="search" :size="32" class="text-text-secondary/40 mb-4" />
        <p class="text-text-secondary text-lg">
          {{ t("chiourim.noResults") }}
        </p>
        <button
          @click="
            searchTerm = '';
            clearFilters();
          "
          class="mt-4 text-primary font-medium hover:underline"
        >
          {{ t("chiourim.clearFilters") }}
        </button>
      </div>
    </section>

    <AccountCta class="max-w-3xl mx-auto mt-12" />
  </main>
</template>

<style scoped>
/* Le bouton des filtres : de la hauteur du champ, à côté de lui. */
.filters-btn {
  display: inline-flex;
  align-self: stretch;
  flex-shrink: 0;
  align-items: center;
  gap: 0.5rem;
  border-radius: var(--radius-control);
  padding-inline: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  transition:
    color 0.15s,
    background-color 0.15s;
}
.filters-btn:hover {
  color: var(--color-primary);
}
.filters-btn--on {
  color: var(--color-primary);
}
.filters-count {
  display: inline-flex;
  min-width: 1.25rem;
  height: 1.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding-inline: 0.3rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-on-brand);
  background: var(--color-brand);
}
.filters-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}
</style>
