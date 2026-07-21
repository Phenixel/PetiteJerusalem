<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { chiourService } from "../../services/chiourService";
import { serieService, type Serie } from "../../services/serieService";
import type { Chiour } from "../../models/models";
import AudioPlayer from "../../components/AudioPlayer.vue";
import ChiourCard from "../../components/ChiourCard.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import { seoService } from "../../services/seoService";

const route = useRoute();
const router = useRouter();

function goToAuteur(auteur: string) {
  router.push(`/chiourim/auteur/${chiourService.generateAuteurSlug(auteur)}`);
}
const { t } = useI18n();

const chiour = ref<Chiour | null>(null);
const allChiourim = ref<Chiour[]>([]);
const serie = ref<Serie | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);

const nextEpisode = computed(() => {
  if (!chiour.value || !allChiourim.value.length) return null;
  return serieService.getNextEpisode(chiour.value, allChiourim.value);
});

// L'épisode suivant de la série passe en tête des recommandations.
const recommendations = computed(() => {
  if (!chiour.value || !allChiourim.value.length) return [];
  const recs = chiourService.getRecommendations(chiour.value, allChiourim.value, 2);
  const next = nextEpisode.value;
  if (!next) return recs;
  return [next, ...recs.filter((r) => r.slug !== next.slug)].slice(0, 2);
});

function applyChiour(all: Chiour[], slug: string): boolean {
  allChiourim.value = all;
  const found = all.find((c) => c.slug === slug) ?? null;
  if (!found) return false;
  chiour.value = found;
  serie.value = null;
  if (found.serieId) {
    serieService
      .getSerie(found.serieId)
      .then((s) => {
        // Le visiteur a pu naviguer vers un autre chiour entre-temps.
        if (chiour.value?.serieId === s?.id) serie.value = s;
      })
      .catch(() => {});
  }
  seoService.setMeta({
    title: `${found.name} – Petite Jerusalem`,
    description: found.description || t("seo.chiourimDescription"),
    canonical: window.location.origin + `/chiourim/${found.slug}`,
  });
  return true;
}

const loadChiour = async () => {
  const slug = route.params.slug as string;
  error.value = null;

  // Instant display from cache (even if media URLs are stale)
  const cached = chiourService.getCachedChiourim();
  if (cached && applyChiour(cached, slug)) {
    chiourService.registerView(slug);
    isLoading.value = false;
    // If media URLs may be expired, refresh in background
    if (chiourService.isCacheStale()) {
      chiourService.getAllChiourim().then((fresh) => applyChiour(fresh, slug)).catch(() => {});
    }
    return;
  }

  // No cache, full load with skeleton
  try {
    isLoading.value = true;
    const all = await chiourService.getAllChiourim();
    if (!applyChiour(all, slug)) {
      error.value = t("detailChiour.notFound");
    } else {
      chiourService.registerView(slug);
    }
  } catch (err) {
    console.error("Erreur lors du chargement du chiour:", err);
    error.value = err instanceof Error ? err.message : t("chiourim.loadError");
  } finally {
    isLoading.value = false;
  }
};

onMounted(loadChiour);

watch(() => route.params.slug, loadChiour);
</script>

