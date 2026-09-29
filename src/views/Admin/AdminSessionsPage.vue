<script setup lang="ts">
// Modération des sessions (exigence App Store 1.2) : toutes les sessions,
// leurs signalements, et les actions admin, masquer/démasquer, modifier,
// supprimer, résoudre les signalements. Les sessions signalées remontent en
// tête de liste ; au 3e signalement distinct la Cloud Function les a déjà
// masquées automatiquement.
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { Session } from "../../models/models";
import { adminService, type ReportWithId } from "../../services/adminService";
import { TextTypeService } from "../../services/textTypeService";
import { DateService } from "../../services/dateService";
import { useToast } from "../../composables/useToast";
import { useSessionEditing, type SessionEditData } from "../../composables/useSessionEditing";
import EditSessionModal from "../../components/EditSessionModal.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import { searchItems } from "../../services/fuzzySearch";
import { useConfirm } from "../../composables/useConfirm";
import { useAdminQueryFilter } from "../../composables/useAdminQueryFilter";
import { refreshAdminSummary } from "../../composables/useAdminSummary";
import { formatCount } from "../../services/adminFormat";
import AdminSectionHeader from "../../components/admin/AdminSectionHeader.vue";
import AdminFilterBar from "../../components/admin/AdminFilterBar.vue";
import AdminStatus from "../../components/admin/AdminStatus.vue";
import AdminEmpty from "../../components/admin/AdminEmpty.vue";
import AdminSkeleton from "../../components/admin/AdminSkeleton.vue";

const { t } = useI18n();
const { confirm } = useConfirm();
const toast = useToast();
const sessionEditing = useSessionEditing("admin");

const isLoading = ref(true);
const sessions = ref<Session[]>([]);
const reports = ref<ReportWithId[]>([]);

const FILTERS = ["all", "reported", "hidden"] as const;
type Filter = (typeof FILTERS)[number];
const filter = useAdminQueryFilter<Filter>(FILTERS, "all");
const search = ref("");

/** Au-delà, « Afficher plus » : les sessions se comptent par centaines. */
const PAGE = 40;
const shown = ref(PAGE);
watch([filter, search], () => (shown.value = PAGE));

// Session dont les signalements sont dépliés.
const expandedSessionId = ref<string | null>(null);
const busySessionId = ref<string | null>(null);

const showEditModal = ref(false);
const editTarget = ref<Session | null>(null);

const reportsBySession = computed(() => {
  const map = new Map<string, ReportWithId[]>();
  for (const report of reports.value) {
    const list = map.get(report.sessionId) ?? [];
    list.push(report);
    map.set(report.sessionId, list);
  }
  return map;
});

const openReportsFor = (sessionId: string) =>
  (reportsBySession.value.get(sessionId) ?? []).filter((r) => r.status === "open");

const matches: Record<Filter, (s: Session) => boolean> = {
  all: () => true,
  reported: (s) => openReportsFor(s.id).length > 0,
  hidden: (s) => s.hidden === true,
};

const filterItems = computed(() =>
  FILTERS.map((id) => ({
    id,
    label: t(`admin.sessions.filters.${id}`),
    count: sessions.value.filter(matches[id]).length,
  })),
);

