<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { parashaTitle } from "../services/dailyCycles";
import { useWeeklyParasha } from "../composables/useTehilimDay";
import { analyticsService } from "../services/analyticsService";
import { bindingOf } from "../config/bindings";
import CardArt from "./CardArt.vue";

/**
 * L'entrée du chnei mikra, en tête du Tanakh de la bibliothèque.
 *
 * Rien de plus qu'un lien : la paracha de la semaine s'annonce ici, elle se lit
 * sur sa page (voir views/Library/ChneiMikraPage.vue), qui porte le texte et le
 * feuilletage des semaines. Le Tanakh reste un catalogue.
 */

const { t } = useI18n();

// La semaine suit le jour hébraïque : samedi soir, la paracha suivante.
const { parasha } = useWeeklyParasha();

const title = computed(() => parashaTitle(parasha.value));

function track() {
  analyticsService.capture("chnei_mikra_opened", {
    source: "library_tanakh",
    parasha: parasha.value?.names.join("-") ?? null,
  });
}
</script>

<template>
  <RouterLink
    v-if="parasha"
    to="/bibliotheque/chnei-mikra"
    @click="track"
    class="card card-hover group relative flex items-center gap-3 p-4 pe-20 animate-[fadeIn_0.4s_ease]"
  >
    <!-- Le volume de l'étagère dans le coin, comme le sidour de la carte de
         l'accueil (voir CardArt) : pas d'icône à gauche qui le redise. -->
    <CardArt
      :art="{ kind: 'volume', color: bindingOf('tanakh'), label: 'Tanakh' }"
      :scale="0.42"
      surface="plain"
    />
    <span class="relative min-w-0 flex-1">
      <span class="block text-xs font-semibold text-primary">{{ t("chneiMikra.title") }}</span>
      <span class="block font-medium text-text-primary transition-colors group-hover:text-primary">
        {{ t("chneiMikra.bannerParasha", { parasha: title }) }}
      </span>
    </span>
  </RouterLink>
</template>
