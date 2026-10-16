<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { psalmsLabel, useTehilimDay } from "../composables/useTehilimDay";
import { analyticsService } from "../services/analyticsService";
import { bindingOf } from "../config/bindings";
import CardArt from "./CardArt.vue";

/**
 * Les psaumes du jour, en tête des Tehilim de la bibliothèque, le pendant du
 * ChneiMikraBanner sur le Tanakh.
 *
 * Rien de plus qu'un lien : le cycle mensuel s'annonce ici, il se lit sur sa
 * page (voir views/Library/TehilimDayPage.vue), qui donne les psaumes du jour
 * les uns sous les autres. La rangée de numéros qu'affichait cet encart
 * demandait autant d'allers-retours qu'il y a de psaumes ce jour-là, jusqu'à
 * quinze ; les Tehilim, eux, restent un catalogue.
 */

const { t } = useI18n();

// Le jour hébraïque (bascule à la chkia), relu au fil du temps : voir useTehilimDay.
const { cycle } = useTehilimDay();

const rangeLabel = computed(() => psalmsLabel(cycle.value.psalms, t));

function track() {
  analyticsService.capture("tehilim_day_opened", {
    source: "library_tehilim",
    day: cycle.value.day,
    psalms_count: cycle.value.psalms.length,
  });
}
</script>

<template>
  <RouterLink
    v-if="cycle.entries.length"
    to="/bibliotheque/tehilim-du-jour"
    @click="track"
    class="card card-hover group relative flex items-center gap-3 p-4 pe-20 animate-[fadeIn_0.4s_ease]"
  >
    <!-- Le volume de l'étagère dans le coin, comme le sidour de la carte de
         l'accueil (voir CardArt) : pas d'icône à gauche qui le redise. -->
    <CardArt
      :art="{ kind: 'volume', color: bindingOf('tehilim'), label: 'Tehilim' }"
      :scale="0.42"
      surface="plain"
    />
    <span class="relative min-w-0 flex-1">
      <span class="block text-xs font-semibold text-primary">
        {{ t("dailyReading.options.tehilimDayReading", { day: cycle.day }) }}
      </span>
      <span class="block font-medium text-text-primary transition-colors group-hover:text-primary">
        {{ rangeLabel }}
      </span>
    </span>
  </RouterLink>
</template>
