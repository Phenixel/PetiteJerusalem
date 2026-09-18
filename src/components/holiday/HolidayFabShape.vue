<script setup lang="ts">
import type { HolidayThemeId } from "../../services/holidayThemes";

/**
 * La forme que prend le bouton rond des horaires (BottomTabBar) le temps
 * d'une fête : une pomme à Roch Hachana, une soucca à Souccot. L'horloge
 * reste au milieu, blanche : c'est toujours le bouton des horaires, il a
 * seulement changé d'habit.
 *
 * La silhouette est pleine, à la couleur du thème de la fête, son détail (la
 * feuille de la pomme, le sékhakh de la soucca) à la seconde couleur. Elle se
 * pose sous l'horloge, un peu plus grande que le rond qu'elle remplace pour
 * garder la même présence, et décalée pour que le corps de la forme, où
 * l'horloge se lit, tombe au centre du bouton.
 */
defineProps<{ theme: HolidayThemeId }>();
</script>

<template>
  <svg viewBox="0 0 64 64" aria-hidden="true" class="fab-shape" :class="`fab-shape-${theme}`">
    <template v-if="theme === 'tichri'">
      <!-- la pomme : le corps, la queue, la feuille -->
      <path
        class="body"
        d="M32 19C27 11 11 11 8 27 5 43 17 59 27 59c2 0 4-1 5-1s3 1 5 1c10 0 22-16 19-32C53 11 37 11 32 19Z"
      />
      <path class="detail-stroke" d="M32 19c0-5 1-9 4-12" />
      <path class="detail" d="M35 13c2-7 10-10 16-7-2 7-9 10-16 7Z" />
    </template>
    <template v-else>
      <!-- la soucca : les parois, la traverse, le sékhakh posé dessus -->
      <path class="body" d="M9 26h46v28a6 6 0 0 1-6 6H15a6 6 0 0 1-6-6Z" />
      <path class="beam" d="M5 25h54" />
      <path class="detail-stroke" d="m12 21 5-9" />
      <path class="detail-stroke" d="m20 21 5-9" />
      <path class="detail-stroke" d="m28 21 5-9" />
      <path class="detail-stroke" d="m36 21 5-9" />
      <path class="detail-stroke" d="m44 21 5-9" />
      <path class="detail-stroke" d="m52 21 5-9" />
    </template>
  </svg>
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
/* Le corps de la pomme est centré à 38/64 de sa boîte, celui de la soucca à
   43/64 : la boîte remonte d'autant pour que ce centre soit celui du bouton
   (3.25rem de haut). */
.fab-shape-tichri {
  top: -1.05rem;
}
.fab-shape-souccot {
  top: -1.4rem;
}
.body {
  fill: var(--color-primary);
}
.beam {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 5;
  stroke-linecap: round;
}
.detail {
  fill: var(--color-secondary);
}
.detail-stroke {
  fill: none;
  stroke: var(--color-secondary);
  stroke-width: 3.5;
  stroke-linecap: round;
}
</style>
