<script setup lang="ts">
/**
 * La semaine qui vient d'un programme, en histogramme : ce que chaque jour
 * demande. Aujourd'hui, et ce qu'un rattrapage ajoute, à la couleur du
 * thème ; le reste dans la teinte de la pierre ; Chabbat, une barre basse.
 * Un plan se lit à plat : les pierres sont pour ce qu'on a bâti.
 */
import { computed } from "vue";

export interface WeekBar {
  key: string;
  label: string;
  /** Unités prévues, rattrapage compris. */
  units: number;
  /** Ce que le rattrapage y ajoute. */
  extra: number;
  today: boolean;
  rest: boolean;
}

const props = withDefaults(
  defineProps<{
    bars: WeekBar[];
    label: string;
    /** La plus haute barre de la semaine, en px : plus haute dans la feuille « Rattraper ». */
    tallest?: number;
    /**
     * Aujourd'hui tout en couleur (la page d'un programme) ; sans, chaque
     * jour montre ce qu'il demandait et ce que le rattrapage y ajoute.
     */
    markToday?: boolean;
  }>(),
  { tallest: 96, markToday: true },
);

/** La hauteur d'une unité : la journée la plus chargée prend toute la hauteur. */
const scale = computed(() => props.tallest / Math.max(1, ...props.bars.map((bar) => bar.units)));
</script>

<template>
  <div class="flex items-end gap-2" role="img" :aria-label="label">
    <div v-for="bar in bars" :key="bar.key" class="flex min-w-0 flex-1 flex-col items-center">
      <span v-if="!bar.rest" class="mb-1 text-xs font-extrabold tabular-nums text-text-secondary">
        {{ bar.units }}
      </span>
      <span v-if="bar.rest" class="bar-rest w-full" />
      <template v-else>
        <span
          class="bar-extra w-full transition-[height] duration-300"
          :style="{ height: `${(bar.today && markToday ? bar.units : bar.extra) * scale}px` }"
        />
        <span
          v-if="!(bar.today && markToday)"
          class="bar-base w-full transition-[height] duration-300"
          :style="{ height: `${(bar.units - bar.extra) * scale}px` }"
        />
      </template>
      <span class="mt-1.5 text-xs font-semibold text-text-secondary">{{ bar.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.bar-extra {
  border-radius: 3px 3px 0 0;
  background: var(--color-brand);
}
.bar-base {
  border-radius: 0 0 3px 3px;
  background: #e6cd9c;
  box-shadow: inset 0 0 0 2px #cfb07a;
}
.bar-rest {
  height: 14px;
  border-radius: 3px;
  background: #f5efe3;
  box-shadow: inset 0 0 0 2px #e3dac7;
}
@media (prefers-reduced-motion: reduce) {
  .bar-extra,
  .bar-base {
    transition: none;
  }
}
</style>
