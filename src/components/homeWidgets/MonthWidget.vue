<script setup lang="ts">
/**
 * Widget « Mon mois » : les journées de la lecture du jour en grille, la même
 * que sur la page de la lecture du jour (DailyMonthCalendar), avec ses mêmes
 * quatre états.
 *
 * Pas une carte cliquable (voir docs/design.md, « La carte est cliquable ») :
 * elle porte ses propres flèches pour feuilleter les mois d'avant, et un lien
 * dans un lien ne se touche pas. Le titre, lui, mène à la lecture du jour.
 *
 * Le parent fournit l'historique qu'il a déjà lu pour la carte de la lecture
 * du jour : le widget ne relit pas les préférences.
 */
import { useI18n } from "vue-i18n";
import type { DailyHistory } from "../../services/dailyHistory";
import AppIcon from "../icons/AppIcon.vue";
import DailyMonthCalendar from "../DailyMonthCalendar.vue";

defineProps<{
  history: DailyHistory;
  today: string;
  isPause: (key: string) => boolean;
}>();

defineEmits<{ open: [] }>();

const { t } = useI18n();
</script>

<template>
  <section class="card p-5 md:p-6">
    <RouterLink
      to="/bibliotheque/lecture-du-jour"
      class="mb-4 inline-flex items-center gap-2.5 font-semibold text-text-primary transition-colors hover:text-primary"
      @click="$emit('open')"
    >
      <AppIcon name="calendar" :size="17" class="shrink-0 text-primary" />
      <h3>{{ t("home.widgets.catalog.month.name") }}</h3>
    </RouterLink>
    <DailyMonthCalendar :history="history" :today="today" :is-pause="isPause" />
  </section>
</template>
