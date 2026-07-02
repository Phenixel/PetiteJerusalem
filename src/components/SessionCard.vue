<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { Session } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";
import { TextTypeService } from "../services/textTypeService";
import { DateService } from "../services/dateService";
import { sessionService } from "../services/sessionService";
import AppIcon from "./icons/AppIcon.vue";

const { t } = useI18n();

interface Props {
  session: Session;
}

const props = defineProps<Props>();
defineEmits<{
  click: [session: Session];
}>();

const formatTextType = (type: EnumTypeTextStudy): string => {
  return TextTypeService.formatType(type);
};

const formatDate = (date: Date): string => {
  return DateService.formatDate(date);
};

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
      <span class="chip bg-primary/10 text-primary">{{ formatTextType(session.type) }}</span>
    </div>
    <div class="text-text-secondary text-sm">
      {{ t("common.createdBy") }} <strong class="text-text-primary">{{ session.creatorName }}</strong>
    </div>
    <!-- Pourcentage de réservation : indique s'il reste de la disponibilité -->
    <div v-if="reservationStats.total > 0">
      <div class="flex items-center justify-between mb-1.5 text-xs font-medium">
        <span class="text-text-secondary">
          {{ t("shareReading.reservedPercent", { percent: reservationStats.percentage }) }}
        </span>
        <span :class="isFull ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
          {{ isFull ? t("shareReading.sessionFull") : t("shareReading.sessionAvailable") }}
        </span>
      </div>
      <div class="h-1.5 w-full bg-black/5 rounded-full overflow-hidden dark:bg-white/10">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="isFull ? 'bg-red-400 dark:bg-red-500' : 'bg-primary'"
          :style="{ width: `${reservationStats.percentage}%` }"
        ></div>
      </div>
    </div>

    <span class="text-sm text-text-secondary flex items-center gap-2 mt-auto">
      <AppIcon name="calendar" :size="15" />
      {{ t("common.dateLimit") }} : {{ formatDate(session.dateLimit) }}
    </span>
  </div>
</template>
