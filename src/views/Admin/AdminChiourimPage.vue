<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import type { ChiourDoc } from "../../models/models";
import { adminService, type AuteurWithId, type SerieWithId } from "../../services/adminService";
import { useToast } from "../../composables/useToast";
import { useConfirm } from "../../composables/useConfirm";
import { useAdminQueryFilter } from "../../composables/useAdminQueryFilter";
import { refreshAdminSummary } from "../../composables/useAdminSummary";
import AppSelect from "../../components/AppSelect.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import AdminSectionHeader from "../../components/admin/AdminSectionHeader.vue";
import AdminFilterBar from "../../components/admin/AdminFilterBar.vue";
import AdminChiourRow from "../../components/admin/AdminChiourRow.vue";
import AdminEmpty from "../../components/admin/AdminEmpty.vue";
import AdminSkeleton from "../../components/admin/AdminSkeleton.vue";
import { searchItems } from "../../services/fuzzySearch";

/**
 * Le catalogue des chiourim, brouillons compris. Les auteurs déposent par
 * leur lien studio : leurs envois arrivent ici en brouillon, et « À relire »
 * les range du plus récent au plus ancien. Le reste sert au rattrapage :
 * sans auteur, sans série, et le traitement en masse d'une sélection.
 */
const { t } = useI18n();
const toast = useToast();
const { confirm } = useConfirm();
const route = useRoute();
const router = useRouter();

const isLoading = ref(true);
const chiourim = ref<ChiourDoc[]>([]);
const auteurs = ref<AuteurWithId[]>([]);
const series = ref<SerieWithId[]>([]);

const FILTERS = ["all", "draft", "published", "noAuteur", "noSerie"] as const;
type Filter = (typeof FILTERS)[number];
const filter = useAdminQueryFilter<Filter>(FILTERS, "all");
const search = ref("");

const SORTS = ["recent", "name", "views"] as const;
type Sort = (typeof SORTS)[number];
const sortFromQuery = (): Sort => {
  const value = route.query.tri;
  return typeof value === "string" && (SORTS as readonly string[]).includes(value)
    ? (value as Sort)
    : "recent";
};
const sort = ref<Sort>(sortFromQuery());
watch(sort, (value) => {
  const query = { ...route.query };
  if (value === "recent") delete query.tri;
  else query.tri = value;
  void router.replace({ query });
});
// Le lien « Chiourim » du menu retire `?tri=` : le tri affiché suit l'adresse.
watch(
  () => route.query.tri,
  () => {
    const next = sortFromQuery();
    if (next !== sort.value) sort.value = next;
  },
);
const sortOptions = computed(() =>
  SORTS.map((s) => ({ value: s, label: t(`admin.chiourim.sort.${s}`) })),
);

/** Au-delà, « Afficher plus » : une liste de 400 lignes ne se parcourt pas. */
const PAGE = 50;
const shown = ref(PAGE);
const selected = ref<Set<string>>(new Set());
const batchAuteurId = ref("");
const batchSerieId = ref("");
const isBatchSaving = ref(false);
const busySlug = ref<string | null>(null);

const serieNameById = computed(() => new Map(series.value.map((s) => [s.id, s.name])));

const matches: Record<Filter, (c: ChiourDoc) => boolean> = {
  all: () => true,
  draft: (c) => !c.published,
  published: (c) => c.published,
  noAuteur: (c) => !c.auteurId,
  noSerie: (c) => !c.serieId,
};

const filterItems = computed(() =>
  FILTERS.map((id) => ({
    id,
    label: t(`admin.chiourim.filters.${id}`),
    count: chiourim.value.filter(matches[id]).length,
  })),
);

const filtered = computed(() => {
  const list = searchItems(
    chiourim.value.filter(matches[filter.value]),
    search.value,
    (c) => [c.name, c.auteur, ...c.categories],
    { keepOrder: true },
  );
  const sorted = [...list];
  if (sort.value === "recent") {
    sorted.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  } else if (sort.value === "views") {
    sorted.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  }
  return sorted;
});

const visible = computed(() => filtered.value.slice(0, shown.value));

