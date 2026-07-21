<script setup lang="ts">
import { ref, onMounted, computed, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { chiourService } from "../../services/chiourService";
import { serieService, type Serie } from "../../services/serieService";
import { useViewedChiourim } from "../../composables/useViewedChiourim";
import type { Chiour } from "../../models/models";
import AudioPlayer from "../../components/AudioPlayer.vue";
import ChiourCard from "../../components/ChiourCard.vue";
import ShareModal from "../../components/ShareModal.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import { seoService } from "../../services/seoService";

const route = useRoute();
const router = useRouter();

function goToAuteur(auteur: string) {
  router.push(`/chiourim/auteur/${chiourService.generateAuteurSlug(auteur)}`);
}
const { t } = useI18n();

const { isViewed, markViewed, isLoaded: viewedLoaded } = useViewedChiourim();

const chiour = ref<Chiour | null>(null);
const allChiourim = ref<Chiour[]>([]);
const serie = ref<Serie | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);
// Vrai si l'utilisateur connecté avait DÉJÀ vu ce chiour avant cette visite.
// Capturé juste avant le marquage, une fois la liste des vus chargée (elle
// arrive après le premier rendu au chargement complet de la page).
const wasAlreadyViewed = ref(false);
const viewMarkedFor = ref<string | null>(null);

// Partage (même modal que les sessions de lecture : WhatsApp, SMS, QR, copie)
const showShareModal = ref(false);
const shareUrl = computed(() =>
  chiour.value ? `${window.location.origin}/chiourim/${chiour.value.slug}` : "",
);

watchEffect(() => {
  const current = chiour.value;
  if (!current || !viewedLoaded.value || viewMarkedFor.value === current.slug) return;
  viewMarkedFor.value = current.slug;
  wasAlreadyViewed.value = isViewed(current.slug);
  markViewed(current.slug);
});

const nextEpisode = computed(() => {
  if (!chiour.value || !allChiourim.value.length) return null;
  return serieService.getNextEpisode(chiour.value, allChiourim.value);
});

const previousEpisode = computed(() => {
  if (!chiour.value || !allChiourim.value.length) return null;
  return serieService.getPreviousEpisode(chiour.value, allChiourim.value);
});

// Les épisodes voisins ont leur propre bloc : les recommandations proposent
// autre chose (mêmes catégories / même auteur), sans les dupliquer.
const recommendations = computed(() => {
  if (!chiour.value || !allChiourim.value.length) return [];
  return chiourService
    .getRecommendations(chiour.value, allChiourim.value, 4)
    .filter((r) => r.slug !== nextEpisode.value?.slug && r.slug !== previousEpisode.value?.slug)
    .slice(0, 2);
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
          <!-- Déjà vu lors d'une visite précédente (connecté uniquement) -->
          <span
            v-if="wasAlreadyViewed"
            class="chip bg-green-600/10 text-green-700 inline-flex items-center gap-1 dark:text-green-300"
          >
            <AppIcon name="circle-check" :size="12" />
            {{ t("common.viewed") }}
          </span>
          <span v-for="cat in chiour.categories" :key="cat" class="chip bg-primary/10 text-primary">
            {{ cat }}
          </span>
        </div>

        <!-- Série : pastille cliquable «#n · Nom de la série» vers la page série -->
        <div v-if="serie" class="mb-5">
          <router-link
            :to="`/chiourim/serie/${serie.id}`"
            class="chip bg-secondary/10 text-secondary inline-flex items-center gap-1.5 transition-colors hover:bg-secondary/20"
          >
            <AppIcon name="book-open" :size="13" />
            <span class="font-semibold">
              <template v-if="chiour.episode != null">#{{ chiour.episode }} · </template>{{ serie.name }}
            </span>
            <AppIcon name="chevron-right" :size="12" />
          </router-link>
        </div>

        <!-- Meta : auteur + niveau + partage -->
        <div class="flex flex-wrap items-center gap-x-6 gap-y-3 text-text-secondary">
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
          <button class="btn btn-soft ml-auto" @click="showShareModal = true">
            <AppIcon name="share" :size="15" />
            {{ t("common.share") }}
          </button>
        </div>
      </div>

      <!-- Audio Player (aucun bloc si le chiour n'a pas d'audio) -->
      <div v-if="chiour.mediaUrl" class="mb-8">
        <AudioPlayer :src="chiour.mediaUrl" :title="chiour.name" :slug="chiour.slug" />
      </div>

      <!-- Description : carte standard, comme les cours -->
      <div v-if="chiour.description" class="mb-12 card p-6">
        <h2 class="text-lg font-bold text-text-primary mb-3">
          {{ t("common.description") }}
        </h2>
        <p class="text-text-secondary leading-relaxed whitespace-pre-line">
          {{ chiour.description }}
        </p>
      </div>

      <!-- Navigation dans la série : liens fantômes (fond léger au survol),
           ni carte ni filet. Grille à 2 colonnes : précédent à gauche, suivant
           à droite, TOUJOURS sur la même ligne (jamais de chevauchement, même
           sur mobile) grâce aux placements col-start explicites. -->
      <nav
        v-if="serie && (previousEpisode || nextEpisode)"
        class="mb-12 -mx-3 grid grid-cols-2 gap-2"
      >
        <router-link
          v-if="previousEpisode"
          :to="`/chiourim/${previousEpisode.slug}`"
          class="group flex items-center gap-2.5 min-w-0 rounded-xl px-3 py-2.5 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/5"
          :class="nextEpisode ? 'col-start-1' : 'col-span-2'"
        >
          <AppIcon
            name="chevron-left"
            :size="16"
            class="text-text-secondary shrink-0 transition-transform group-hover:-translate-x-0.5 group-hover:text-primary"
          />
          <span class="min-w-0">
            <span class="block text-xs uppercase tracking-wide text-text-secondary">{{ t("serie.previous") }}</span>
            <span class="block font-semibold text-text-primary group-hover:text-primary transition-colors truncate">
              <template v-if="previousEpisode.episode != null">{{ previousEpisode.episode }}. </template>{{ previousEpisode.name }}
            </span>
          </span>
        </router-link>

        <router-link
          v-if="nextEpisode"
          :to="`/chiourim/${nextEpisode.slug}`"
          class="group flex items-center justify-end gap-2.5 min-w-0 text-right rounded-xl px-3 py-2.5 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/5"
          :class="previousEpisode ? 'col-start-2' : 'col-span-2'"
        >
          <span class="min-w-0">
            <span class="block text-xs uppercase tracking-wide text-text-secondary">{{ t("serie.next") }}</span>
            <span class="block font-semibold text-text-primary group-hover:text-primary transition-colors truncate">
              <template v-if="nextEpisode.episode != null">{{ nextEpisode.episode }}. </template>{{ nextEpisode.name }}
            </span>
          </span>
          <AppIcon
            name="chevron-right"
            :size="16"
            class="text-text-secondary shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
          />
        </router-link>
      </nav>

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

    <ShareModal
      v-if="chiour"
      v-model:show="showShareModal"
      :session-name="chiour.name"
      :share-url="shareUrl"
      title-key="shareModal.titleChiour"
      message-key="shareModal.inviteChiour"
    />
  </main>
</template>
