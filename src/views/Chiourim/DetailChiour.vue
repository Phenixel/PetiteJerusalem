<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { chiourService } from "../../services/chiourService";
import type { Chiour } from "../../models/models";
import AudioPlayer from "../../components/AudioPlayer.vue";
import ChiourCard from "../../components/ChiourCard.vue";
import { seoService } from "../../services/seoService";

const route = useRoute();
const router = useRouter();

function goToAuteur(auteur: string) {
  router.push(`/chiourim/auteur/${chiourService.generateAuteurSlug(auteur)}`);
}
const { t } = useI18n();

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/,
  );
  return match?.[1] ?? null;
}

const youtubeId = computed(() => {
  if (!chiour.value?.link) return null;
  return getYouTubeId(chiour.value.link);
});

const chiour = ref<Chiour | null>(null);
const allChiourim = ref<Chiour[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);

const recommendations = computed(() => {
  if (!chiour.value || !allChiourim.value.length) return [];
  return chiourService.getRecommendations(chiour.value, allChiourim.value, 2);
});

function applyChiour(all: Chiour[], slug: string): boolean {
  allChiourim.value = all;
  const found = all.find((c) => c.slug === slug) ?? null;
  if (!found) return false;
  chiour.value = found;
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
    isLoading.value = false;
    // If media URLs may be expired, refresh in background
    if (chiourService.isCacheStale()) {
      chiourService.getAllChiourim().then((fresh) => applyChiour(fresh, slug)).catch(() => {});
    }
    return;
  }

  // No cache — full load with skeleton
  try {
    isLoading.value = true;
    const all = await chiourService.getAllChiourim();
    if (!applyChiour(all, slug)) {
      error.value = t("detailChiour.notFound");
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
    <!-- Back button -->
    <button
      @click="router.push('/chiourim')"
      class="mb-8 flex items-center gap-2 text-text-secondary hover:text-primary transition-colors group dark:text-gray-400 dark:hover:text-primary"
    >
      <i
        class="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"
      ></i>
      {{ t("detailChiour.backToList") }}
    </button>

    <!-- Skeleton loading -->
    <div v-if="isLoading" class="animate-pulse">
      <div class="h-8 bg-gray-200 rounded-lg w-2/3 mb-4 dark:bg-gray-700"></div>
      <div class="flex gap-2 mb-6">
        <div class="h-6 w-20 bg-primary/10 rounded-full"></div>
        <div class="h-6 w-16 bg-primary/10 rounded-full"></div>
      </div>
      <div class="flex gap-4 mb-8">
        <div class="h-5 bg-gray-200 rounded w-32 dark:bg-gray-700"></div>
        <div class="h-5 bg-gray-200 rounded w-24 dark:bg-gray-700"></div>
      </div>
      <div
        class="bg-white/90 rounded-2xl border border-white/60 p-6 mb-8 dark:bg-gray-800/80 dark:border-gray-700"
      >
        <div class="h-2 bg-gray-200 rounded-full mb-4 dark:bg-gray-700"></div>
        <div class="flex justify-between mb-4">
          <div class="h-3 w-10 bg-gray-200 rounded dark:bg-gray-700"></div>
          <div class="h-3 w-10 bg-gray-200 rounded dark:bg-gray-700"></div>
        </div>
        <div class="flex justify-center">
          <div class="w-12 h-12 bg-gray-200 rounded-full dark:bg-gray-700"></div>
        </div>
      </div>
      <div class="space-y-2 mb-8">
        <div class="h-4 bg-gray-200 rounded w-full dark:bg-gray-700"></div>
        <div class="h-4 bg-gray-200 rounded w-5/6 dark:bg-gray-700"></div>
        <div class="h-4 bg-gray-200 rounded w-4/6 dark:bg-gray-700"></div>
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
          <span
            v-for="cat in chiour.categories"
            :key="cat"
            class="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider dark:bg-primary/20"
          >
            {{ cat }}
          </span>
        </div>

        <!-- Meta : auteur + niveau -->
        <div class="flex flex-wrap items-center gap-6 text-text-secondary dark:text-gray-400">
          <button
            v-if="chiour.auteur"
            @click="goToAuteur(chiour.auteur)"
            class="flex items-center gap-2 hover:text-primary transition-colors"
          >
            <i class="fa-solid fa-chalkboard-user text-primary"></i>
            <span class="font-semibold text-text-primary underline decoration-dotted underline-offset-2 hover:text-primary dark:text-gray-200 dark:hover:text-primary">{{
              chiour.auteur
            }}</span>
          </button>
          <div v-if="chiour.niveau" class="flex items-center gap-2">
            <i class="fa-solid fa-signal text-primary"></i>
            <span>{{ chiour.niveau }}</span>
          </div>
        </div>
      </div>

      <!-- YouTube Embed -->
      <div v-if="youtubeId" class="mb-8">
        <div class="relative w-full rounded-2xl overflow-hidden border border-white/60 dark:border-gray-700" style="padding-top: 56.25%">
          <iframe
            class="absolute inset-0 w-full h-full"
            :src="`https://www.youtube-nocookie.com/embed/${youtubeId}`"
            :title="chiour.name"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
      </div>

      <!-- Audio Player -->
      <div v-else-if="chiour.mediaUrl" class="mb-8">
        <AudioPlayer :src="chiour.mediaUrl" :title="chiour.name" />
      </div>

      <div
        v-else
        class="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-100 text-center dark:bg-gray-800/40 dark:border-gray-700"
      >
        <i class="fa-solid fa-volume-xmark text-2xl text-text-secondary/40 mb-2"></i>
        <p class="text-text-secondary dark:text-gray-400">
          {{ t("detailChiour.noAudio") }}
        </p>
      </div>

      <!-- Description -->
      <div
        v-if="chiour.description"
        class="mb-12 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 p-6 dark:bg-gray-800/50 dark:border-gray-700"
      >
        <h2
          class="text-lg font-bold text-text-primary mb-3 flex items-center gap-2 dark:text-gray-100"
        >
          <i class="fa-solid fa-align-left text-primary"></i>
          {{ t("common.description") }}
        </h2>
        <p
          class="text-text-secondary leading-relaxed whitespace-pre-line dark:text-gray-300"
        >
          {{ chiour.description }}
        </p>
      </div>

      <!-- Recommandations -->
      <div v-if="recommendations.length > 0">
        <div class="flex items-center gap-4 mb-6">
          <h2
            class="text-2xl font-bold text-text-primary flex items-center gap-3 dark:text-gray-100"
          >
            <i class="fa-solid fa-headphones text-primary"></i>
            {{ t("detailChiour.recommendations") }}
          </h2>
          <div
            class="h-px flex-grow bg-gradient-to-r from-gray-200 to-transparent dark:from-gray-700"
          ></div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChiourCard
            v-for="rec in recommendations"
            :key="rec.slug"
            :chiour="rec"
            class="h-full"
          />
        </div>
      </div>
    </div>
  </main>
</template>
