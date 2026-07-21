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

// Navigation interne : accueil, page d'une série, ou formulaire.
// editing : undefined = fermé, null = ajout, ChiourDoc = édition.
const editing = ref<ChiourDoc | null | undefined>(undefined);
const openSerieId = ref<string | null>(null);
const formPresetSerieId = ref<string | null>(null);

// Mini-formulaire « Ajouter une série »
const addingSerie = ref(false);
const serieName = ref("");
const isCreatingSerie = ref(false);

const deletingSlug = ref<string | null>(null);
const isReordering = ref(false);

const episodeCountBySerie = computed(() => {
  const map = new Map<string, number>();
  chiourim.value.forEach((c) => {
    if (c.serieId) map.set(c.serieId, (map.get(c.serieId) ?? 0) + 1);
  });
  return map;
});

const openSerie = computed(
  () => series.value.find((s) => s.id === openSerieId.value) ?? null,
);

// Épisodes de la série ouverte, triés par numéro (les sans-numéro en fin).
const serieEpisodes = computed(() => {
  const episodes = chiourim.value.filter((c) => c.serieId === openSerieId.value);
  episodes.sort((a, b) => {
    if (a.episode != null && b.episode != null) return a.episode - b.episode;
    if (a.episode != null) return -1;
    if (b.episode != null) return 1;
    return a.name.localeCompare(b.name, "fr");
  });
  return episodes;
});

// Chiourim hors série sur l'accueil (les autres se gèrent depuis leur série).
const horsSerie = computed(() => chiourim.value.filter((c) => !c.serieId));

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

function openAdd(presetSerieId: string | null = null) {
  formPresetSerieId.value = presetSerieId;
  editing.value = null;
}

function openEdit(chiour: ChiourDoc) {
  formPresetSerieId.value = null;
  editing.value = chiour;
}

function closeForm() {
  editing.value = undefined;
  formPresetSerieId.value = null;
}

async function onSaved() {
  toast.success(editing.value ? t("studio.form.updateSuccess") : t("studio.form.success"));
  closeForm();
  await refresh();
}

async function createSerie() {
  const name = serieName.value.trim();
  if (!name) return;
  isCreatingSerie.value = true;
  try {
    const serieId = await studioService.createSerie(token.value, name);
    serieName.value = "";
    addingSerie.value = false;
    toast.success(t("studio.serieCreated"));
    await refresh();
    openSerieId.value = serieId;
  } catch (error) {
    console.error("Erreur lors de la création de la série:", error);
    toast.error(t("studio.form.error"));
  } finally {
    isCreatingSerie.value = false;
  }
}

