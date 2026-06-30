<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { Session } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";
import { TextTypeService } from "../services/textTypeService";
import { DateService } from "../services/dateService";
import { sessionService } from "../services/sessionService";

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
    class="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-white/60 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-white/90 group dark:bg-gray-800/60 dark:border-gray-700 dark:hover:bg-gray-800/80"
    @click="$emit('click', session)"
  >
    <div class="flex justify-between items-start mb-4">
      <h4
        class="text-xl font-bold text-text-primary group-hover:text-primary transition-colors dark:text-gray-100 dark:group-hover:text-primary"
      >
        {{ session.name }}
      </h4>
      <span
        class="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider dark:bg-primary/20"
        >{{ formatTextType(session.type) }}</span
      >
    </div>
    <div class="mb-4">
      <div class="text-text-secondary dark:text-gray-400">
        <strong class="text-text-primary font-semibold dark:text-gray-300"
          >{{ t("common.createdBy") }} :</strong
        >
        {{ session.creatorName }}
      </div>
    </div>
    <!-- Pourcentage de réservation : indique s'il reste de la disponibilité -->
    <div v-if="reservationStats.total > 0" class="mb-4">
      <div class="flex items-center justify-between mb-1.5 text-xs font-medium">
        <span class="text-text-secondary dark:text-gray-400">
          {{ t("shareReading.reservedPercent", { percent: reservationStats.percentage }) }}
        </span>
        <span :class="isFull ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
          {{ isFull ? t("shareReading.sessionFull") : t("shareReading.sessionAvailable") }}
        </span>
      </div>
      <div class="h-2 w-full bg-gray-100 rounded-full overflow-hidden dark:bg-gray-700">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="isFull ? 'bg-red-400 dark:bg-red-500' : 'bg-gradient-to-r from-primary to-secondary'"
          :style="{ width: `${reservationStats.percentage}%` }"
        ></div>
      </div>
    </div>

    <div class="pt-4 border-t border-black/5 dark:border-white/10">
      <span class="text-sm text-text-secondary flex items-center gap-2 dark:text-gray-400">
        <i class="far fa-calendar-alt"></i>
        <strong>{{ t("common.dateLimit") }} :</strong> {{ formatDate(session.dateLimit) }}
      </span>
    </div>
  </div>
</template>
