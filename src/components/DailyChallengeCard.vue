<script setup lang="ts">
// Le défi de saison en cours (le 'Omer, les Yamim Noraïm, 'Hanouka) : où l'on
// en est dans sa fenêtre, et combien de journées y ont été réussies.
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { Challenge } from "../services/dailyChallenges";
import AppIcon from "./icons/AppIcon.vue";
import ProgressBar from "./ProgressBar.vue";

const props = defineProps<{ challenge: Challenge; succeeded: number }>();

const { t } = useI18n();
const pct = computed(() => Math.round((props.challenge.day / props.challenge.total) * 100));
</script>

<template>
  <div class="card p-4 flex items-start gap-3">
    <AppIcon name="calendar" :size="18" class="mt-0.5 shrink-0 text-primary" />
    <div class="min-w-0 flex-1">
      <p class="text-xs font-semibold text-primary">{{ t("dailyReading.challenges.kicker") }}</p>
      <p class="font-semibold text-text-primary">
        {{ t(`dailyReading.challenges.${challenge.id}`) }}
      </p>
      <p class="mt-0.5 text-sm text-text-secondary">
        {{
          t("dailyReading.challenges.progress", {
            day: challenge.day,
            total: challenge.total,
            done: succeeded,
          })
        }}
      </p>
      <ProgressBar
        class="mt-2"
        size="xs"
        :value="pct"
        :label="t(`dailyReading.challenges.${challenge.id}`)"
      />
    </div>
  </div>
</template>
