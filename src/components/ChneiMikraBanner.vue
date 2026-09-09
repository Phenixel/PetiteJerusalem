<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { parashaTitle } from "../services/dailyCycles";
import { useWeeklyParasha } from "../composables/useTehilimDay";
import { analyticsService } from "../services/analyticsService";
import AppIcon from "./icons/AppIcon.vue";

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
    class="card card-hover group flex items-center gap-3 p-4 animate-[fadeIn_0.4s_ease]"
  >
    <AppIcon name="book-open" :size="18" class="shrink-0 text-primary" />
    <span class="min-w-0 flex-1">
      <span class="block text-xs font-semibold text-primary">{{ t("chneiMikra.title") }}</span>
      <span
        class="block font-medium text-text-primary transition-colors group-hover:text-primary"
      >
        {{ t("chneiMikra.bannerParasha", { parasha: title }) }}
      </span>
    </span>
  </RouterLink>
</template>