<template>
  <main class="mx-auto px-6 py-12 max-w-4xl">
    <!-- Back link -->
    <button @click="router.push('/chiourim')" class="back-link mb-8">
      <AppIcon name="chevron-left" :size="14" />
      {{ t("detailChiour.backToList") }}
    </button>

    <!-- Skeleton loading -->
    <div v-if="isLoading" class="animate-pulse">
      <div class="h-8 bg-black/10 rounded-lg w-2/3 mb-4 dark:bg-white/10"></div>
      <div class="flex gap-2 mb-6">
        <div class="h-6 w-20 bg-primary/10 rounded-lg"></div>
        <div class="h-6 w-16 bg-primary/10 rounded-lg"></div>
      </div>
      <div class="flex gap-4 mb-8">
        <div class="h-5 bg-black/10 rounded w-32 dark:bg-white/10"></div>
        <div class="h-5 bg-black/10 rounded w-24 dark:bg-white/10"></div>
      </div>
      <div class="card p-6 mb-8">
        <div class="h-2 bg-black/10 rounded-full mb-4 dark:bg-white/10"></div>
        <div class="flex justify-between mb-4">
          <div class="h-3 w-10 bg-black/10 rounded dark:bg-white/10"></div>
          <div class="h-3 w-10 bg-black/10 rounded dark:bg-white/10"></div>
        </div>
        <div class="flex justify-center">
          <div class="w-12 h-12 bg-black/10 rounded-full dark:bg-white/10"></div>
        </div>
      </div>
      <div class="space-y-2 mb-8">
        <div class="h-4 bg-black/10 rounded w-full dark:bg-white/10"></div>
        <div class="h-4 bg-black/10 rounded w-5/6 dark:bg-white/10"></div>
        <div class="h-4 bg-black/10 rounded w-4/6 dark:bg-white/10"></div>
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
    <div v-else-if="chiour" class="animate-[fadeIn_0.3s_ease]">
      <!-- Header -->
      <div class="mb-8">
        <h1
          class="text-3xl md:text-4xl font-bold text-text-primary mb-4 dark:text-gray-100"
        >
          {{ chiour.name }}
        </h1>

        <!-- Categories -->
        <div class="flex flex-wrap gap-2 mb-5">
          <span v-for="cat in chiour.categories" :key="cat" class="chip bg-primary/10 text-primary">
            {{ cat }}
          </span>
        </div>

        <!-- Série : lien vers la page série + numéro d'épisode -->
        <div v-if="serie" class="mb-5">
          <router-link
            :to="`/chiourim/serie/${serie.id}`"
            class="inline-flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
          >
            <AppIcon name="book-open" :size="15" class="text-secondary" />
            <span>
              <template v-if="chiour.episode != null">
                {{ t("serie.episodeOf", { n: chiour.episode, serie: serie.name }) }}
              </template>
              <template v-else>{{ serie.name }}</template>
            </span>
          </router-link>
        </div>

        <!-- Meta : auteur + niveau -->
        <div class="flex flex-wrap items-center gap-6 text-text-secondary">
          <button
            v-if="chiour.auteur"
            @click="goToAuteur(chiour.auteur)"
            class="flex items-center gap-2 hover:text-primary transition-colors"
          >
            <AppIcon name="teacher" :size="16" class="text-primary" />
            <span
              class="font-semibold text-text-primary underline decoration-dotted underline-offset-2 hover:text-primary"
              >{{ chiour.auteur }}</span
            >
          </button>
          <div v-if="chiour.niveau" class="flex items-center gap-2">
            <AppIcon name="signal" :size="16" class="text-primary" />
            <span>{{ chiour.niveau }}</span>
          </div>
        </div>
      </div>

      <!-- Audio Player -->
      <div v-if="chiour.mediaUrl" class="mb-8">
        <AudioPlayer :src="chiour.mediaUrl" :title="chiour.name" :slug="chiour.slug" />
      </div>

      <div v-else class="mb-8 py-8 text-center">
        <AppIcon name="volume-x" :size="24" class="text-text-secondary/40 mb-2" />
        <p class="text-text-secondary">
          {{ t("detailChiour.noAudio") }}
        </p>
      </div>

      <!-- Description -->
      <div v-if="chiour.description" class="mb-12 card p-6">
        <h2 class="text-lg font-bold text-text-primary mb-3">
          {{ t("common.description") }}
        </h2>
        <p class="text-text-secondary leading-relaxed whitespace-pre-line">
          {{ chiour.description }}
        </p>
      </div>

      <!-- Épisode suivant -->
      <div v-if="nextEpisode" class="mb-10">
        <router-link
          :to="`/chiourim/${nextEpisode.slug}`"
          class="card card-hover p-5 flex items-center gap-4 group"
        >
          <div
            class="flex items-center justify-center w-11 h-11 rounded-lg bg-secondary/10 text-secondary shrink-0"
          >
            <AppIcon name="forward" :size="18" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm text-text-secondary">{{ t("serie.nextEpisode") }}</p>
            <p class="font-bold text-text-primary group-hover:text-primary transition-colors truncate">
              <template v-if="nextEpisode.episode != null">{{ nextEpisode.episode }}. </template>{{ nextEpisode.name }}
            </p>
          </div>
          <AppIcon name="chevron-right" :size="16" class="text-text-secondary shrink-0" />
        </router-link>
      </div>

      <!-- Recommandations -->
      <div v-if="recommendations.length > 0">
        <h2 class="text-2xl font-bold text-text-primary mb-6">
          {{ t("detailChiour.recommendations") }}
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChiourCard
            v-for="rec in recommendations"
            :key="rec.slug"
            :chiour="rec"
            :serie-name="serie && rec.serieId === serie.id ? serie.name : undefined"
            class="h-full"
          />
        </div>
      </div>
    </div>
  </main>
</template>
