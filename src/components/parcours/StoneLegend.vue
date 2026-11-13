<script setup lang="ts">
/** La légende du mur : chaque pierre et ce qu'elle dit. */
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const SAMPLES = [
  { status: "full", look: "is-full v2" },
  { status: "partial", look: "is-partial v4 c1" },
  { status: "rest", look: "is-rest v1" },
  { status: "none", look: "is-none v3" },
] as const;
</script>

<template>
  <ul class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-secondary">
    <li v-for="sample in SAMPLES" :key="sample.status" class="inline-flex items-center gap-1.5">
      <i class="pj-stone legend-stone" :class="sample.look" aria-hidden="true" />
      {{ t(`parcours.wall.legendItems.${sample.status}`) }}
    </li>
  </ul>
</template>

<style scoped>
.legend-stone {
  display: inline-block;
  width: 16px;
  height: 20px;
  cursor: default;
  --joint: 1px;
  --bevel: 2.5px;
}
</style>

<!-- Les pierres : partagées avec le mur (voir stones.css). -->
<style src="./stones.css"></style>
