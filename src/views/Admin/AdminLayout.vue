<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { seoService } from "../../services/seoService";
import { useAdminSummary } from "../../composables/useAdminSummary";
import AppIcon from "../../components/icons/AppIcon.vue";
import type { IconName } from "../../components/icons/registry";

/**
 * Le cadre du backoffice : son nom, et ses sections en onglets. Chaque onglet
 * porte le compte de ce qui y attend une décision (chiourim à relire,
 * sessions signalées, incident en cours), pour qu'on sache où aller sans
 * ouvrir chaque page.
 */
const { t } = useI18n();
const route = useRoute();
const summary = useAdminSummary();

onMounted(() => {
  // Backoffice : jamais indexé.
  seoService.setMeta({ title: t("admin.title"), robots: "noindex, nofollow" });
});

// Les comptes suivent la navigation : une section quittée après une action
// les a peut-être changés.
watch(
  () => route.path,
  () => void summary.refresh(),
  { immediate: true },
);

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  badge: number;
  /** Le badge signale un problème (rouge) plutôt qu'un travail en attente. */
  alert?: boolean;
  exact?: boolean;
}

const items = computed<NavItem[]>(() => [
  { to: "/admin", label: t("admin.nav.dashboard"), icon: "home", badge: 0, exact: true },
  {
    to: "/admin/chiourim",
    label: t("admin.nav.chiourim"),
    icon: "headphones",
    badge: summary.drafts.value.length,
  },
  { to: "/admin/auteurs", label: t("admin.nav.auteurs"), icon: "users", badge: 0 },
  {
    to: "/admin/sessions",
    label: t("admin.nav.sessions"),
    icon: "flag",
    badge: summary.reportedSessions.value,
    alert: true,
  },
  {
    to: "/admin/informations",
    label: t("admin.nav.announcements"),
    icon: "bell",
    badge: summary.incident.value ? 1 : 0,
    alert: true,
  },
]);

const isActive = (item: NavItem) =>
  item.exact ? route.path === item.to : route.path.startsWith(item.to);
</script>

<template>
  <main class="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
    <header class="mb-8">
      <p class="flex items-center gap-2 text-sm font-semibold text-text-secondary">
        <AppIcon name="settings" :size="14" />
        {{ t("admin.title") }}
      </p>
      <nav
        class="-mx-4 mt-3 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0"
        :aria-label="t('admin.title')"
      >
        <div class="inline-flex gap-1 rounded-btn bg-black/5 p-1 dark:bg-white/10">
          <router-link
            v-for="item in items"
            :key="item.to"
            :to="item.to"
            class="inline-flex shrink-0 items-center gap-2 rounded-btn px-3.5 py-2 text-sm font-semibold transition-colors"
            :class="
              isActive(item)
                ? 'bg-surface text-text-primary shadow-card'
                : 'text-text-secondary hover:text-text-primary'
            "
            :aria-current="isActive(item) ? 'page' : undefined"
          >
            <AppIcon :name="item.icon" :size="15" />
            {{ item.label }}
            <span
              v-if="item.badge > 0"
              class="min-w-5 rounded-pill px-1.5 text-center text-xs tabular-nums text-white"
              :class="item.alert ? 'bg-red-600' : 'bg-primary'"
            >
              {{ item.badge }}
            </span>
          </router-link>
        </div>
      </nav>
    </header>

    <router-view />
  </main>
</template>
