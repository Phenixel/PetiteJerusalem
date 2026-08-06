<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { getWeeklyParasha } from "../services/dailyCycles";
import { appendHebrewNumeral } from "../services/hebrewNumerals";
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

const parasha = computed(() => getWeeklyParasha());

const title = computed(() =>
  (parasha.value?.entries ?? []).map((e) => appendHebrewNumeral(e.name)).join(" · "),
);

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
        class="block truncate font-medium text-text-primary transition-colors group-hover:text-primary"
      >
        {{ t("chneiMikra.bannerParasha", { parasha: title }) }}
      </span>
    </span>
    <AppIcon
      name="chevron-right"
      :size="16"
      class="shrink-0 text-text-secondary/60 rtl:rotate-180"
    />
  </RouterLink>
</template>
