<script setup lang="ts">
import type { HolidayThemeId } from "../../services/holidayThemes";
import { HOLIDAY_FAB_SHAPES } from "./ornaments";

/**
 * La forme que prend le bouton rond des horaires (BottomTabBar) le temps
 * d'une fête : une pomme, une soucca, un beignet, une figue, une meguila, une
 * matsa, les tables de la loi. L'horloge reste au milieu, blanche : c'est
 * toujours le bouton des horaires, il a seulement changé d'habit.
 *
 * La silhouette est pleine, à la couleur du thème de la fête, son détail (la
 * feuille de la pomme, le sékhakh, la confiture) à la seconde couleur, et ce
 * qui doit s'éclaircir sans ajouter de couleur (les planches, le sucre) en
 * blanc voilé. Elle se pose sous l'horloge, un peu plus grande que le rond
 * qu'elle remplace pour garder la même présence, et remontée d'autant qu'il
 * faut pour que le corps de la forme, où l'horloge se lit, tombe au centre
 * du bouton (voir `top` dans ornaments.ts).
 */
defineProps<{ theme: HolidayThemeId }>();
</script>

<template>
  <component
    :is="HOLIDAY_FAB_SHAPES[theme].shape"
    class="fab-shape"
    :style="{ top: HOLIDAY_FAB_SHAPES[theme].top }"
  />
</template>

<style scoped>
.fab-shape {
  position: absolute;
  left: 50%;
  width: 4.5rem;
  height: 4.5rem;
  transform: translateX(-50%);
  pointer-events: none;
  filter: drop-shadow(0 6px 10px color-mix(in srgb, var(--color-primary) 45%, transparent));
}
.fab-shape :deep(.body) {
  fill: var(--color-primary);
}
.fab-shape :deep(.detail) {
  fill: var(--color-secondary);
}
.fab-shape :deep(.detail-stroke) {
  fill: none;
  stroke: var(--color-secondary);
  stroke-width: 3.5;
  stroke-linecap: round;
}
.fab-shape :deep(.plank),
.fab-shape :deep(.seam) {
  fill: none;
  stroke: rgb(255 255 255 / 0.22);
  stroke-width: 1.5;
}
.fab-shape :deep(.seam) {
  stroke-width: 2.5;
}
.fab-shape :deep(.veil) {
  fill: rgb(255 255 255 / 0.4);
  stroke: rgb(255 255 255 / 0.4);
  stroke-width: 1.5;
}
.fab-shape :deep(.frond) {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 1.5;
  stroke-linecap: round;
}
</style>
