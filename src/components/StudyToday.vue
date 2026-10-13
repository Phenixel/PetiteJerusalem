<script setup lang="ts">
/**
 * « Aujourd'hui », en tête de l'étude : ce qui se lit ce jour-là, réuni en
 * une carte. Les psaumes du jour coiffaient la page des Tehilim, le chnei
 * mikra celle du Tanakh, la lecture du jour finissait la bibliothèque : il
 * fallait savoir où les chercher. Les deux bandeaux restent sur leurs pages ;
 * ici, une ligne chacun, comme les lignes d'une liste.
 *
 * Chargée à la demande (voir StudyPage) : elle tire le calendrier hébraïque.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useTehilimDay, useWeeklyParasha } from "../composables/useTehilimDay";
import { parashaTitle } from "../services/dailyCycles";
import { analyticsService } from "../services/analyticsService";
import AppIcon from "./icons/AppIcon.vue";

const props = defineProps<{
  /** Connecté : la lecture du jour a sa ligne. */
  signedIn: boolean;
  done: number;
  total: number;
}>();

const { t } = useI18n();
const { cycle } = useTehilimDay();
const { parasha } = useWeeklyParasha();

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

const pct = computed(() => (props.total === 0 ? 0 : Math.round((props.done / props.total) * 100)));
const allDone = computed(() => props.total > 0 && props.done >= props.total);
const readingLine = computed(() => {
  if (props.total === 0) return t("home.dashboard.readingSetupCta");
  if (allDone.value) return t("dailyReading.allReadTitle");
  return t("dailyReading.progress", { done: props.done, total: props.total });
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
      <!-- La lecture du jour suit le compte : sans lui, rien à reprendre. Le
           chiffre en avant tombe au bout de la ligne, comme sur l'accueil. -->
      <RouterLink v-if="signedIn" to="/bibliotheque/lecture-du-jour" class="today-row group">
        <AppIcon name="circle-check" :size="21" class="shrink-0 text-secondary" />
        <span class="flex flex-1 flex-col gap-0.5 min-w-0">
          <span class="font-semibold text-text-primary group-hover:text-primary transition-colors">
            {{ t("dailyReading.title") }}
          </span>
          <span
            class="text-sm"
            :class="
              allDone
                ? 'text-green-600 dark:text-green-400'
                : total === 0
                  ? 'font-medium text-primary'
                  : 'text-text-secondary'
            "
          >
            {{ readingLine }}
          </span>
        </span>
        <span
          v-if="total > 0"
          class="shrink-0 text-2xl font-bold leading-none tabular-nums"
          :class="allDone ? 'text-green-600 dark:text-green-400' : 'text-primary'"
        >
          {{ pct }}<span class="text-base">%</span>
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
