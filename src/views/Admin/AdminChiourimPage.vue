<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import type { ChiourDoc } from "../../models/models";
import { adminService, type AuteurWithId, type SerieWithId } from "../../services/adminService";
import { useToast } from "../../composables/useToast";
import AppIcon from "../../components/icons/AppIcon.vue";

const { t } = useI18n();
const toast = useToast();

const isLoading = ref(true);
const chiourim = ref<ChiourDoc[]>([]);
const auteurs = ref<AuteurWithId[]>([]);
const series = ref<SerieWithId[]>([]);

type Filter = "all" | "draft" | "published" | "noAuteur" | "noSerie";
const filter = ref<Filter>("all");
const search = ref("");

// Sélection multiple pour le rattrapage en masse
const selected = ref<Set<string>>(new Set());
const batchAuteurId = ref("");
const batchSerieId = ref("");
const isBatchSaving = ref(false);
const togglingSlug = ref<string | null>(null);

const filters: Filter[] = ["all", "draft", "published", "noAuteur", "noSerie"];

const serieNameById = computed(() => new Map(series.value.map((s) => [s.id, s.name])));

const filtered = computed(() => {
  let list = chiourim.value;
  if (filter.value === "draft") list = list.filter((c) => !c.published);
  if (filter.value === "published") list = list.filter((c) => c.published);
  if (filter.value === "noAuteur") list = list.filter((c) => !c.auteurId);
  if (filter.value === "noSerie") list = list.filter((c) => !c.serieId);
  const term = search.value.trim().toLowerCase();
  if (term) {
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.auteur?.toLowerCase().includes(term) ?? false) ||
        c.categories.some((cat) => cat.toLowerCase().includes(term)),
    );
  }
  return list;
});

const seriesForBatchAuteur = computed(() =>
  batchAuteurId.value ? series.value.filter((s) => s.auteurId === batchAuteurId.value) : [],
);

async function refresh() {
  [chiourim.value, auteurs.value, series.value] = await Promise.all([
    adminService.listAllChiourim(),
    adminService.listAuteurs(),
    adminService.listSeries(),
  ]);
}

onMounted(async () => {
  try {
    await refresh();
  } finally {
    isLoading.value = false;
  }
});

function toggleSelect(slug: string) {
  const next = new Set(selected.value);
  if (next.has(slug)) next.delete(slug);
  else next.add(slug);
  selected.value = next;
}

function toggleSelectAll() {
  selected.value =
    selected.value.size === filtered.value.length
      ? new Set()
      : new Set(filtered.value.map((c) => c.slug));
}

async function applyBatch() {
  if (selected.value.size === 0 || (!batchAuteurId.value && !batchSerieId.value)) return;
  isBatchSaving.value = true;
  try {
    const fields: Record<string, unknown> = {};
    if (batchAuteurId.value) {
      const auteur = auteurs.value.find((a) => a.id === batchAuteurId.value);
      fields.auteurId = batchAuteurId.value;
      fields.auteur = auteur?.name ?? null;
    }
    if (batchSerieId.value) fields.serieId = batchSerieId.value;
    await adminService.batchUpdateChiourim([...selected.value], fields);
    toast.success(t("admin.chiourim.batchDone", { count: selected.value.size }));
    selected.value = new Set();
    batchAuteurId.value = "";
    batchSerieId.value = "";
    await refresh();
  } catch (error) {
    console.error("Erreur lors du rattrapage en masse:", error);
    toast.error(t("admin.error"));
  } finally {
    isBatchSaving.value = false;
  }
}

async function togglePublished(chiour: ChiourDoc) {
  togglingSlug.value = chiour.slug;
  try {
    await adminService.setPublished(chiour.slug, !chiour.published);
    chiour.published = !chiour.published;
    toast.success(chiour.published ? t("admin.chiourim.publishedOk") : t("admin.chiourim.unpublishedOk"));
  } catch (error) {
    console.error("Erreur lors du changement de publication:", error);
    toast.error(t("admin.error"));
  } finally {
    togglingSlug.value = null;
  }
}
</script>

