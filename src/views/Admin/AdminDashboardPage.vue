<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import type { IconName } from "../../components/icons/registry";
import AdminStatus from "../../components/admin/AdminStatus.vue";
import AdminSkeleton from "../../components/admin/AdminSkeleton.vue";
import { useAdminSummary } from "../../composables/useAdminSummary";
import { formatAgo, formatCount, formatDuration } from "../../services/adminFormat";

/**
 * L'arrivée dans le backoffice : les chiffres qui comptent, puis ce qui
 * attend une décision, chaque ligne menant droit à la liste filtrée. Quand il
 * n'y a rien à traiter, la page le dit, plutôt que de laisser chercher.
 */
const { t } = useI18n();
const summary = useAdminSummary();

/** Une chaîne au pluriel : « 1 chiour à relire », « 3 chiourim à relire ». */
const tn = (key: string, n: number) => t(key, { n }, n);

interface Stat {
  label: string;
  value: string;
  detail: string;
  icon: IconName;
  to: string;
}

const stats = computed<Stat[]>(() => [
  {
    label: t("admin.dashboard.stats.chiourim"),
    value: formatCount(summary.published.value.length),
    detail: tn("admin.dashboard.stats.chiourimDetail", summary.drafts.value.length),
    icon: "headphones",
    to: "/admin/chiourim",
  },
  {
    label: t("admin.dashboard.stats.views"),
    value: formatCount(summary.totalViews.value),
    detail: t("admin.dashboard.stats.viewsDetail"),
    icon: "eye",
    to: "/admin/chiourim?tri=views",
  },
  {
    label: t("admin.dashboard.stats.sessions"),
    value: formatCount(summary.sessions.value.total),
    detail: tn("admin.dashboard.stats.sessionsDetail", summary.sessions.value.hidden),
    icon: "users",
    to: "/admin/sessions",
  },
  {
    label: t("admin.dashboard.stats.auteurs"),
    value: formatCount(summary.auteurs.value.length),
    detail: tn("admin.dashboard.stats.auteursDetail", summary.auteursWithoutLink.value.length),
    icon: "teacher",
    to: "/admin/auteurs",
  },
]);

interface Todo {
  label: string;
  hint: string;
  icon: IconName;
  to: string;
  tone: "danger" | "warning";
}

const todos = computed<Todo[]>(() => {
  const list: Todo[] = [];
  const incident = summary.incident.value;
  if (incident) {
    list.push({
      label: t("admin.dashboard.todo.incident", { title: incident.title.fr }),
      hint: t("admin.dashboard.todo.incidentHint"),
      icon: "alert-triangle",
      to: `/admin/informations/${incident.id}`,
      tone: "danger",
    });
  }
  if (summary.reportedSessions.value > 0) {
    list.push({
      label: tn("admin.dashboard.todo.reports", summary.reportedSessions.value),
      hint: t("admin.dashboard.todo.reportsHint"),
      icon: "flag",
      to: "/admin/sessions?filtre=reported",
      tone: "danger",
    });
  }
  if (summary.drafts.value.length > 0) {
    list.push({
      label: tn("admin.dashboard.todo.drafts", summary.drafts.value.length),
      hint: t("admin.dashboard.todo.draftsHint"),
      icon: "headphones",
      to: "/admin/chiourim?filtre=draft",
      tone: "warning",
    });
  }
  if (summary.noAuteur.value.length > 0) {
    list.push({
      label: tn("admin.dashboard.todo.noAuteur", summary.noAuteur.value.length),
      hint: t("admin.dashboard.todo.noAuteurHint"),
      icon: "user",
      to: "/admin/chiourim?filtre=noAuteur",
      tone: "warning",
    });
  }
  if (summary.announcementDrafts.value.length > 0) {
    list.push({
      label: tn("admin.dashboard.todo.announcementDrafts", summary.announcementDrafts.value.length),
      hint: t("admin.dashboard.todo.announcementDraftsHint"),
      icon: "bell",
      to: "/admin/informations?filtre=draft",
      tone: "warning",
    });
  }
  return list;
});
</script>

