<script setup lang="ts">
// Modération des sessions (exigence App Store 1.2) : toutes les sessions,
// leurs signalements, et les actions admin — masquer/démasquer, modifier,
// supprimer, résoudre les signalements. Les sessions signalées remontent en
// tête de liste ; au 3e signalement distinct la Cloud Function les a déjà
// masquées automatiquement.
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import type { Session } from "../../models/models";
import { adminService, type ReportWithId } from "../../services/adminService";
import { sessionService } from "../../services/sessionService";
import { useToast } from "../../composables/useToast";
import EditSessionModal from "../../components/EditSessionModal.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import { liveValue } from "../../composables/liveInput";

const { t } = useI18n();
const toast = useToast();

const isLoading = ref(true);
const sessions = ref<Session[]>([]);
const reports = ref<ReportWithId[]>([]);

type Filter = "all" | "reported" | "hidden";
const filters: Filter[] = ["all", "reported", "hidden"];
const filter = ref<Filter>("all");
const search = ref("");

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

const filtered = computed(() => {
  let list = sessions.value;
  if (filter.value === "reported") list = list.filter((s) => openReportsFor(s.id).length > 0);
  if (filter.value === "hidden") list = list.filter((s) => s.hidden === true);

  const term = search.value.trim().toLowerCase();
  if (term) {
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.creatorName || "").toLowerCase().includes(term) ||
        (s.description || "").toLowerCase().includes(term),
    );
  }

  // Les sessions à traiter d'abord : signalées, puis masquées, puis récentes.
  return [...list].sort((a, b) => {
    const reportsDiff = openReportsFor(b.id).length - openReportsFor(a.id).length;
    if (reportsDiff !== 0) return reportsDiff;
    const hiddenDiff = Number(b.hidden === true) - Number(a.hidden === true);
    if (hiddenDiff !== 0) return hiddenDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
});

async function refresh() {
  [sessions.value, reports.value] = await Promise.all([
    adminService.listAllSessions(),
    adminService.listReports(),
  ]);
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

async function saveSessionChanges(sessionData: {
  name: string;
  description: string;
  dateLimit: string;
  guestEmailRequired: boolean;
}) {
  const target = editTarget.value;
  if (!target) return;

  try {
    await sessionService.updateSession(target.id, { ...sessionData, slug: target.slug });
    toast.success(t("profile.sessionUpdatedSuccess"));
    await refresh();
  } catch (error) {
    console.error("Erreur lors de la mise à jour:", error);
    toast.errorFromException(error, t("profile.sessionUpdateError"));
  }
}

async function deleteSession(session: Session) {
  if (!confirm(t("admin.sessions.deleteConfirm", { name: session.name }))) return;

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

const formatDate = (date: Date | undefined) =>
  date ? sessionService.formatDate(date) : "";
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
        {{ t(`admin.sessions.filters.${f}`) }}
      </button>
      <div class="relative ml-auto">
        <AppIcon
          name="search"
          :size="14"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
        />
        <input
          :value="search"
          @input="search = liveValue($event)"
          type="search"
          :placeholder="t('admin.sessions.searchPlaceholder')"
          class="field pl-9 w-56"
        />
      </div>
    </div>

    <!-- Liste -->
    <p v-if="filtered.length === 0" class="card p-8 text-center text-text-secondary">
      {{ t("admin.sessions.empty") }}
    </p>

    <ul v-else class="space-y-2">
      <li v-for="session in filtered" :key="session.id" class="card p-3 md:p-4">
        <div class="flex items-start gap-3">
          <div class="flex-1 min-w-0">
            <router-link
              :to="`/share-reading/session/${session.slug || session.id}`"
              class="font-semibold text-text-primary hover:text-primary break-words block"
            >
              {{ session.name }}
            </router-link>
            <p class="text-sm text-text-secondary truncate">
              {{ session.creatorName }} · {{ formatDate(session.createdAt) }}
            </p>

            <div class="flex flex-wrap items-center gap-2 mt-2.5">
              <span class="chip bg-primary/10 text-primary">
                {{ sessionService.formatTextType(session.type) }}
              </span>
              <span
                v-if="session.hidden"
                class="chip bg-red-600/10 text-red-700 dark:text-red-300"
              >
                {{
                  session.hiddenReason === "reports"
                    ? t("admin.sessions.hiddenAuto")
                    : t("admin.sessions.hiddenByAdmin")
                }}
              </span>
              <!-- Signalements ouverts : le bouton déplie le détail -->
              <button
                v-if="openReportsFor(session.id).length > 0"
                class="chip bg-amber-500/15 text-amber-700 dark:text-amber-300 cursor-pointer"
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

              <button
                class="btn btn-soft !px-3 !py-1.5 !text-sm"
                :disabled="busySessionId === session.id"
                @click="toggleHidden(session)"
              >
                <AppIcon
                  v-if="busySessionId === session.id"
                  name="spinner"
                  :size="14"
                  class="animate-spin"
                />
                <AppIcon v-else name="eye" :size="14" />
                {{ session.hidden ? t("admin.sessions.unhide") : t("admin.sessions.hide") }}
              </button>
              <button
                class="icon-btn"
                :title="t('common.edit')"
                :aria-label="t('common.edit')"
                @click="openEdit(session)"
              >
                <AppIcon name="pencil" :size="15" />
              </button>
              <button
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
        </div>

        <!-- Détail des signalements ouverts -->
        <ul
          v-if="expandedSessionId === session.id && openReportsFor(session.id).length > 0"
          class="mt-3 space-y-2 border-t border-line pt-3"
        >
          <li
            v-for="report in openReportsFor(session.id)"
            :key="report.id"
            class="flex items-start gap-3 text-sm"
          >
            <AppIcon name="flag" :size="13" class="mt-0.5 shrink-0 text-amber-600" />
            <div class="flex-1 min-w-0">
              <p class="font-medium text-text-primary">
                {{ t(`moderation.reasons.${report.reason}`) }}
                <span class="font-normal text-text-secondary">
                  · {{ formatDate(report.createdAt) }}
                </span>
              </p>
              <p v-if="report.details" class="text-text-secondary break-words">
                {{ report.details }}
              </p>
            </div>
            <button
              class="btn btn-soft !px-3 !py-1.5 !text-xs shrink-0"
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

    <EditSessionModal v-model:show="showEditModal" :session="editTarget" @save="saveSessionChanges" />
  </div>
</template>
