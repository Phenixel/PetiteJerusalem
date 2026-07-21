<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import type { ChiourDoc, SerieDoc } from "../../models/models";
import { studioService, type StudioAuthor } from "../../services/studioService";
import { chiourService } from "../../services/chiourService";
import { seoService } from "../../services/seoService";
import { useToast } from "../../composables/useToast";
import AppIcon from "../../components/icons/AppIcon.vue";
import StudioChiourForm from "./StudioChiourForm.vue";

const route = useRoute();
const { t } = useI18n();
const toast = useToast();

const token = computed(() => String(route.params.token ?? ""));

const isLoading = ref(true);
const author = ref<StudioAuthor | null>(null);
const chiourim = ref<ChiourDoc[]>([]);
const series = ref<(SerieDoc & { id: string })[]>([]);
const categorySuggestions = ref<string[]>([]);

// null = liste ; sinon le formulaire est ouvert (chiour édité, ou null = ajout)
const editing = ref<ChiourDoc | null | undefined>(undefined);
const deletingSlug = ref<string | null>(null);

const serieNameById = computed(() => {
  const map = new Map<string, string>();
  series.value.forEach((s) => map.set(s.id, s.name));
  return map;
});

// Nombre d'épisodes par série (brouillons compris), pour la section « Vos séries ».
const episodeCountBySerie = computed(() => {
  const map = new Map<string, number>();
  chiourim.value.forEach((c) => {
    if (c.serieId) map.set(c.serieId, (map.get(c.serieId) ?? 0) + 1);
  });
  return map;
});

async function refresh() {
  if (!author.value) return;
  [chiourim.value, series.value] = await Promise.all([
    studioService.listMyChiourim(author.value.auteurId),
    studioService.listMySeries(author.value.auteurId),
  ]);
}

onMounted(async () => {
  // Page privée par nature (lien secret) : pas d'indexation.
  seoService.setMeta({ title: t("studio.title"), robots: "noindex, nofollow" });

  try {
    author.value = await studioService.resolveToken(token.value);
    if (author.value) {
      await refresh();
      // Suggestions de catégories : celles déjà utilisées dans le catalogue.
      chiourService.getCategories().then((cats) => {
        categorySuggestions.value = cats;
      });
    }
  } catch (error) {
    // Erreur de chargement : on retombe sur l'écran « lien invalide » plutôt
    // que de rester bloqué sur le chargement.
    console.error("Erreur lors du chargement du studio:", error);
    author.value = null;
  } finally {
    isLoading.value = false;
  }
});

function openAdd() {
  editing.value = null;
}

function openEdit(chiour: ChiourDoc) {
  editing.value = chiour;
}

async function onSaved() {
  toast.success(editing.value ? t("studio.form.updateSuccess") : t("studio.form.success"));
  editing.value = undefined;
  await refresh();
}

async function removeChiour(chiour: ChiourDoc) {
  if (!window.confirm(t("studio.deleteConfirm"))) return;
  deletingSlug.value = chiour.slug;
  try {
    await studioService.deleteChiour(token.value, chiour.slug);
    toast.success(t("studio.deleted"));
    await refresh();
  } catch (error) {
    console.error("Erreur lors de la suppression du chiour:", error);
    toast.error(t("studio.form.error"));
  } finally {
    deletingSlug.value = null;
  }
}
</script>

