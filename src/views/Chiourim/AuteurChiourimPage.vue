<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { chiourService, sortedCategories } from "../../services/chiourService";
import { serieService, type Serie } from "../../services/serieService";
import type { Chiour } from "../../models/models";
import AppIcon from "../../components/icons/AppIcon.vue";
import ChiourCover from "../../components/chiourim/ChiourCover.vue";
import ChiourRail from "../../components/chiourim/ChiourRail.vue";
import ChiourTrackRow from "../../components/chiourim/ChiourTrackRow.vue";
import SerieTile from "../../components/chiourim/SerieTile.vue";
import BigPlayButton from "../../components/chiourim/BigPlayButton.vue";
import { formatMinutes, totalDuration } from "../../components/chiourim/duration";
import { useChiourPlayback } from "../../composables/useChiourPlayback";
import { seoService } from "../../services/seoService";
import { analyticsService } from "../../services/analyticsService";
import { liveValue } from "../../composables/liveInput";
import { SITE_URL } from "../../config/site";

/**
 * Un rav, comme un artiste : son nom, ce qu'il enseigne, ses séries en
 * rangée, puis ses cours. La recherche resserre tout en une liste.
 */

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { player, playFrom } = useChiourPlayback();

const auteurName = ref<string | null>(null);
const auteurSeed = ref("");
const chiourim = ref<Chiour[]>([]);
const allSeries = ref<Serie[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);
const searchTerm = ref("");

const filteredChiourim = computed(() =>
  chiourService.filterBySearch(chiourim.value, searchTerm.value),
);
const searching = computed(() => searchTerm.value.trim() !== "");

/** Ses séries, avec leurs épisodes, les plus récentes d'abord. */
const serieGroups = computed(() =>
  allSeries.value
    .map((serie) => ({ serie, episodes: serieService.episodesOf(serie.id, chiourim.value) }))
    .filter((group) => group.episodes.length > 0)
    .sort(
      (a, b) =>
        Math.max(0, ...b.episodes.map((c) => c.addedAt ?? 0)) -
        Math.max(0, ...a.episodes.map((c) => c.addedAt ?? 0)),
    ),
);

const horsSerie = computed(() =>
  chiourim.value
    .filter((c) => !c.serieId || !allSeries.value.some((s) => s.id === c.serieId))
    .sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0)),
);

const categories = computed(() => sortedCategories(chiourim.value));
const totalLabel = computed(() => formatMinutes(totalDuration(chiourim.value), locale.value));

/** Ce que lance le grand bouton : les cours hors série, puis les séries, dans l'ordre affiché. */
const playOrder = computed(() => [
  ...horsSerie.value,
  ...serieGroups.value.flatMap((g) => g.episodes),
]);
const playingHere = computed(() => chiourim.value.some((c) => c.slug === player.track.value?.slug));

function playMain() {
  if (playingHere.value) {
    player.toggle();
    return;
  }
  const first = playOrder.value.find((c) => c.mediaUrl);
  if (first) playFrom(playOrder.value, first, "auteur", auteurName.value);
}

// `applyAuteur` passe deux fois sur le même auteur (cache puis catalogue
// frais) : un seul événement par auteur réellement ouvert.
let trackedAuteurSlug: string | null = null;

function applyAuteur(all: Chiour[], slug: string): boolean {
  const name = chiourService.findAuteurBySlug(all, slug);
  if (!name) return false;
  auteurName.value = name;
  chiourim.value = chiourService.filterByAuteur(all, name);
  auteurSeed.value = chiourim.value.find((c) => c.auteurId)?.auteurId ?? name;
  if (trackedAuteurSlug !== slug) {
    trackedAuteurSlug = slug;
    analyticsService.capture("chiour_auteur_opened", {
      auteur: name,
      auteur_slug: slug,
      chiourim_count: chiourim.value.length,
    });
  }
  serieService
    .getAllSeries()
    .then((series) => {
      allSeries.value = series;
    })
    .catch(() => {});
  seoService.setMeta({
    title: `${name} | ${t("chiourim.title")} | Petite Jerusalem`,
    description: t("auteurPage.seoDescription", { auteur: name }),
    canonical: SITE_URL + `/chiourim/auteur/${slug}`,
  });
  return true;
}

