<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
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

const serie = ref<Serie | null>(null);
const episodes = ref<Chiour[]>([]);
const auteurName = ref<string | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);

const loadSerie = async () => {
  const serieId = String(route.params.serieId ?? "");
  error.value = null;
  isLoading.value = true;
  try {
    const [found, all] = await Promise.all([
      serieService.getSerie(serieId),
      chiourService.getAllChiourim(),
    ]);
    if (!found) {
      error.value = t("serie.notFound");
      return;
    }
    serie.value = found;
    episodes.value = serieService.episodesOf(serieId, all);
    auteurName.value = episodes.value.find((c) => c.auteur)?.auteur ?? null;
    seoService.setMeta({
      title: `${found.name} – ${t("chiourim.title")} – Petite Jerusalem`,
      description: found.description || t("serie.seoDescription", { serie: found.name }),
      canonical: window.location.origin + `/chiourim/serie/${serieId}`,
    });
  } catch (err) {
    console.error("Erreur lors du chargement de la série:", err);
    error.value = err instanceof Error ? err.message : t("chiourim.loadError");
  } finally {
    isLoading.value = false;
  }
};

function goToAuteur(auteur: string) {
  router.push(`/chiourim/auteur/${chiourService.generateAuteurSlug(auteur)}`);
}

onMounted(loadSerie);
watch(() => route.params.serieId, loadSerie);
</script>

<template>
  <main class="mx-auto px-6 py-12 max-w-6xl">
    <button @click="router.push('/chiourim')" class="back-link mb-8">
      <AppIcon name="chevron-left" :size="14" />
      {{ t("detailChiour.backToList") }}
    </button>

    <!-- Skeleton -->
    <div v-if="isLoading" class="animate-pulse">
      <div class="h-9 bg-black/10 rounded-lg w-64 mb-3 dark:bg-white/10"></div>
      <div class="h-4 bg-black/10 rounded w-32 mb-10 dark:bg-white/10"></div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="n in 3" :key="n" class="card p-6 h-40"></div>
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
    <div v-else-if="serie" class="animate-[fadeIn_0.3s_ease]">
      <div class="mb-10">
        <p class="text-sm font-semibold uppercase tracking-wider text-primary mb-2">
          {{ t("serie.label") }}
        </p>
        <h1 class="text-3xl md:text-4xl font-bold text-text-primary mb-2">{{ serie.name }}</h1>
        <p class="text-text-secondary">
          {{ t("serie.episodesCount", { count: episodes.length }) }}
          <template v-if="auteurName">
            ·
            <button
              class="font-semibold text-text-primary underline decoration-dotted underline-offset-2 hover:text-primary"
              @click="goToAuteur(auteurName)"
            >
              {{ auteurName }}
            </button>
          </template>
        </p>
        <p v-if="serie.description" class="text-text-secondary mt-3 leading-relaxed">
          {{ serie.description }}
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <ChiourCard
          v-for="chiour in episodes"
          :key="chiour.slug"
          :chiour="chiour"
          :serie-name="serie.name"
          class="h-full"
        />
      </div>
    </div>
  </main>
</template>
