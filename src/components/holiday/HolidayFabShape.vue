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
      <!-- la soucca : les parois de planches, le rideau de l'entrée à
           gauche, et le sékhakh de feuillage qui déborde du toit -->
      <path class="body" d="M9 24h46v32a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4Z" />
      <path class="plank" d="M22 27v31" />
      <path class="plank" d="M34 27v31" />
      <path class="plank" d="M46 27v31" />
      <path class="curtain" d="M13 27c3 8-1 16 3 31h5c-4-15 0-23-3-31Z" />
      <path class="detail" d="M2 26c2-8 10-12 17-8 3-6 12-8 17-3 5-6 15-4 19 2 5-1 8 3 7 9H2Z" />
      <path class="detail" d="M4 26c-2 4-1 8 2 11 2-4 1-8-2-11Z" />
      <path class="detail" d="M60 26c2 4 1 8-2 11-2-4-1-8 2-11Z" />
      <path class="frond" d="m12 23 4-6" />
      <path class="frond" d="m21 21 3-6" />
      <path class="frond" d="m31 20 1-6" />
      <path class="frond" d="m41 21-2-6" />
      <path class="frond" d="m50 23-4-5" />
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
   42/64 : la boîte remonte d'autant pour que ce centre soit celui du bouton
   (3.25rem de haut). */
.fab-shape-tichri {
  top: -1.05rem;
}
.fab-shape-souccot {
  top: -1.35rem;
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
/* Les planches et le rideau : du blanc voilé sur la couleur pleine, pas une
   couleur de plus. Les nervures du feuillage reprennent la couleur du corps. */
.plank {
  fill: none;
  stroke: rgb(255 255 255 / 0.22);
  stroke-width: 1.5;
}
.curtain {
  fill: rgb(255 255 255 / 0.4);
}
.frond {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 1.5;
  stroke-linecap: round;
}
.detail-stroke {
  fill: none;
  stroke: var(--color-secondary);
  stroke-width: 3.5;
  stroke-linecap: round;
}
</style>