const filtered = computed(() => {
  let list = sessions.value.filter(matches[filter.value]);

  list = searchItems(list, search.value, (s) => [
    s.name,
    s.creatorName,
    { text: s.description, long: true },
  ]);

  // Les sessions à traiter d'abord : signalées, puis masquées, puis récentes.
  return [...list].sort((a, b) => {
    const reportsDiff = openReportsFor(b.id).length - openReportsFor(a.id).length;
    if (reportsDiff !== 0) return reportsDiff;
    const hiddenDiff = Number(b.hidden === true) - Number(a.hidden === true);
    if (hiddenDiff !== 0) return hiddenDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
});

const visible = computed(() => filtered.value.slice(0, shown.value));

/** Personnes distinctes qui ont réservé au moins un texte. */
const participants = (session: Session) =>
  new Set(
    (session.reservations ?? []).map((r) => r.chosenById || r.chosenByGuestId || r.chosenByName),
  ).size;

async function refresh() {
  [sessions.value, reports.value] = await Promise.all([
    adminService.listAllSessions(),
    adminService.listReports(),
  ]);
  void refreshAdminSummary(true);
}

onMounted(async () => {
  try {
    await refresh();
  } catch (error) {
    console.error("Erreur lors du chargement des sessions:", error);
    toast.error(t("admin.error"));
  } finally {
    isLoading.value = false;
  }
});

function toggleReports(sessionId: string) {
  expandedSessionId.value = expandedSessionId.value === sessionId ? null : sessionId;
}

async function toggleHidden(session: Session) {
  busySessionId.value = session.id;
  try {
    if (session.hidden) {
      await adminService.unhideSession(session.id, openReportsFor(session.id));
      toast.success(t("admin.sessions.unhiddenOk"));
    } else {
      await adminService.hideSession(session.id);
      toast.success(t("admin.sessions.hiddenOk"));
    }
    await refresh();
  } catch (error) {
    console.error("Erreur lors du masquage:", error);
    toast.error(t("admin.error"));
  } finally {
    busySessionId.value = null;
  }
}

async function resolveReport(report: ReportWithId) {
  busySessionId.value = report.sessionId;
  try {
    const remaining = openReportsFor(report.sessionId).filter((r) => r.id !== report.id).length;
    await adminService.resolveReport(report.id, report.sessionId, remaining);
    toast.success(t("admin.sessions.reportResolvedOk"));
    await refresh();
  } catch (error) {
    console.error("Erreur lors de la résolution du signalement:", error);
    toast.error(t("admin.error"));
  } finally {
    busySessionId.value = null;
  }
}

function openEdit(session: Session) {
  editTarget.value = session;
  showEditModal.value = true;
}

async function saveSessionChanges(sessionData: SessionEditData): Promise<boolean> {
  const target = editTarget.value;
  if (!target) return false;

  const saved = await sessionEditing.saveSession(target, sessionData);
  if (saved) await refresh();
  return saved;
}

async function deleteSession(session: Session) {
  const accepted = await confirm({
    title: t("admin.sessions.deleteConfirm", { name: session.name }),
    confirmLabel: t("common.delete"),
    danger: true,
  });
  if (!accepted) return;

  busySessionId.value = session.id;
  try {
    await adminService.deleteSessionWithReports(
      session.id,
      reportsBySession.value.get(session.id) ?? [],
    );
    toast.success(t("admin.sessions.deletedOk"));
    await refresh();
  } catch (error) {
    console.error("Erreur lors de la suppression:", error);
    toast.error(t("admin.error"));
  } finally {
    busySessionId.value = null;
  }
}

const formatDate = (date: Date | undefined) => (date ? DateService.formatDate(date) : "");
</script>

<template>
  <AdminSkeleton v-if="isLoading" />

  <div v-else class="animate-[fadeIn_0.3s_ease]">
    <AdminSectionHeader
      :title="t('admin.nav.sessions')"
      :description="t('admin.sessions.summary')"
    />

    <AdminFilterBar
      v-model:filter="filter"
      v-model:search="search"
      :filters="filterItems"
      :search-placeholder="t('admin.sessions.searchPlaceholder')"
    />

    <AdminEmpty
      v-if="filtered.length === 0"
      :icon="filter === 'reported' ? 'circle-check' : 'search'"
      :message="
        filter === 'reported' && !search ? t('admin.sessions.noReports') : t('admin.sessions.empty')
      "
    />

    <ul v-else class="card divide-y divide-line overflow-hidden">
      <li
        v-for="session in visible"
        :key="session.id"
        class="p-3 md:p-4"
        :class="{ 'bg-red-600/[0.03]': openReportsFor(session.id).length > 0 }"
      >
        <div class="flex flex-col gap-3 md:flex-row md:items-center">
          <div class="min-w-0 flex-1">
            <a
              :href="`/share-reading/session/${session.slug || session.id}`"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1.5 break-words font-semibold text-text-primary hover:text-primary"
            >
              {{ session.name }}
              <AppIcon name="external-link" :size="12" class="shrink-0 opacity-60" />
            </a>
            <p class="mt-0.5 text-sm text-text-secondary">
              {{ session.creatorName }} · {{ formatDate(session.createdAt) }} ·
              {{
                t(
                  "admin.sessions.participants",
                  { n: formatCount(participants(session)) },
                  participants(session),
                )
              }}
            </p>
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <AdminStatus tone="primary" :label="TextTypeService.formatType(session.type)" />
              <AdminStatus
                v-if="session.hidden"
                tone="danger"
                icon="eye"
                :label="
                  session.hiddenReason === 'reports'
                    ? t('admin.sessions.hiddenAuto')
                    : t('admin.sessions.hiddenByAdmin')
                "
              />
              <AdminStatus
                v-if="session.isEnded"
                tone="neutral"
                :label="t('admin.sessions.ended')"
              />
              <!-- Signalements ouverts : la pastille porte une icône, elle
                   déplie leur détail. -->
              <button
                v-if="openReportsFor(session.id).length > 0"
                type="button"
                class="chip cursor-pointer bg-red-600/10 text-red-700 transition-colors hover:bg-red-600/20 dark:text-red-300"
                :aria-expanded="expandedSessionId === session.id"
                @click="toggleReports(session.id)"
              >
                <AppIcon name="flag" :size="12" />
                {{ t("admin.sessions.reportsCount", { count: openReportsFor(session.id).length }) }}
                <AppIcon
                  name="chevron-down"
                  :size="11"
                  class="transition-transform"
                  :class="expandedSessionId === session.id ? 'rotate-180' : ''"
                />
              </button>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-1">
            <button
              type="button"
              class="btn btn-soft btn-sm"
              :disabled="busySessionId === session.id"
              @click="toggleHidden(session)"
            >
              <AppIcon
                v-if="busySessionId === session.id"
                name="spinner"
                :size="13"
                class="animate-spin"
              />
              <AppIcon v-else name="eye" :size="13" />
              {{ session.hidden ? t("admin.sessions.unhide") : t("admin.sessions.hide") }}
            </button>
            <button
              type="button"
              class="icon-btn"
              :title="t('common.edit')"
              :aria-label="t('common.edit')"
              @click="openEdit(session)"
            >
              <AppIcon name="pencil" :size="15" />
            </button>
            <button
              type="button"
              class="icon-btn hover:!bg-red-600/10 hover:!text-red-600 dark:hover:!text-red-400"
              :title="t('common.delete')"
              :aria-label="t('common.delete')"
              :disabled="busySessionId === session.id"
              @click="deleteSession(session)"
            >
              <AppIcon name="trash" :size="15" />
            </button>
          </div>
        </div>

        <!-- Détail des signalements ouverts -->
        <ul
          v-if="expandedSessionId === session.id && openReportsFor(session.id).length > 0"
          class="mt-3 space-y-2 rounded-control bg-surface-soft p-3"
        >
          <li
            v-for="report in openReportsFor(session.id)"
            :key="report.id"
            class="flex items-start gap-3 text-sm"
          >
            <AppIcon
              name="flag"
              :size="13"
              class="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
            />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-text-primary">
                {{ t(`moderation.reasons.${report.reason}`) }}
                <span class="font-normal text-text-secondary">
                  · {{ formatDate(report.createdAt) }}
                </span>
              </p>
              <p v-if="report.details" class="break-words text-text-secondary">
                {{ report.details }}
              </p>
            </div>
            <button
              type="button"
              class="btn btn-soft btn-sm shrink-0"
              :disabled="busySessionId === session.id"
              @click="resolveReport(report)"
            >
              <AppIcon name="check" :size="12" />
              {{ t("admin.sessions.resolveReport") }}
            </button>
          </li>
        </ul>
      </li>
    </ul>

    <div v-if="filtered.length > shown" class="mt-4 text-center">
      <button type="button" class="btn btn-soft" @click="shown += PAGE">
        {{ t("admin.showMore", { n: Math.min(PAGE, filtered.length - shown) }) }}
      </button>
    </div>

    <EditSessionModal
      v-model:show="showEditModal"
      :session="editTarget"
      :save="saveSessionChanges"
    />
  </div>
</template>
