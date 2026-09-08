<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { Session } from "../models/models";
import { TextTypeService } from "../services/textTypeService";
import { DateService } from "../services/dateService";
import { sessionService } from "../services/sessionService";
import AppIcon from "./icons/AppIcon.vue";
import ProgressBar from "./ProgressBar.vue";

const { t } = useI18n();

interface Props {
  session: Session;
}

const props = defineProps<Props>();
defineEmits<{
  click: [session: Session];
}>();

// Aperçu de la disponibilité : pourcentage de sections déjà réservées.
const reservationStats = computed(() => sessionService.getSessionReservationStats(props.session));
const isFull = computed(() => reservationStats.value.percentage >= 100);
</script>

<template>
  <div
    class="card card-hover p-6 cursor-pointer group flex flex-col gap-4"
    @click="$emit('click', session)"
  >
    <div class="flex justify-between items-start gap-3">
      <h4 class="text-xl font-bold text-text-primary group-hover:text-primary transition-colors">
        {{ session.name }}
      </h4>
      <span class="chip bg-primary/10 text-primary">{{
        TextTypeService.formatType(session.type)
      }}</span>
    </div>
    <div class="text-text-secondary text-sm">
      {{ t("common.createdBy") }}
      <strong class="text-text-primary">{{ session.creatorName }}</strong>
    </div>
    <!-- Pourcentage de réservation : indique s'il reste de la disponibilité -->
    <div v-if="reservationStats.total > 0">
      <div class="flex items-center justify-between mb-1.5 text-xs font-medium">
        <span class="text-text-secondary">
          {{ t("shareReading.reservedPercent", { percent: reservationStats.percentage }) }}
        </span>
        <span
          :class="isFull ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'"
        >
          {{ isFull ? t("shareReading.sessionFull") : t("shareReading.sessionAvailable") }}
        </span>
      </div>
      <ProgressBar
        :value="reservationStats.percentage"
        :tone="isFull ? 'success' : 'primary'"
        size="xs"
        :label="t('shareReading.reservedPercent', { percent: reservationStats.percentage })"
      />
    </div>

    <span class="text-sm text-text-secondary flex items-center gap-2 mt-auto">
      <AppIcon name="calendar" :size="15" />
      {{ t("common.dateLimitValue", { date: DateService.formatDate(session.dateLimit) }) }}
    </span>
  </div>
</template>
