<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { getTehilimOfDay } from "../services/dailyCycles";
import { hubPath } from "../content/etudeTexts";
import { analyticsService } from "../services/analyticsService";
import AppIcon from "./icons/AppIcon.vue";

/**
 * Les psaumes du jour, en tête des Tehilim de la bibliothèque, le pendant du
 * ChneiMikraBanner sur le Tanakh.
 *
 * Le cycle mensuel n'a pas de page à lui : chaque psaume du jour est un lien
 * direct vers sa page de lecture. Les Tehilim restent un catalogue.
 */

const { t } = useI18n();

const cycle = computed(() => getTehilimOfDay());

// Numéro lu dans le lien de l'entrée ("…/Psalms.N") : les psaumes et les
// entrées du cycle sont alignés, mais autant ne pas dépendre des index.
const links = computed(() =>
  cycle.value.entries.map((entry) => ({
    entry,
    psalm: Number(String(entry.link).split(".").pop()),
  })),
);

const rangeLabel = computed(() => {
  const psalms = cycle.value.psalms;
  if (psalms.length === 1) return t("dailyReading.options.psalmsOne", { n: psalms[0] });
  return t("dailyReading.options.psalmsRange", {
    from: psalms[0],
    to: psalms[psalms.length - 1],
  });
});

function track(psalm: number) {
  analyticsService.capture("tehilim_day_opened", {
    source: "library_tehilim",
    day: cycle.value.day,
    psalm,
  });
}
</script>

<template>
  <div v-if="cycle.entries.length" class="card p-4 animate-[fadeIn_0.4s_ease]">
    <div class="flex items-center gap-3">
      <AppIcon name="book-open" :size="18" class="shrink-0 text-primary" />
      <span class="min-w-0 flex-1">
        <span class="block text-xs font-semibold text-primary">
          {{ t("dailyReading.options.tehilimDayReading", { day: cycle.day }) }}
        </span>
        <span class="block truncate font-medium text-text-primary">{{ rangeLabel }}</span>
      </span>
    </div>
    <!-- Un lien par psaume : le cycle d'un jour va de 2 à 15 psaumes, chacun
         s'ouvre directement sur sa page de lecture. -->
    <div class="mt-3 flex flex-wrap gap-2">
      <RouterLink
        v-for="{ entry, psalm } in links"
        :key="entry.id"
        :to="hubPath(entry)"
        @click="track(psalm)"
        class="chip bg-primary/10 text-primary transition-colors hover:bg-primary/20"
      >
        {{ psalm }}
      </RouterLink>
    </div>
  </div>
</template>
