<script setup lang="ts">
// La fête de la journée réussie : la flamme qui grandit, le nouveau nombre
// de jours, le palier atteint ou le siyoum du jour, et la carte à partager.
// Une seule fois par journée, au moment où la dernière coche tombe.
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import AppModal from "./AppModal.vue";
import AppIcon from "./icons/AppIcon.vue";
import type { StreakStatus } from "../services/dailyStreak";

const props = defineProps<{
  open: boolean;
  status: StreakStatus;
  /** Le palier de série que la journée vient d'atteindre (7, 30, 100, 365). */
  milestone: number | null;
  /** Le traité dont le dernier daf vient d'être coché. */
  siyoum: string | null;
  /** Un joker gagné avec cette journée. */
  freezeEarned: boolean;
  /** Le programme sur N jours qui vient de se finir (son libellé). */
  program: string | null;
}>();
const emit = defineEmits<{ (e: "close"): void; (e: "share"): void }>();

const { t } = useI18n();
const sharing = ref(false);

const headline = computed(() => {
  if (props.program) return t("dailyReading.celebration.program", { label: props.program });
  if (props.siyoum) return t("dailyReading.celebration.siyoum", { tractate: props.siyoum });
  if (props.milestone) return t("dailyReading.celebration.milestone", { n: props.milestone });
  return t("dailyReading.celebration.title");
});

async function share() {
  sharing.value = true;
  try {
    emit("share");
  } finally {
    sharing.value = false;
  }
}
</script>

<template>
  <AppModal
    :open="open"
    :label="t('dailyReading.celebration.title')"
    panel-class="modal-panel celebration-panel animate-[scaleIn_0.3s_ease]"
    @close="emit('close')"
  >
    <div class="p-6 text-center">
      <div class="relative mx-auto mb-4 flex h-24 w-24 items-center justify-center">
        <span class="celebration-halo absolute inset-0 rounded-full bg-primary/15"></span>
        <AppIcon name="flame" :size="56" class="celebration-flame relative text-primary" />
      </div>
      <p class="text-xs font-semibold text-primary">{{ t("dailyReading.celebration.kicker") }}</p>
      <h2 class="mt-1 font-serif text-2xl font-bold text-text-primary">{{ headline }}</h2>
      <p class="mt-3 text-4xl font-bold tabular-nums text-text-primary">
        {{ status.current }}
        <span class="text-base font-medium text-text-secondary">
          {{ t("dailyReading.streak.days", status.current) }}
        </span>
      </p>
      <p v-if="freezeEarned" class="mt-3 text-sm text-text-secondary">
        <AppIcon name="shield" :size="14" class="inline-block align-text-bottom text-primary" />
        {{ t("dailyReading.celebration.freezeEarned") }}
      </p>
      <p
        v-else-if="status.best === status.current && status.current > 1"
        class="mt-3 text-sm text-text-secondary"
      >
        {{ t("dailyReading.celebration.newBest") }}
      </p>
      <div class="mt-6 flex flex-wrap justify-center gap-2">
        <button class="btn btn-soft" :disabled="sharing" @click="share">
          <AppIcon name="share" :size="14" />
          {{ t("dailyReading.streak.share") }}
        </button>
        <button class="btn btn-primary" @click="emit('close')">
          {{ t("dailyReading.celebration.close") }}
        </button>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.celebration-panel {
  max-width: 22rem;
}
.celebration-flame {
  animation: celebrationFlame 0.9s ease-out;
}
.celebration-halo {
  animation: celebrationHalo 1.2s ease-out;
}
@keyframes celebrationFlame {
  0% {
    transform: scale(0.4);
    opacity: 0;
  }
  60% {
    transform: scale(1.15);
    opacity: 1;
  }
  100% {
    transform: scale(1);
  }
}
@keyframes celebrationHalo {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: scale(1.4);
    opacity: 0;
  }
}
</style>
