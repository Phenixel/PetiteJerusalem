<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { currentMoadimBook } from "../content/moadimNow";
import { useNow } from "../composables/useNow";
import { bookName } from "../services/catalogSearch";
import { analyticsService } from "../services/analyticsService";
import AppIcon from "./icons/AppIcon.vue";

/**
 * Le renvoi du sidour vers Moadim, le temps d'une fête : les textes de
 * Souccot (le loulav, le séder de la nuit, les Hochanot), de Tichri ou de
 * 'Hanouka ne sont pas dans le sidour, et qui l'ouvre ces jours-là les
 * cherche. Même forme que le TehilimDayBanner des Tehilim : un lien, rien
 * de plus. Hors des fêtes, rien.
 */

const { t, locale } = useI18n();
const now = useNow();

const livre = computed(() => currentMoadimBook(now.value));
// Le nom de la fête dans la langue du lecteur : la partie hébraïque du nom du
// livre en hébreu, sa translittération sinon.
const fete = computed(() => {
  if (!livre.value) return "";
  return locale.value === "he" ? livre.value.split(" (")[0] : bookName(livre.value);
});

function track() {
  analyticsService.capture("moadim_now_opened", {
    source: "library_sidour",
    festival: livre.value ? bookName(livre.value) : null,
  });
}
</script>

<template>
  <RouterLink
    v-if="livre"
    to="/bibliotheque/moadim"
    @click="track"
    class="card card-hover group flex items-center gap-3 p-4 animate-[fadeIn_0.4s_ease]"
  >
    <AppIcon name="book-open" :size="18" class="shrink-0 text-primary" />
    <span class="min-w-0 flex-1">
      <span class="block text-xs font-semibold text-primary">
        {{ t("study.moadimNow.label", { fete }) }}
      </span>
      <span class="block font-medium text-text-primary transition-colors group-hover:text-primary">
        {{ t("study.moadimNow.title") }}
      </span>
    </span>
  </RouterLink>
</template>
