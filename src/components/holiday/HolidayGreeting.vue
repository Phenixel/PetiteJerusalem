<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useHolidayTheme } from "../../composables/useHolidayTheme";
import { HOLIDAY_ORNAMENTS } from "./ornaments";

/**
 * La fête sur l'accueil : ses ornements de part et d'autre d'un souhait
 * (« Chana tova oumetouka », « Hag saméah »), au-dessus de la salutation.
 *
 * Posé à même le fond, sans carte : ce n'est pas une donnée qu'on vient
 * consulter mais une parure, et une carte de plus au-dessus du tableau de
 * bord se serait disputé le regard avec celles qui répondent à une question
 * (voir docs/design.md, « Le cadre se mérite »). Absent hors des fêtes, et
 * absent quand le réglage « Thèmes des fêtes » est coupé : la parure va avec
 * les couleurs, pas sans.
 */
const { t } = useI18n();
const { activeHolidayTheme } = useHolidayTheme();
</script>

<template>
  <p
    v-if="activeHolidayTheme"
    class="holiday-greeting flex items-center justify-center gap-4 text-primary md:gap-6"
  >
    <span class="block h-11 w-11 shrink-0 md:h-14 md:w-14">
      <component :is="HOLIDAY_ORNAMENTS[activeHolidayTheme.id][0]" />
    </span>
    <span class="font-display text-xl font-bold tracking-tight md:text-3xl">
      {{ t(`home.holiday.${activeHolidayTheme.id}`) }}
    </span>
    <span class="block h-11 w-11 shrink-0 md:h-14 md:w-14">
      <component :is="HOLIDAY_ORNAMENTS[activeHolidayTheme.id][1]" />
    </span>
  </p>
</template>

<style scoped>
.holiday-greeting {
  opacity: 0;
  animation: holiday-greeting-enter 0.55s ease-out forwards;
}
@keyframes holiday-greeting-enter {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .holiday-greeting {
    animation: none;
    opacity: 1;
  }
}
</style>
