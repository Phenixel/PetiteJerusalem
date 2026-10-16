<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppSelect from "../../components/AppSelect.vue";
import AdminSectionHeader from "../../components/admin/AdminSectionHeader.vue";
import AdminFilterBar from "../../components/admin/AdminFilterBar.vue";
import AdminEmpty from "../../components/admin/AdminEmpty.vue";
import AdminSkeleton from "../../components/admin/AdminSkeleton.vue";
import AdminSupportStatus from "../../components/admin/AdminSupportStatus.vue";
import AdminStatus from "../../components/admin/AdminStatus.vue";
import { adminService } from "../../services/adminService";
import { formatAgo } from "../../services/adminFormat";
import { searchItems } from "../../services/fuzzySearch";
import { useAdminQueryFilter } from "../../composables/useAdminQueryFilter";
import { refreshAdminSummary } from "../../composables/useAdminSummary";
import { useToast } from "../../composables/useToast";
import {
  SUPPORT_KINDS,
  sortForTeam,
  threadSubject,
  type AdminSupportThread,
  type SupportStatus,
} from "../../services/support";

/**
 * Les messages des utilisateurs : ce que l'ancienne base Notion listait, et
 * de quoi y répondre. Par défaut, ce qui n'est pas terminé (à traiter, puis
 * en cours) ; un filtre par statut, un par nature (idée, bug, erreur), une
 * recherche dans les textes et les contacts. Chaque ligne ouvre son fil.
 */
const { t } = useI18n();
const toast = useToast();

const isLoading = ref(true);
const threads = ref<AdminSupportThread[]>([]);

const FILTERS = ["open", "new", "in_progress", "answered", "done", "all"] as const;
type Filter = (typeof FILTERS)[number];
const filter = useAdminQueryFilter<Filter>(FILTERS, "open");
const search = ref("");
const kind = ref("");

const PAGE = 40;
const shown = ref(PAGE);
watch([filter, search, kind], () => (shown.value = PAGE));

const matches: Record<Filter, (s: SupportStatus) => boolean> = {
  open: (s) => s === "new" || s === "in_progress",
  new: (s) => s === "new",
  in_progress: (s) => s === "in_progress",
  answered: (s) => s === "answered",
  done: (s) => s === "done",
  all: () => true,
};

const ofKind = computed(() =>
  kind.value ? threads.value.filter((th) => th.kind === kind.value) : threads.value,
);

const filterItems = computed(() =>
  FILTERS.map((id) => ({
    id,
    label: t(`admin.support.filters.${id}`),
    count: ofKind.value.filter((th) => matches[id](th.status)).length,
  })),
);

const kindOptions = computed(() =>
  SUPPORT_KINDS.map((k) => ({ value: k, label: t(`admin.support.kinds.${k}`) })),
);

const filtered = computed(() => {
  const list = ofKind.value.filter((th) => matches[filter.value](th.status));
  const found = searchItems(list, search.value, (th) => [
    th.contact,
    th.accountEmail ?? "",
    th.accountName ?? "",
    th.version,
    th.otherKind,
    { text: th.messages.map((m) => m.text).join("\n"), long: true },
  ]);
  return search.value ? found : sortForTeam(found);
});

const visible = computed(() => filtered.value.slice(0, shown.value));

const description = computed(() =>
  t(
    "admin.support.summary",
    { n: threads.value.length, todo: threads.value.filter((th) => th.status === "new").length },
    threads.value.length,
  ),
);

onMounted(async () => {
  try {
    threads.value = await adminService.listSupportThreads();
    void refreshAdminSummary(true);
  } catch (error) {
    console.error("Erreur lors du chargement des messages:", error);
    toast.error(t("admin.error"));
  } finally {
    isLoading.value = false;
  }
});

/** Qui a écrit : le nom du compte, son email, le contact laissé, ou l'appareil. */
function author(th: AdminSupportThread): string {
  if (th.accountName || th.accountEmail) return th.accountName || th.accountEmail || "";
  if (th.contact) return th.contact;
  return th.fromDevice ? t("admin.support.device") : t("admin.support.anonymous");
}

const platformLabel = (th: AdminSupportThread) =>
  th.support === "app"
    ? `${t(`feedback.context.${th.platform}`)}${th.version ? ` ${th.version}` : ""}`
    : t("feedback.context.web");
</script>

<template>
  <AdminSkeleton v-if="isLoading" />

  <div v-else class="animate-[fadeIn_0.3s_ease]">
    <AdminSectionHeader :title="t('admin.nav.support')" :description="description" />

    <AdminFilterBar
      v-model:filter="filter"
      v-model:search="search"
      :filters="filterItems"
      :search-placeholder="t('admin.support.searchPlaceholder')"
    >
      <AppSelect
        v-model="kind"
        class="w-44"
        :options="kindOptions"
        :placeholder="t('admin.support.allKinds')"
      />
    </AdminFilterBar>

    <AdminEmpty
      v-if="filtered.length === 0"
      :icon="filter === 'open' && !search ? 'circle-check' : 'search'"
      :message="
        filter === 'open' && !search ? t('admin.support.noneOpen') : t('admin.support.empty')
      "
    />

    <ul v-else class="card divide-y divide-line overflow-hidden">
      <li v-for="th in visible" :key="th.id">
        <router-link
          :to="`/admin/messages/${th.id}`"
          class="flex flex-col gap-2 p-3 transition-colors hover:bg-black/[0.02] md:flex-row md:items-center md:gap-4 md:p-4 dark:hover:bg-white/[0.03]"
        >
          <div class="min-w-0 flex-1">
            <p class="break-words font-semibold text-text-primary">
              {{ threadSubject(th) }}
            </p>
            <p class="mt-0.5 text-sm text-text-secondary">
              {{ author(th) }} · {{ platformLabel(th) }} ·
              {{ formatAgo(new Date(th.updatedAt), t) }}
              <template v-if="th.messages.length > 1">
                ·
                {{
                  t("admin.support.messagesCount", { n: th.messages.length }, th.messages.length)
                }}
              </template>
            </p>
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-1.5">
            <AdminStatus tone="primary" :label="t(`admin.support.kinds.${th.kind}`)" />
            <AdminSupportStatus :status="th.status" />
            <AdminStatus
              v-if="th.status !== 'done' && th.lastFrom === 'user' && th.messages.length > 1"
              tone="warning"
              icon="message"
              :label="t('admin.support.followUp')"
            />
          </div>
        </router-link>
      </li>
    </ul>

    <div v-if="filtered.length > shown" class="mt-4 text-center">
      <button type="button" class="btn btn-soft" @click="shown += PAGE">
        {{ t("admin.showMore", { n: Math.min(PAGE, filtered.length - shown) }) }}
      </button>
    </div>
  </div>
</template>
