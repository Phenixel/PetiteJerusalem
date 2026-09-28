<script setup lang="ts">
// La série de jours, en clair : combien de jours d'affilée tout a été fait,
// le record, et ce que le jour en fait (déjà comptée, à tenir avant ce soir,
// ou à commencer). Posée dans la carte de progression de la lecture du jour ;
// le bandeau du profil et la carte du tableau de bord ont leur propre dessin,
// plus court (voir DailyStreakStats).
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { StreakStatus } from "../services/dailyStreak";
import AppIcon from "./icons/AppIcon.vue";

const props = defineProps<{ status: StreakStatus }>();

const { t } = useI18n();

const hint = computed(() => {
  if (props.status.doneToday) return t("dailyReading.streak.doneToday");
  if (props.status.pausedToday && props.status.current > 0) {
    return t("dailyReading.streak.paused");
  }
  if (props.status.atRisk && props.status.freezesNeeded > 0) {
    return t("dailyReading.streak.atRiskFreeze", props.status.freezesNeeded);
  }
  if (props.status.atRisk) return t("dailyReading.streak.atRisk");
  if (props.status.best > 0) return t("dailyReading.streak.restart");
  return t("dailyReading.streak.start");
});
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
    <!-- Le compteur : la flamme s'allume à l'accent dès qu'il y a une série,
         reste grise sinon. Le chiffre est ce qu'on vient lire. -->
    <div class="flex items-center gap-2.5">
      <AppIcon
        name="flame"
        :size="26"
        :class="status.current > 0 ? 'text-primary' : 'text-text-secondary/40'"
      />
      <span class="text-3xl font-bold leading-none tabular-nums text-text-primary">
        {{ status.current }}
      </span>
      <span class="text-sm font-medium text-text-secondary leading-tight max-w-[7rem]">
        {{ t("dailyReading.streak.days", status.current) }}
      </span>
    </div>
    <div v-if="status.best > 0" class="flex items-center gap-1.5 text-sm text-text-secondary">
      <AppIcon name="trophy" :size="14" class="text-text-secondary/70" />
      {{ t("dailyReading.streak.best", { n: status.best }) }}
    </div>
    <p class="basis-full text-xs text-text-secondary/80">{{ hint }}</p>
  </div>
</template>
