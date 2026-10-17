<script setup lang="ts">
/**
 * « Aujourd'hui », en tête de l'étude : ce qui se lit ce jour-là, réuni en
 * une carte. Les psaumes du jour coiffaient la page des Tehilim, le chnei
 * mikra celle du Tanakh, la lecture du jour finissait la bibliothèque : il
 * fallait savoir où les chercher. Les deux bandeaux restent sur leurs pages ;
 * ici, une ligne chacun, comme les lignes d'une liste, et Ma journée, où
 * en est le parcours aujourd'hui : elle mène à l'accueil, où la pile du
 * jour la montre.
 *
 * Chargée à la demande (voir StudyPage) : elle tire le calendrier hébraïque.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../composables/useParcours";
import { useTehilimDay, useWeeklyParasha } from "../composables/useTehilimDay";
import { parashaTitle } from "../services/dailyCycles";
import { analyticsService } from "../services/analyticsService";
import { daySummary, liveObjectives } from "../services/parcours/schedule";
import AppIcon from "./icons/AppIcon.vue";

const { t } = useI18n();
const { cycle } = useTehilimDay();
const { parasha } = useWeeklyParasha();
const store = useParcours();

const psalms = computed(() => {
  const list = cycle.value.psalms;
  if (list.length === 0) return "";
  const first = list[0];
  const last = list[list.length - 1];
  return first === last
    ? t("study.today.psalm", { n: first })
    : t("study.today.psalms", { from: first, to: last });
});

const parashaLabel = computed(() =>
  parasha.value ? t("study.today.parasha", { parasha: parashaTitle(parasha.value) }) : "",
);

/** Ma journée : où en est le parcours aujourd'hui, ou de quoi le commencer. */
const day = computed(() => {
  const today = store.today.value;
  const { planned, done } = daySummary(store.data.value, today, today, store.context.value);
  const begun = liveObjectives(store.data.value).length > 0;
  const allDone = planned > 0 && done >= planned;
  return {
    begun,
    to: begun ? "/" : "/parcours/nouveau",
    line: !begun
      ? t("parcours.empty.cta")
      : planned === 0
        ? t("parcours.today.nothing")
        : allDone
          ? t("parcours.today.allDone")
          : t("parcours.today.progress", { done, total: planned }),
  };
});

function trackTehilim() {
  analyticsService.capture("tehilim_day_opened", {
    source: "library_today",
    day: cycle.value.day,
    psalms_count: cycle.value.psalms.length,
  });
}
function trackChneiMikra() {
  analyticsService.capture("chnei_mikra_opened", {
    source: "library_today",
    parasha: parasha.value?.names.join("-") ?? null,
  });
}
</script>

<template>
  <section>
    <h2 class="mb-2 ms-1 text-sm font-semibold text-text-secondary">
      {{ t("study.today.title") }}
    </h2>
    <div class="card overflow-hidden">
      <RouterLink
        v-if="cycle.entries.length"
        to="/bibliotheque/tehilim-du-jour"
        class="today-row group"
        @click="trackTehilim"
      >
        <AppIcon name="book" :size="21" class="shrink-0 text-secondary" />
        <span class="flex flex-col gap-0.5 min-w-0">
          <span class="font-semibold text-text-primary group-hover:text-primary transition-colors">
            {{ t("study.today.tehilim") }}
          </span>
          <span class="text-sm text-text-secondary">{{ psalms }}</span>
        </span>
      </RouterLink>
      <RouterLink
        v-if="parasha"
        to="/bibliotheque/chnei-mikra"
        class="today-row group"
        @click="trackChneiMikra"
      >
        <AppIcon name="scroll" :size="21" class="shrink-0 text-secondary" />
        <span class="flex flex-col gap-0.5 min-w-0">
          <span class="font-semibold text-text-primary group-hover:text-primary transition-colors">
            {{ t("chneiMikra.title") }}
          </span>
          <span class="text-sm text-text-secondary">{{ parashaLabel }}</span>
        </span>
      </RouterLink>
      <!-- Ma journée, with or without an account: the line says where the day
           stands (« 2 sur 5 faits aujourd'hui »); a percentage beside it said
           it a second time. -->
      <RouterLink :to="day.to" class="today-row group">
        <AppIcon name="circle-check" :size="21" class="shrink-0 text-secondary" />
        <span class="flex flex-1 flex-col gap-0.5 min-w-0">
          <span class="font-semibold text-text-primary group-hover:text-primary transition-colors">
            {{ t("parcours.day.title") }}
          </span>
          <span
            class="text-sm"
            :class="day.begun ? 'text-text-secondary' : 'font-medium text-primary'"
          >
            {{ day.line }}
          </span>
        </span>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.today-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-height: 3.875rem;
  padding: 0.625rem 1rem;
}
/* Les lignes d'une liste posée dans une carte : un filet entre elles. */
.today-row + .today-row {
  border-top: 1px solid var(--color-line);
}
.today-row:active {
  background-color: color-mix(in srgb, var(--color-text-primary) 5%, transparent);
}
</style>
