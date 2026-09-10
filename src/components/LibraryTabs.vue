<script setup lang="ts">
/**
 * Les deux façons d'aborder les textes, en tête de la bibliothèque : les lire,
 * ou se les répartir à plusieurs.
 *
 * App native seulement. Sur le site, le bandeau et le menu mènent au partage
 * de lectures d'un clic depuis n'importe quelle page ; dans l'app, la barre du
 * bas n'a que quatre onglets et le partage n'en a pas : il n'était atteignable
 * que par l'accueil. Il vient donc se ranger là où il a sa place, à côté de la
 * lecture, sur les mêmes textes.
 *
 * Ce sont deux vraies pages, pas deux panneaux : chacune garde son adresse
 * (lien partagé, retour Android, reprise de défilement), l'onglet ne fait que
 * les relier.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { analyticsService } from "../services/analyticsService";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const TABS = [
  { id: "reading", to: "/bibliotheque", labelKey: "study.tabs.reading" },
  { id: "sharing", to: "/share-reading", labelKey: "study.tabs.sharing" },
] as const;

/** Toutes les pages du partage (une session, une création) restent au partage. */
const activeId = computed(() => (route.path.startsWith("/share-reading") ? "sharing" : "reading"));

function go(tab: (typeof TABS)[number]): void {
  if (tab.id === activeId.value) return;
  analyticsService.capture("library_tab_switched", { tab: tab.id });
  void router.push(tab.to);
}
</script>

<template>
  <div class="mb-6 flex justify-center animate-[fadeIn_0.4s_ease]">
    <div
      class="inline-flex p-0.5 rounded-btn bg-black/5 dark:bg-white/10"
      role="group"
      :aria-label="t('study.title')"
    >
      <button
        v-for="tab in TABS"
        :key="tab.id"
        type="button"
        class="rounded-control px-6 py-2 text-sm font-semibold transition-colors"
        :class="
          activeId === tab.id ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary'
        "
        :aria-pressed="activeId === tab.id"
        @click="go(tab)"
      >
        {{ t(tab.labelKey) }}
      </button>
    </div>
  </div>
</template>