<template>
  <AdminSkeleton v-if="summary.status.value === 'loading' || summary.status.value === 'idle'" />

  <p v-else-if="summary.status.value === 'error'" class="card p-8 text-center text-text-secondary">
    {{ t("admin.error") }}
  </p>

  <div v-else class="space-y-8 animate-[fadeIn_0.3s_ease]">
    <!-- Les chiffres -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 md:gap-4">
      <router-link
        v-for="stat in stats"
        :key="stat.label"
        :to="stat.to"
        class="card card-hover group flex flex-col gap-1 p-4 md:p-5"
      >
        <span class="flex items-center gap-2 text-sm font-semibold text-text-secondary">
          <AppIcon :name="stat.icon" :size="15" />
          {{ stat.label }}
        </span>
        <span
          class="font-display text-3xl font-bold tabular-nums text-text-primary transition-colors group-hover:text-primary md:text-4xl"
        >
          {{ stat.value }}
        </span>
        <span class="text-xs text-text-secondary">{{ stat.detail }}</span>
      </router-link>
    </div>

    <div class="grid gap-6 lg:grid-cols-5">
      <!-- À traiter -->
      <section class="lg:col-span-3">
        <h3 class="mb-3 text-lg font-bold text-text-primary">
          {{ t("admin.dashboard.todoTitle") }}
        </h3>
        <div v-if="todos.length === 0" class="card flex items-center gap-3 p-5 text-text-secondary">
          <AppIcon
            name="circle-check"
            :size="22"
            class="shrink-0 text-green-600 dark:text-green-400"
          />
          {{ t("admin.dashboard.todoEmpty") }}
        </div>
        <ul v-else class="card divide-y divide-line overflow-hidden">
          <li v-for="todo in todos" :key="todo.to">
            <router-link
              :to="todo.to"
              class="group flex items-center gap-3 p-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/5"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-control"
                :class="
                  todo.tone === 'danger'
                    ? 'bg-red-600/10 text-red-600 dark:text-red-400'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                "
              >
                <AppIcon :name="todo.icon" :size="17" />
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block font-semibold leading-snug text-text-primary group-hover:text-primary"
                >
                  {{ todo.label }}
                </span>
                <span class="block text-sm text-text-secondary">{{ todo.hint }}</span>
              </span>
              <AppIcon
                name="chevron-right"
                :size="16"
                class="shrink-0 text-text-secondary/60 rtl:rotate-180"
              />
            </router-link>
          </li>
        </ul>

        <!-- Les derniers chiourim reçus des auteurs, à écouter et publier -->
        <template v-if="summary.drafts.value.length">
          <h3 class="mb-3 mt-8 text-lg font-bold text-text-primary">
            {{ t("admin.dashboard.draftsTitle") }}
          </h3>
          <ul class="card divide-y divide-line overflow-hidden">
            <li v-for="chiour in summary.drafts.value.slice(0, 5)" :key="chiour.slug">
              <router-link
                :to="`/admin/chiourim/${chiour.slug}`"
                class="group flex items-center gap-3 p-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/5"
              >
                <span class="min-w-0 flex-1">
                  <span
                    class="block truncate font-semibold text-text-primary group-hover:text-primary"
                  >
                    {{ chiour.name }}
                  </span>
                  <span class="block truncate text-sm text-text-secondary">
                    {{ chiour.auteur || t("admin.chiourim.noAuteur") }}
                    <template v-if="chiour.duration">
                      · {{ formatDuration(chiour.duration) }}</template
                    >
                    <template v-if="chiour.createdAt">
                      · {{ formatAgo(chiour.createdAt, t) }}</template
                    >
                  </span>
                </span>
                <AdminStatus tone="warning" :label="t('admin.chiourim.statusDraft')" />
              </router-link>
            </li>
          </ul>
        </template>
      </section>

      <!-- Raccourcis et dernière information -->
      <aside class="space-y-6 lg:col-span-2">
        <section>
          <h3 class="mb-3 text-lg font-bold text-text-primary">
            {{ t("admin.dashboard.shortcutsTitle") }}
          </h3>
          <div class="flex flex-wrap gap-2">
            <router-link to="/admin/informations/nouvelle" class="btn btn-primary btn-sm">
              <AppIcon name="bell" :size="14" />
              {{ t("admin.announcements.create") }}
            </router-link>
            <router-link to="/admin/auteurs" class="btn btn-soft btn-sm">
              <AppIcon name="circle-plus" :size="14" />
              {{ t("admin.auteurs.addTitle") }}
            </router-link>
            <router-link to="/" class="btn btn-soft btn-sm">
              <AppIcon name="home" :size="14" />
              {{ t("admin.dashboard.openSite") }}
            </router-link>
          </div>
        </section>

        <section>
          <h3 class="mb-3 text-lg font-bold text-text-primary">
            {{ t("admin.dashboard.latestAnnouncement") }}
          </h3>
          <router-link
            v-if="summary.latestAnnouncement.value"
            :to="`/admin/informations/${summary.latestAnnouncement.value.id}`"
            class="card card-hover group block p-4"
          >
            <span class="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
              <AdminStatus
                tone="primary"
                :label="t(`announcements.kinds.${summary.latestAnnouncement.value.kind}`)"
              />
              {{ formatAgo(summary.latestAnnouncement.value.publishedAt, t) }}
            </span>
            <span class="mt-2 block font-semibold text-text-primary group-hover:text-primary">
              {{ summary.latestAnnouncement.value.title.fr }}
            </span>
            <span class="mt-1 line-clamp-2 block text-sm text-text-secondary">
              {{ summary.latestAnnouncement.value.body.fr }}
            </span>
          </router-link>
          <p v-else class="card p-4 text-sm text-text-secondary">
            {{ t("admin.announcements.empty") }}
          </p>
        </section>

        <section v-if="summary.recent.value.length">
          <h3 class="mb-3 text-lg font-bold text-text-primary">
            {{ t("admin.dashboard.recentTitle") }}
          </h3>
          <ul class="card divide-y divide-line overflow-hidden">
            <li v-for="chiour in summary.recent.value" :key="chiour.slug">
              <router-link
                :to="`/admin/chiourim/${chiour.slug}`"
                class="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/5"
              >
                <span class="min-w-0 flex-1">
                  <span
                    class="block truncate text-sm font-semibold text-text-primary group-hover:text-primary"
                  >
                    {{ chiour.name }}
                  </span>
                  <span class="block truncate text-xs text-text-secondary">
                    {{ chiour.auteur || t("admin.chiourim.noAuteur") }}
                  </span>
                </span>
                <span class="inline-flex shrink-0 items-center gap-1 text-xs text-text-secondary">
                  <AppIcon name="eye" :size="12" />
                  {{ formatCount(chiour.views ?? 0) }}
                </span>
              </router-link>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>