const loadAuteur = async () => {
  const slug = route.params.auteur as string;
  error.value = null;

  // Affichage immédiat depuis le cache
  const cached = chiourService.getCachedChiourim();
  if (cached && applyAuteur(cached, slug)) {
    isLoading.value = false;
    if (chiourService.isCacheStale()) {
      chiourService
        .getAllChiourim()
        .then((fresh) => {
          if (route.params.auteur === slug) applyAuteur(fresh, slug);
        })
        .catch(() => {});
    }
    return;
  }

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
  <main class="mx-auto px-6 py-12 max-w-5xl">
    <button @click="router.push('/chiourim')" class="back-link mb-8">
      <AppIcon name="chevron-left" :size="14" class="rtl:rotate-180" />
      {{ t("detailChiour.backToList") }}
    </button>

    <!-- Chargement -->
    <div v-if="isLoading" class="animate-pulse" aria-hidden="true">
      <div class="flex flex-col items-center gap-6 md:flex-row md:items-end">
        <div class="h-44 w-44 rounded-full bg-black/10 md:h-56 md:w-56 dark:bg-white/10"></div>
        <div class="flex-1 space-y-3">
          <div class="h-9 w-2/3 rounded-lg bg-black/10 dark:bg-white/10"></div>
          <div class="h-4 w-40 rounded bg-black/10 dark:bg-white/10"></div>
        </div>
      </div>
    </div>

    <!-- Erreur -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-16 text-center">
      <AppIcon name="alert-triangle" :size="32" class="text-red-500 mb-4" />
      <p class="text-text-primary font-medium mb-6">{{ error }}</p>
      <button @click="router.push('/chiourim')" class="btn btn-soft">
        {{ t("detailChiour.backToList") }}
      </button>
    </div>

    <div v-else-if="auteurName" class="animate-[fadeIn_0.3s_ease]">
      <!-- En-tête : le rav -->
      <header
        class="flex flex-col items-center gap-6 text-center md:flex-row md:items-end md:text-start"
      >
        <ChiourCover :seed="auteurSeed" :label="auteurName" size="lg" round class="shadow-pop" />
        <div class="min-w-0 flex-1">
          <h1
            dir="auto"
            class="font-display text-3xl font-bold tracking-tight text-text-primary md:text-5xl"
          >
            {{ auteurName }}
          </h1>
          <p class="mt-3 text-text-secondary">
            {{ t("auteurPage.chiourimCount", { count: chiourim.length }) }}
            <template v-if="totalLabel"> · {{ totalLabel }}</template>
          </p>
          <div
            v-if="categories.length"
            class="mt-3 flex flex-wrap justify-center gap-2 md:justify-start"
          >
            <span v-for="cat in categories" :key="cat" class="chip bg-primary/10 text-primary">
              {{ cat }}
            </span>
          </div>
        </div>
      </header>

      <div class="mt-6 flex items-center gap-3">
        <div class="relative min-w-0 flex-1 sm:max-w-xs">
          <AppIcon
            name="search"
            :size="16"
            class="absolute start-4 top-1/2 -translate-y-1/2 text-text-secondary/70 pointer-events-none"
          />
          <input
            :value="searchTerm"
            @input="searchTerm = liveValue($event)"
            type="text"
            :placeholder="t('auteurPage.searchPlaceholder')"
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
        <BigPlayButton
          v-if="playOrder.some((c) => c.mediaUrl)"
          class="ms-auto"
          :playing="playingHere && player.isPlaying.value"
          :label="
            playingHere && player.isPlaying.value
              ? t('audioPlayer.pause')
              : playingHere
                ? t('chiourim.resumeShort')
                : t('chiourim.listen')
          "
          @click="playMain"
        />
      </div>

      <!-- Recherche : une seule liste -->
      <section v-if="searching" class="mt-8">
        <div v-if="filteredChiourim.length" class="-mx-2">
          <ChiourTrackRow
            v-for="chiour in filteredChiourim"
            :key="chiour.slug"
            :chiour="chiour"
            :list="filteredChiourim"
            source="auteur"
            :context="auteurName"
          />
        </div>
        <div v-else class="flex flex-col items-center justify-center py-16 text-center">
          <AppIcon name="search" :size="32" class="text-text-secondary/40 mb-4" />
          <p class="text-text-secondary text-lg">{{ t("chiourim.noResults") }}</p>
          <button @click="searchTerm = ''" class="mt-4 text-primary font-medium hover:underline">
            {{ t("chiourim.clearFilters") }}
          </button>
        </div>
      </section>

      <template v-else>
        <ChiourRail v-if="serieGroups.length" class="mt-10" :title="t('chiourim.series')">
          <SerieTile
            v-for="group in serieGroups"
            :key="group.serie.id"
            :to="`/chiourim/serie/${group.serie.id}`"
            :seed="group.serie.id"
            :name="group.serie.name"
            :cover-sub="auteurName"
            :sub="t('chiourim.coursesCount', { count: group.episodes.length })"
          />
        </ChiourRail>

        <section v-if="horsSerie.length" class="mt-10">
          <h2 class="mb-3 font-display text-2xl font-bold tracking-tight text-text-primary">
            {{ serieGroups.length ? t("serie.outOfSerie") : t("chiourim.allCourses") }}
          </h2>
          <div class="-mx-2">
            <ChiourTrackRow
              v-for="chiour in horsSerie"
              :key="chiour.slug"
              :chiour="chiour"
              :list="horsSerie"
              source="auteur"
              :context="auteurName"
              :subtitle="chiour.categories.join(' · ')"
            />
          </div>
        </section>
      </template>
    </div>
  </main>
</template>
