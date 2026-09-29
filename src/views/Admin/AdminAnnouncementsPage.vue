<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import AdminSectionHeader from "../../components/admin/AdminSectionHeader.vue";
import AdminFilterBar from "../../components/admin/AdminFilterBar.vue";
import AdminStatus from "../../components/admin/AdminStatus.vue";
import AdminEmpty from "../../components/admin/AdminEmpty.vue";
import AdminSkeleton from "../../components/admin/AdminSkeleton.vue";
import { adminService } from "../../services/adminService";
import { formatAgo } from "../../services/adminFormat";
import { ANNOUNCEMENT_ICONS, type Announcement } from "../../services/announcements";
import { useAdminQueryFilter } from "../../composables/useAdminQueryFilter";
import { refreshAdminSummary } from "../../composables/useAdminSummary";
import { useToast } from "../../composables/useToast";
import { searchItems } from "../../services/fuzzySearch";

/**
 * Les informations de l'équipe, côté backoffice : toutes, brouillons
 * compris, la plus récente d'abord. Chaque ligne ouvre son formulaire ; un
 * incident en cours se clôt d'ici, sans l'ouvrir.
 */
const { t } = useI18n();
const toast = useToast();

const items = ref<Announcement[]>([]);
const isLoading = ref(true);
const hasError = ref(false);
const busyId = ref<string | null>(null);

const FILTERS = ["all", "published", "draft"] as const;
type Filter = (typeof FILTERS)[number];
const filter = useAdminQueryFilter<Filter>(FILTERS, "all");
const search = ref("");

const matches: Record<Filter, (a: Announcement) => boolean> = {
  all: () => true,
  published: (a) => a.published,
  draft: (a) => !a.published,
};

const filterItems = computed(() =>
  FILTERS.map((id) => ({
    id,
    label: t(`admin.announcements.filters.${id}`),
    count: items.value.filter(matches[id]).length,
  })),
);

const filtered = computed(() =>
  searchItems(
    items.value.filter(matches[filter.value]),
    search.value,
    (a) => [a.title.fr, { text: a.body.fr, long: true }],
    { keepOrder: true },
  ),
);

async function load() {
  items.value = await adminService.listAnnouncements();
}

onMounted(async () => {
  try {
    await load();
  } catch (error) {
    console.error("Erreur lors du chargement des informations:", error);
    hasError.value = true;
  } finally {
    isLoading.value = false;
  }
});

async function resolve(a: Announcement) {
  busyId.value = a.id;
  try {
    await adminService.resolveIncident(a.id);
    toast.success(t("admin.announcements.resolvedOk"));
    await load();
    void refreshAdminSummary(true);
  } catch (error) {
    console.error("Erreur lors de la clôture de l'incident:", error);
    toast.error(t("admin.error"));
  } finally {
    busyId.value = null;
  }
}
</script>

<template>
  <AdminSkeleton v-if="isLoading" :rows="4" />

  <div v-else class="animate-[fadeIn_0.3s_ease]">
    <AdminSectionHeader
      :title="t('admin.nav.announcements')"
      :description="t('admin.announcements.intro')"
    >
      <router-link to="/admin/informations/nouvelle" class="btn btn-primary">
        <AppIcon name="plus" :size="15" />
        {{ t("admin.announcements.create") }}
      </router-link>
    </AdminSectionHeader>

    <p v-if="hasError" class="card p-8 text-center text-text-secondary">
      {{ t("admin.error") }}
    </p>

    <template v-else>
      <AdminFilterBar
        v-model:filter="filter"
        v-model:search="search"
        :filters="filterItems"
        :search-placeholder="t('admin.chiourim.searchPlaceholder')"
      />

      <AdminEmpty
        v-if="filtered.length === 0"
        icon="bell"
        :message="items.length === 0 ? t('admin.announcements.empty') : t('admin.chiourim.empty')"
      >
        <router-link
          v-if="items.length === 0"
          to="/admin/informations/nouvelle"
          class="btn btn-primary btn-sm"
        >
          {{ t("admin.announcements.create") }}
        </router-link>
      </AdminEmpty>

      <ul v-else class="card divide-y divide-line overflow-hidden">
        <li
          v-for="a in filtered"
          :key="a.id"
          class="flex flex-col gap-3 p-3 md:flex-row md:items-center md:p-4"
        >
          <span
            class="hidden h-10 w-10 shrink-0 items-center justify-center rounded-control md:flex"
            :class="
              a.kind === 'incident' && !a.resolved
                ? 'bg-red-600/10 text-red-600 dark:text-red-400'
                : 'bg-primary/10 text-primary'
            "
          >
            <AppIcon :name="ANNOUNCEMENT_ICONS[a.kind]" :size="18" />
          </span>
          <router-link :to="`/admin/informations/${a.id}`" class="group min-w-0 flex-1">
            <span
              class="block break-words font-semibold text-text-primary group-hover:text-primary"
            >
              {{ a.title.fr || t("admin.announcements.untitled") }}
            </span>
            <span class="mt-0.5 block truncate text-sm text-text-secondary">
              {{ a.body.fr }}
            </span>
            <span class="mt-2 flex flex-wrap items-center gap-1.5">
              <AdminStatus tone="primary" :label="t(`announcements.kinds.${a.kind}`)" />
              <AdminStatus
                :tone="a.published ? 'success' : 'warning'"
                :label="
                  a.published
                    ? t('admin.chiourim.statusPublished')
                    : t('admin.chiourim.statusDraft')
                "
              />
              <AdminStatus
                v-if="a.kind === 'incident'"
                :tone="a.resolved ? 'neutral' : 'danger'"
                :label="a.resolved ? t('announcements.resolved') : t('announcements.ongoing')"
              />
              <AdminStatus
                v-if="a.notifiedAt"
                tone="neutral"
                icon="bell"
                :label="t('admin.announcements.notified')"
              />
              <span v-if="a.publishedAt" class="text-xs text-text-secondary">
                {{ formatAgo(a.publishedAt, t) }}
              </span>
            </span>
          </router-link>
          <button
            v-if="a.kind === 'incident' && a.published && !a.resolved"
            type="button"
            class="btn btn-soft btn-sm shrink-0 self-start md:self-center"
            :disabled="busyId === a.id"
            @click="resolve(a)"
          >
            <AppIcon
              :name="busyId === a.id ? 'spinner' : 'circle-check'"
              :size="13"
              :class="{ 'animate-spin': busyId === a.id }"
            />
            {{ t("admin.announcements.markResolved") }}
          </button>
        </li>
      </ul>
    </template>
  </div>
</template>
