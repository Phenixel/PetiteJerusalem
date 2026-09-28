<script setup lang="ts">
/**
 * Widget « Tehilim du jour » : les psaumes du jour du mois hébraïque (cycle
 * mensuel), qui se lisent d'une traite sur leur page. Le même encart que
 * celui qui coiffe les Tehilim de la bibliothèque (TehilimDayBanner), à la
 * taille d'une carte de l'accueil.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { psalmsLabel, useTehilimDay } from "../../composables/useTehilimDay";
import AppIcon from "../icons/AppIcon.vue";

const { t } = useI18n();

// Le jour hébraïque (bascule à la chkia), relu au fil du temps.
const { cycle } = useTehilimDay();

const label = computed(() => psalmsLabel(cycle.value.psalms, t));
</script>

<template>
  <RouterLink to="/bibliotheque/tehilim-du-jour" class="card card-hover p-5 md:p-6 block group">
    <h3
      class="font-semibold text-text-primary flex items-center gap-2.5 group-hover:text-primary transition-colors"
    >
      <AppIcon name="book-open" :size="17" class="shrink-0 text-primary" />
      {{ t("home.widgets.catalog.tehilim_day.name") }}
    </h3>
    <p class="mt-3 text-lg font-medium leading-snug text-text-primary">{{ label }}</p>
    <p class="mt-1 text-sm text-text-secondary">
      {{ t("dailyReading.progressChips.tehilim", { day: cycle.day }) }}
    </p>
  </RouterLink>
</template>
