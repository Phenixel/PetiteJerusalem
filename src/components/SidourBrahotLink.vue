<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { analyticsService } from "../services/analyticsService";
import AppIcon from "./icons/AppIcon.vue";

/**
 * Le renvoi du sidour vers le livre des Brahot : le Birkat Hamazon, la
 * brakha a'harona et les bénédictions de ce qu'on mange vivent dans les
 * Brahot, et l'on vient souvent les chercher dans le sidour. Une ligne
 * discrète, comme la reprise de lecture, et l'événement `sidour_brahot_opened`
 * pour savoir combien les y cherchent (voir docs/tracking-plan.md).
 */

const props = defineProps<{
  /** Le lecteur avait tapé une recherche dans le sidour. */
  searching: boolean;
}>();

const { t } = useI18n();

function track() {
  analyticsService.capture("sidour_brahot_opened", {
    source: "library_sidour",
    had_search: props.searching,
  });
}
</script>

<template>
  <p
    class="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-sm text-text-secondary"
  >
    <span>{{ t("study.sidourBrahot.question") }}</span>
    <RouterLink
      to="/bibliotheque/brahot"
      class="group inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
      @click="track"
    >
      <AppIcon name="book-open" :size="14" class="shrink-0" />
      {{ t("study.sidourBrahot.link") }}
    </RouterLink>
  </p>
</template>