<template>
  <div v-if="isLoading" class="text-center py-24 text-text-secondary">
    <AppIcon name="spinner" :size="24" class="animate-spin mx-auto mb-4" />
    {{ t("common.loading") }}
  </div>

  <div v-else class="space-y-5 animate-[fadeIn_0.3s_ease]">
    <!-- Filtres + recherche -->
    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="f in filters"
        :key="f"
        class="chip cursor-pointer transition-colors"
        :class="filter === f ? 'bg-primary/15 text-primary font-semibold' : 'opacity-70 hover:opacity-100'"
        @click="filter = f"
      >
        {{ t(`admin.chiourim.filters.${f}`) }}
      </button>
      <div class="relative ml-auto">
        <AppIcon
          name="search"
          :size="14"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
        />
        <input
          v-model="search"
          type="search"
          :placeholder="t('admin.chiourim.searchPlaceholder')"
          class="field pl-9 w-56"
        />
      </div>
    </div>

    <!-- Barre de rattrapage en masse -->
    <div v-if="selected.size > 0" class="card p-4 flex flex-wrap items-center gap-3">
      <span class="font-semibold text-text-primary">
        {{ t("admin.chiourim.selectedCount", { count: selected.size }) }}
      </span>
      <select v-model="batchAuteurId" class="field w-auto appearance-none cursor-pointer">
        <option value="">{{ t("admin.chiourim.batchAuteur") }}</option>
        <option v-for="auteur in auteurs" :key="auteur.id" :value="auteur.id">
          {{ auteur.name }}
        </option>
      </select>
      <select
        v-model="batchSerieId"
        class="field w-auto appearance-none cursor-pointer"
        :disabled="!batchAuteurId"
      >
        <option value="">{{ t("admin.chiourim.batchSerie") }}</option>
        <option v-for="serie in seriesForBatchAuteur" :key="serie.id" :value="serie.id">
          {{ serie.name }}
        </option>
      </select>
      <button
        class="btn btn-primary"
        :disabled="isBatchSaving || (!batchAuteurId && !batchSerieId)"
        @click="applyBatch"
      >
        <AppIcon v-if="isBatchSaving" name="spinner" :size="15" class="animate-spin" />
        {{ t("admin.chiourim.applyBatch") }}
      </button>
    </div>

    <!-- Liste -->
    <p v-if="filtered.length === 0" class="card p-8 text-center text-text-secondary">
      {{ t("admin.chiourim.empty") }}
    </p>

    <template v-else>
      <label class="inline-flex items-center gap-2 cursor-pointer text-sm text-text-secondary">
        <input
          type="checkbox"
          class="w-4 h-4 rounded accent-primary cursor-pointer"
          :checked="selected.size === filtered.length && filtered.length > 0"
          @change="toggleSelectAll"
        />
        {{ t("admin.chiourim.selectAll") }}
      </label>

      <ul class="space-y-2">
        <!-- Titre pleine largeur ; statut et actions en dessous, pour rester
             lisible sur mobile (même disposition que le studio). -->
        <li
          v-for="chiour in filtered"
          :key="chiour.slug"
          class="card p-3 md:p-4 flex items-start gap-3"
        >
          <input
            type="checkbox"
            class="w-4 h-4 mt-1 rounded accent-primary cursor-pointer shrink-0"
            :checked="selected.has(chiour.slug)"
            @change="toggleSelect(chiour.slug)"
          />
          <div class="flex-1 min-w-0">
            <router-link
              :to="`/admin/chiourim/${chiour.slug}`"
              class="font-semibold text-text-primary hover:text-primary break-words block"
            >
              {{ chiour.name }}
            </router-link>
            <p class="text-sm text-text-secondary truncate">
              <span v-if="chiour.auteur">{{ chiour.auteur }}</span>
              <span v-else class="text-amber-700 dark:text-amber-300">{{
                t("admin.chiourim.noAuteur")
              }}</span>
              <template v-if="chiour.serieId && serieNameById.get(chiour.serieId)">
                · {{ serieNameById.get(chiour.serieId) }}
                <template v-if="chiour.episode">({{ chiour.episode }})</template>
              </template>
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
                {{ chiour.published ? t("admin.chiourim.statusPublished") : t("admin.chiourim.statusDraft") }}
              </span>

              <button
                class="btn btn-soft"
                :disabled="togglingSlug === chiour.slug"
                @click="togglePublished(chiour)"
              >
                <AppIcon
                  v-if="togglingSlug === chiour.slug"
                  name="spinner"
                  :size="14"
                  class="animate-spin"
                />
                {{ chiour.published ? t("admin.chiourim.unpublish") : t("admin.chiourim.publish") }}
              </button>

              <router-link :to="`/admin/chiourim/${chiour.slug}`" class="btn btn-soft">
                <AppIcon name="pencil" :size="14" />
              </router-link>
            </div>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
