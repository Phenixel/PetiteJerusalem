<script setup lang="ts">
import { useHolidayTheme } from "../../composables/useHolidayTheme";
import { HOLIDAY_ORNAMENTS } from "./ornaments";

/**
 * Les ornements de la fête posés dans les coins hauts de la page, en filigrane
 * à la couleur du thème, derrière tout le reste : c'est ce qui habille le
 * site et l'app d'une page à l'autre sans que chaque page ait à s'en
 * occuper. Discrets à dessein (une transparence forte) : ils colorent le
 * fond, ils ne se lisent pas ; la page reste ce qu'on regarde.
 *
 * Fixes, comme le mur de pierre : ils ne défilent pas avec la page. App.vue
 * les retire là où le mur se retire (les pages de lecture, où le texte est
 * seul sur le fond) et sur l'accueil, qui porte déjà la fête en tête.
 */
const { activeHolidayTheme } = useHolidayTheme();
</script>

<template>
  <div
    v-if="activeHolidayTheme"
    class="holiday-backdrop pointer-events-none fixed inset-x-0 top-0 z-[-1] text-primary"
    aria-hidden="true"
  >
    <span class="ornament ornament-start">
      <component :is="HOLIDAY_ORNAMENTS[activeHolidayTheme.id][0]" />
    </span>
    <span class="ornament ornament-end">
      <component :is="HOLIDAY_ORNAMENTS[activeHolidayTheme.id][1]" />
    </span>
  </div>
</template>

<style scoped>
/* Sur un téléphone, à hauteur des onglets de page (Lecture / Partage,
   Horaires / Calendrier), qui sont centrés et laissent les côtés libres :
   plus bas, ils passaient sous le champ de recherche. */
.ornament {
  position: absolute;
  top: calc(var(--safe-top, 0px) + 1rem);
  width: 6.5rem;
  height: 6.5rem;
  opacity: 0.14;
}
.ornament-start {
  inset-inline-start: -1rem;
  transform: rotate(-12deg);
}
.ornament-end {
  inset-inline-end: -1rem;
  transform: rotate(10deg);
}
@media (min-width: 768px) {
  .ornament {
    top: 7rem;
    width: 11rem;
    height: 11rem;
  }
  .ornament-start {
    inset-inline-start: 1.5rem;
  }
  .ornament-end {
    inset-inline-end: 1.5rem;
  }
}
</style>