// Changer de filtre, de recherche ou de tri repart des premières lignes, et
// la sélection ne garde que ce qui est encore à l'écran : sinon « Publier »
// emporterait des brouillons cochés sous un autre filtre, que l'on ne voit
// plus.
watch([filter, search, sort], () => {
  shown.value = PAGE;
  const onScreen = new Set(visible.value.map((c) => c.slug));
  const kept = [...selected.value].filter((slug) => onScreen.has(slug));
  if (kept.length !== selected.value.size) selected.value = new Set(kept);
});

const description = computed(() =>
  t("admin.chiourim.summary", {
    total: chiourim.value.length,
    drafts: chiourim.value.filter((c) => !c.published).length,
  }),
);

const auteurOptions = computed(() =>
  auteurs.value.map((auteur) => ({ value: auteur.id, label: auteur.name })),
);
const batchSerieOptions = computed(() =>
  series.value
    .filter((s) => s.auteurId === batchAuteurId.value)
    .map((serie) => ({ value: serie.id, label: serie.name })),
);
watch(batchAuteurId, () => (batchSerieId.value = ""));

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
  } catch (error) {
    // Sans ce rattrapage, l'échec restait un rejet non géré et l'écran
    // affichait « Aucun chiour » comme si le catalogue était vide.
    console.error("Erreur lors du chargement des chiourim:", error);
    toast.error(t("admin.error"));
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

const allVisibleSelected = computed(
  () => visible.value.length > 0 && visible.value.every((c) => selected.value.has(c.slug)),
);

function toggleSelectAll() {
  const next = new Set(selected.value);
  if (allVisibleSelected.value) visible.value.forEach((c) => next.delete(c.slug));
  else visible.value.forEach((c) => next.add(c.slug));
  selected.value = next;
}

function clearSelection() {
  selected.value = new Set();
  batchAuteurId.value = "";
  batchSerieId.value = "";
}

/**
 * Les chiourim cochés ET encore affichés : la sélection est déjà réduite à
 * chaque changement de filtre, mais un traitement en masse ne doit jamais
 * toucher une ligne qu'on n'a pas sous les yeux.
 */
const selectedOnScreen = computed(() => visible.value.filter((c) => selected.value.has(c.slug)));

async function runBatch(fields: Record<string, unknown>, doneKey: string) {
  const slugs = selectedOnScreen.value.map((c) => c.slug);
  const count = slugs.length;
  if (count === 0) return;
  isBatchSaving.value = true;
  try {
    await adminService.batchUpdateChiourim(slugs, fields);
    toast.success(t(doneKey, { count }));
    clearSelection();
    await refresh();
    void refreshAdminSummary(true);
  } catch (error) {
    console.error("Erreur lors du traitement en masse:", error);
    toast.error(t("admin.error"));
  } finally {
    isBatchSaving.value = false;
  }
}

async function applyAttach() {
  if (!batchAuteurId.value) return;
  const auteur = auteurs.value.find((a) => a.id === batchAuteurId.value);
  const fields: Record<string, unknown> = {
    auteurId: batchAuteurId.value,
    auteur: auteur?.name ?? null,
  };
  if (batchSerieId.value) fields.serieId = batchSerieId.value;
  await runBatch(fields, "admin.chiourim.batchDone");
}

async function batchPublish(published: boolean) {
  const accepted = await confirm({
    title: t(
      published ? "admin.chiourim.batchPublishConfirm" : "admin.chiourim.batchUnpublishConfirm",
      { count: selectedOnScreen.value.length },
      selectedOnScreen.value.length,
    ),
    confirmLabel: published ? t("admin.chiourim.publish") : t("admin.chiourim.unpublish"),
    danger: !published,
  });
  if (!accepted) return;
  await runBatch({ published }, "admin.chiourim.batchDone");
}

async function publish(chiour: ChiourDoc) {
  busySlug.value = chiour.slug;
  try {
    await adminService.setPublished(chiour.slug, true);
    chiour.published = true;
    toast.success(t("admin.chiourim.publishedOk"));
    void refreshAdminSummary(true);
  } catch (error) {
    console.error("Erreur lors de la publication:", error);
    toast.error(t("admin.error"));
  } finally {
    busySlug.value = null;
  }
}
</script>

<template>
  <AdminSkeleton v-if="isLoading" />

  <div v-else class="animate-[fadeIn_0.3s_ease]" :class="{ 'pb-28': selected.size > 0 }">
    <AdminSectionHeader :title="t('admin.nav.chiourim')" :description="description" />

    <AdminFilterBar
      v-model:filter="filter"
      v-model:search="search"
      :filters="filterItems"
      :search-placeholder="t('admin.chiourim.searchPlaceholder')"
    >
      <AppSelect v-model="sort" class="w-44" :options="sortOptions" />
    </AdminFilterBar>

    <AdminEmpty
      v-if="filtered.length === 0"
      :icon="filter === 'draft' ? 'circle-check' : 'search'"
      :message="
        filter === 'draft' && !search ? t('admin.chiourim.noDrafts') : t('admin.chiourim.empty')
      "
    />

    <template v-else>
      <label
        class="mb-2 inline-flex cursor-pointer items-center gap-2 px-1 text-sm text-text-secondary"
      >
        <input
          type="checkbox"
          class="h-4 w-4 cursor-pointer rounded accent-primary"
          :checked="allVisibleSelected"
          @change="toggleSelectAll"
        />
        {{ t("admin.chiourim.selectAll") }}
      </label>

      <ul class="card divide-y divide-line overflow-hidden">
        <li v-for="chiour in visible" :key="chiour.slug">
          <AdminChiourRow
            :chiour="chiour"
            :serie-name="chiour.serieId ? serieNameById.get(chiour.serieId) : null"
            selectable
            :selected="selected.has(chiour.slug)"
            :busy="busySlug === chiour.slug"
            @toggle-select="toggleSelect(chiour.slug)"
            @toggle-published="publish(chiour)"
          />
        </li>
      </ul>

      <div v-if="filtered.length > shown" class="mt-4 text-center">
        <button type="button" class="btn btn-soft" @click="shown += PAGE">
          {{ t("admin.showMore", { n: Math.min(PAGE, filtered.length - shown) }) }}
        </button>
      </div>
    </template>

    <!-- Traitement en masse : une barre posée en bas de l'écran tant qu'une
         sélection existe, pour rester à portée pendant qu'on coche. -->
    <div
      v-if="selected.size > 0"
      class="fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
    >
      <div
        class="mx-auto flex max-w-6xl flex-wrap items-center gap-2 rounded-card bg-surface p-3 shadow-pop md:p-4"
      >
        <span class="mr-1 font-semibold text-text-primary">
          {{ t("admin.chiourim.selectedCount", { count: selected.size }) }}
        </span>
        <AppSelect
          v-model="batchAuteurId"
          class="w-60"
          :options="auteurOptions"
          :placeholder="t('admin.chiourim.batchAuteur')"
        />
        <AppSelect
          v-if="batchAuteurId && batchSerieOptions.length"
          v-model="batchSerieId"
          class="w-56"
          :options="batchSerieOptions"
          :placeholder="t('admin.chiourim.batchSerie')"
        />
        <button
          type="button"
          class="btn btn-soft btn-sm"
          :disabled="isBatchSaving || !batchAuteurId"
          @click="applyAttach"
        >
          {{ t("admin.chiourim.applyBatch") }}
        </button>
        <span class="hidden h-6 w-px bg-line md:block"></span>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="isBatchSaving"
          @click="batchPublish(true)"
        >
          <AppIcon v-if="isBatchSaving" name="spinner" :size="13" class="animate-spin" />
          {{ t("admin.chiourim.publish") }}
        </button>
        <button
          type="button"
          class="btn btn-soft btn-sm"
          :disabled="isBatchSaving"
          @click="batchPublish(false)"
        >
          {{ t("admin.chiourim.unpublish") }}
        </button>
        <button
          type="button"
          class="icon-btn ml-auto"
          :aria-label="t('admin.clearSelection')"
          :title="t('admin.clearSelection')"
          @click="clearSelection"
        >
          <AppIcon name="x" :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>