<template>
  <main class="mx-auto max-w-3xl px-6 py-12 min-h-screen">
    <div v-if="isLoading" class="text-center py-24 text-text-secondary">
      <AppIcon name="spinner" :size="24" class="animate-spin mx-auto mb-4" />
      {{ t("common.loading") }}
    </div>

    <!-- Lien invalide ou révoqué -->
    <div v-else-if="!author" class="card p-8 text-center animate-[fadeIn_0.5s_ease]">
      <AppIcon name="alert-triangle" :size="32" class="mx-auto mb-4 text-text-secondary" />
      <h1 class="text-2xl font-bold text-text-primary mb-2">{{ t("studio.invalidLink") }}</h1>
      <p class="text-text-secondary">{{ t("studio.invalidLinkHint") }}</p>
    </div>

    <template v-else>
      <div class="text-center mb-10 animate-[fadeIn_0.5s_ease]">
        <p class="text-sm font-semibold uppercase tracking-wider text-primary mb-2">
          {{ t("studio.title") }}
        </p>
        <h1 class="text-3xl md:text-4xl font-bold text-text-primary mb-3 tracking-tight">
          {{ t("studio.hello", { name: author.auteurName }) }}
        </h1>
        <p class="text-text-secondary text-lg">{{ t("studio.intro") }}</p>
      </div>

      <!-- Formulaire (ajout ou édition d'un brouillon) -->
      <div v-if="editing !== undefined" class="card p-6 md:p-8 animate-[fadeIn_0.3s_ease]">
        <h2 class="text-xl font-bold text-text-primary mb-6">
          {{ editing ? t("studio.editChiour") : t("studio.addChiour") }}
        </h2>
        <StudioChiourForm
          :key="editing?.slug ?? 'new'"
          :token="token"
          :series="series"
          :category-suggestions="categorySuggestions"
          :chiour="editing"
          @saved="onSaved"
          @cancel="editing = undefined"
        />
      </div>

      <!-- Liste des chiourim de l'auteur -->
      <template v-else>
        <!-- Vos séries : vue d'ensemble (créées via le formulaire d'ajout) -->
        <section v-if="series.length" class="mb-10">
          <h2 class="text-xl font-bold text-text-primary mb-4">{{ t("studio.yourSeries") }}</h2>
          <ul class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <li
              v-for="serie in series"
              :key="serie.id"
              class="card p-4 flex items-center gap-3"
            >
              <div
                class="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary/10 text-secondary shrink-0"
              >
                <AppIcon name="book-open" :size="17" />
              </div>
              <div class="min-w-0">
                <p class="font-semibold text-text-primary truncate">{{ serie.name }}</p>
                <p class="text-sm text-text-secondary">
                  {{ t("serie.episodesCount", { count: episodeCountBySerie.get(serie.id) ?? 0 }) }}
                </p>
              </div>
            </li>
          </ul>
          <p class="text-xs text-text-secondary/70 mt-2">{{ t("studio.seriesHint") }}</p>
        </section>

        <div class="flex items-center justify-between mb-5">
          <h2 class="text-xl font-bold text-text-primary">{{ t("studio.yourChiourim") }}</h2>
          <button class="btn btn-primary" @click="openAdd">
            <AppIcon name="plus" :size="15" />
            {{ t("studio.addChiour") }}
          </button>
        </div>

        <p v-if="chiourim.length === 0" class="card p-8 text-center text-text-secondary">
          {{ t("studio.empty") }}
        </p>

        <ul v-else class="space-y-3">
          <li
            v-for="chiour in chiourim"
            :key="chiour.slug"
            class="card p-4 md:p-5 flex flex-wrap items-center gap-3"
          >
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-text-primary truncate">{{ chiour.name }}</p>
              <p class="text-sm text-text-secondary truncate">
                <template v-if="chiour.serieId && serieNameById.get(chiour.serieId)">
                  {{ serieNameById.get(chiour.serieId) }}
                  <template v-if="chiour.episode"> · {{ t("common.chapter") }} {{ chiour.episode }}</template>
                  <template v-if="chiour.categories.length"> · </template>
                </template>
                {{ chiour.categories.join(", ") }}
              </p>
            </div>

            <span
              class="chip"
              :class="
                chiour.published
                  ? 'bg-green-600/10 text-green-700 dark:text-green-300'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
              "
            >
              {{ chiour.published ? t("studio.published") : t("studio.draft") }}
            </span>

            <!-- Un chiour publié n'est plus modifiable par l'auteur -->
            <div v-if="!chiour.published" class="flex gap-2">
              <button class="btn btn-soft" @click="openEdit(chiour)">
                {{ t("common.edit") }}
              </button>
              <button
                class="btn btn-soft text-red-600 dark:text-red-400"
                :disabled="deletingSlug === chiour.slug"
                @click="removeChiour(chiour)"
              >
                <AppIcon
                  v-if="deletingSlug === chiour.slug"
                  name="spinner"
                  :size="14"
                  class="animate-spin"
                />
                {{ t("common.delete") }}
              </button>
            </div>
          </li>
        </ul>
      </template>
    </template>
  </main>
</template>