async function moveEpisode(index: number, delta: number) {
  const target = index + delta;
  const list = [...serieEpisodes.value];
  if (!openSerieId.value || target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];

  isReordering.value = true;
  try {
    await studioService.reorderSerie(
      token.value,
      openSerieId.value,
      list.map((c) => c.slug),
    );
    // Reflet local immédiat : le serveur a réattribué episode = 1..n.
    list.forEach((c, i) => {
      c.episode = i + 1;
    });
    chiourim.value = [...chiourim.value];
  } catch (error) {
    console.error("Erreur lors du réordonnancement:", error);
    toast.error(t("studio.form.error"));
    await refresh();
  } finally {
    isReordering.value = false;
  }
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

      <!-- Formulaire (ajout ou édition) -->
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
          :preset-serie-id="formPresetSerieId"
          :preset-episode="formPresetSerieId ? serieEpisodes.length + 1 : null"
          @saved="onSaved"
          @cancel="closeForm"
        />
      </div>

      <!-- Page d'une série : épisodes ordonnés + réordonnancement -->
      <template v-else-if="openSerie">
        <button
          class="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary mb-6"
          @click="openSerieId = null"
        >
          <AppIcon name="arrow-left" :size="14" />
          {{ t("studio.serieView.back") }}
        </button>

        <div class="flex flex-wrap items-center justify-between gap-4 mb-2">
          <h2 class="text-2xl font-bold text-text-primary flex items-center gap-2">
            <AppIcon name="book-open" :size="20" class="text-secondary" />
            {{ openSerie.name }}
          </h2>
          <button class="btn btn-primary" @click="openAdd(openSerie.id)">
            <AppIcon name="plus" :size="15" />
            {{ t("studio.serieView.addChiour") }}
          </button>
        </div>
        <p class="text-sm text-text-secondary mb-6">
          {{ t("serie.episodesCount", { count: serieEpisodes.length }) }}
          <template v-if="serieEpisodes.length > 1"> · {{ t("studio.serieView.reorderHint") }}</template>
        </p>

        <p v-if="serieEpisodes.length === 0" class="card p-8 text-center text-text-secondary">
          {{ t("studio.serieView.empty") }}
        </p>

        <ul v-else class="space-y-2">
          <!-- Le titre occupe toute la ligne ; badge de statut et actions
               passent en dessous, pour rester lisible sur mobile. -->
          <li
            v-for="(chiour, index) in serieEpisodes"
            :key="chiour.slug"
            class="card p-3 md:p-4 flex items-start gap-3"
          >
            <!-- Réordonnancement -->
            <div class="flex flex-col gap-0.5 shrink-0">
              <button
                class="icon-btn !p-1 disabled:opacity-30"
                :disabled="index === 0 || isReordering"
                :aria-label="t('studio.serieView.moveUp')"
                :title="t('studio.serieView.moveUp')"
                @click="moveEpisode(index, -1)"
              >
                <AppIcon name="chevron-up" :size="14" />
              </button>
              <button
                class="icon-btn !p-1 disabled:opacity-30"
                :disabled="index === serieEpisodes.length - 1 || isReordering"
                :aria-label="t('studio.serieView.moveDown')"
                :title="t('studio.serieView.moveDown')"
                @click="moveEpisode(index, 1)"
              >
                <AppIcon name="chevron-down" :size="14" />
              </button>
            </div>

            <span
              class="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary/10 text-secondary font-bold text-sm shrink-0"
            >
              {{ chiour.episode ?? "?" }}
            </span>

            <div class="flex-1 min-w-0">
              <p class="font-semibold text-text-primary break-words">{{ chiour.name }}</p>
              <p v-if="chiour.categories.length" class="text-sm text-text-secondary truncate">
                {{ chiour.categories.join(", ") }}
              </p>

              <div class="flex flex-wrap items-center gap-2 mt-2.5">
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
                <span
                  v-if="chiour.published"
                  class="inline-flex items-center gap-1 text-sm text-text-secondary"
                >
                  <AppIcon name="eye" :size="14" />
                  {{ t("common.viewsCount", { count: chiour.views ?? 0 }) }}
                </span>
                <button class="btn btn-soft" @click="openEdit(chiour)">
                  {{ t("common.edit") }}
                </button>
                <button
                  v-if="!chiour.published"
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
            </div>
          </li>
        </ul>
      </template>

      <!-- Accueil du studio -->
      <template v-else>
        <!-- Actions principales -->
        <div class="flex flex-wrap gap-3 mb-8">
          <button class="btn btn-primary" @click="openAdd()">
            <AppIcon name="plus" :size="15" />
            {{ t("studio.addChiour") }}
          </button>
          <button class="btn btn-soft" @click="addingSerie = !addingSerie">
            <AppIcon name="book-open" :size="15" />
            {{ t("studio.addSerie") }}
          </button>
        </div>

        <!-- Mini-formulaire de création de série -->
        <form
          v-if="addingSerie"
          class="card p-4 mb-8 flex flex-col sm:flex-row gap-3 animate-[fadeIn_0.3s_ease]"
          @submit.prevent="createSerie"
        >
          <input
            v-model="serieName"
            type="text"
            :placeholder="t('studio.form.newSerieName')"
            required
            class="field flex-1"
          />
          <button type="submit" class="btn btn-primary" :disabled="isCreatingSerie">
            <AppIcon v-if="isCreatingSerie" name="spinner" :size="15" class="animate-spin" />
            {{ t("studio.createSerie") }}
          </button>
        </form>

        <!-- Vos séries : cartes cliquables -->
        <section v-if="series.length" class="mb-10">
          <h2 class="text-xl font-bold text-text-primary mb-4">{{ t("studio.yourSeries") }}</h2>
          <ul class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <li v-for="serie in series" :key="serie.id">
              <button
                class="card card-hover p-4 flex items-center gap-3 w-full text-left"
                @click="openSerieId = serie.id"
              >
                <div
                  class="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary/10 text-secondary shrink-0"
                >
                  <AppIcon name="book-open" :size="17" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-text-primary truncate">{{ serie.name }}</p>
                  <p class="text-sm text-text-secondary">
                    {{ t("serie.episodesCount", { count: episodeCountBySerie.get(serie.id) ?? 0 }) }}
                  </p>
                </div>
                <AppIcon name="chevron-right" :size="15" class="text-text-secondary shrink-0" />
              </button>
            </li>
          </ul>
          <p class="text-xs text-text-secondary/70 mt-2">{{ t("studio.seriesHint") }}</p>
        </section>

        <!-- Chiourim hors série -->
        <section>
          <h2 class="text-xl font-bold text-text-primary mb-5">
            {{ series.length ? t("studio.outOfSerie") : t("studio.yourChiourim") }}
          </h2>

          <p v-if="horsSerie.length === 0" class="card p-8 text-center text-text-secondary">
            {{ series.length ? t("studio.outOfSerieEmpty") : t("studio.empty") }}
          </p>

          <ul v-else class="space-y-3">
            <!-- Même disposition que la page série : titre pleine largeur,
                 statut et actions en dessous (lisible sur mobile). -->
            <li
              v-for="chiour in horsSerie"
              :key="chiour.slug"
              class="card p-4 md:p-5"
            >
              <p class="font-semibold text-text-primary break-words">{{ chiour.name }}</p>
              <p v-if="chiour.categories.length" class="text-sm text-text-secondary truncate">
                {{ chiour.categories.join(", ") }}
              </p>

              <div class="flex flex-wrap items-center gap-2 mt-2.5">
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
                <span
                  v-if="chiour.published"
                  class="inline-flex items-center gap-1 text-sm text-text-secondary"
                >
                  <AppIcon name="eye" :size="14" />
                  {{ t("common.viewsCount", { count: chiour.views ?? 0 }) }}
                </span>
                <button class="btn btn-soft" @click="openEdit(chiour)">
                  {{ t("common.edit") }}
                </button>
                <button
                  v-if="!chiour.published"
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
        </section>
      </template>
    </template>
  </main>
</template>
