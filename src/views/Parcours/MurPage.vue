<script setup lang="ts">
/**
 * Le mur entier : toutes les pierres posées depuis le premier jour, en un mur
 * continu qui s'ouvre sur aujourd'hui, au bout à droite. On remonte le temps
 * en glissant vers la gauche ; une pierre touchée s'ouvre et se complète,
 * même des mois après.
 */
import { HDate } from "@hebcal/core";
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import DaySheet from "../../components/parcours/DaySheet.vue";
import StoneLegend from "../../components/parcours/StoneLegend.vue";
import StoneWall from "../../components/parcours/StoneWall.vue";
import { useParcours } from "../../composables/useParcours";
import { useParcoursMeta } from "../../composables/useParcoursMeta";
import { useWallLabels } from "../../composables/useWallLabels";
import { analyticsService } from "../../services/analyticsService";
import { localDayFrom } from "../../services/dateService";
import { addDays, minDay, weekStart } from "../../services/parcours/days";
import type { DayKey } from "../../services/parcours/model";
import { wallWeeks } from "../../services/parcours/schedule";
import { hebrewMonthName } from "../../services/zmanimService";

useParcoursMeta("parcours.wall.page", "/parcours/mur");

const { t, locale } = useI18n();
const store = useParcours();
const labels = useWallLabels();

/** Un mur commencé hier montre tout de même deux mois : la place de ce qui viendra. */
const MIN_WEEKS = 9;
/** La largeur d'une colonne, et la marge du mur (StoneWall, `full`). */
const COLUMN = 25;
const MARGIN = 32;

/** Les semaines qui tiennent dans la largeur : sur un grand écran, le mur la remplit. */
const fit = ref(MIN_WEEKS);

const weeks = computed(() => {
  const today = store.today.value;
  const earliest = addDays(today, -7 * (Math.max(MIN_WEEKS, fit.value) - 1));
  const from = minDay(store.begun.value ?? earliest, earliest);
  return wallWeeks(store.data.value, from, today, today, store.context.value);
});

const hebrewOf = (day: DayKey): HDate => {
  const date = localDayFrom(day) ?? new Date();
  date.setHours(12);
  return new HDate(date);
};

/**
 * Le mois hébraïque au-dessus de la première semaine qui le commence, et
 * l'année quand elle change. Un mois qui n'a qu'une colonne au bord du mur
 * se tait : son nom chevaucherait celui du suivant.
 */
const columnLabels = computed(() => {
  const months = weeks.value.map((week) => {
    const hd = hebrewOf(weekStart(week.week));
    return { month: hd.getMonth(), year: hd.getFullYear() };
  });
  let previous: { month: number; year: number } | null = null;
  return months.map(({ month, year }, i) => {
    const next = months[i + 1];
    const starts = previous?.month !== month && (!next || next.month === month || i > 0);
    if (!starts) return { month: "", year: "" };
    const label = {
      month: hebrewMonthName(month, year, locale.value),
      year: previous?.year !== year ? String(year) : "",
    };
    previous = { month, year };
    return label;
  });
});

const since = computed(() => {
  const first = store.begun.value;
  if (!first) return "";
  const hd = hebrewOf(first);
  return `${hebrewMonthName(hd.getMonth(), hd.getFullYear(), locale.value)} ${hd.getFullYear()}`;
});

const initials = computed(() => labels.weekdayInitials());

/**
 * Le mur s'ouvre sur aujourd'hui, au bout du sens de lecture : le défilement
 * prend le sens contraire de la page (droite à gauche en français, gauche à
 * droite en hébreu), dont le début est l'extrémité où se trouve aujourd'hui.
 */
const scrollDir = computed(() => (locale.value === "he" ? "ltr" : "rtl"));
const scroller = ref<HTMLElement | null>(null);
function toToday(smooth = true): void {
  scroller.value?.scrollTo({ left: 0, behavior: smooth ? "smooth" : "auto" });
}

// À la souris (le site), on attrape le mur pour le faire glisser.
let dragX: number | null = null;
let dragLeft = 0;
function onPointerDown(event: PointerEvent): void {
  if (event.pointerType !== "mouse" || !scroller.value) return;
  dragX = event.clientX;
  dragLeft = scroller.value.scrollLeft;
}
function onPointerMove(event: PointerEvent): void {
  if (dragX === null || !scroller.value) return;
  scroller.value.scrollLeft = dragLeft - (event.clientX - dragX);
}
function onPointerUp(): void {
  dragX = null;
}

const picked = ref<DayKey | null>(null);

function measure(): void {
  if (scroller.value) fit.value = Math.floor((scroller.value.clientWidth - MARGIN) / COLUMN);
}
let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
  measure();
  await nextTick();
  toToday(false);
  if (typeof ResizeObserver !== "undefined" && scroller.value) {
    resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(scroller.value);
  }
  analyticsService.capture("parcours_wall_viewed", { weeks: weeks.value.length });
});
onUnmounted(() => resizeObserver?.disconnect());
</script>

<template>
  <main class="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-12">
    <RouterLink to="/parcours" class="back-link mb-4">
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ t("parcours.title") }}
    </RouterLink>
    <h1 class="text-center font-display text-3xl font-bold tracking-tight md:text-4xl">
      {{ t("parcours.wall.page") }}
    </h1>
    <p v-if="since" class="mt-2 text-center text-text-secondary">
      {{
        t("parcours.wall.since", {
          held: store.streak.value.held,
          since,
          current: store.streak.value.current,
        })
      }}
    </p>

    <div class="mt-8 flex gap-1">
      <div
        class="flex w-4 flex-none flex-col pt-[39px] text-xs font-bold text-text-secondary"
        aria-hidden="true"
      >
        <span
          v-for="(initial, i) in initials"
          :key="i"
          class="flex items-center justify-center"
          :class="i === 6 ? 'h-[37px]' : 'h-[30px]'"
        >
          {{ initial }}
        </span>
      </div>
      <div
        ref="scroller"
        class="wall-scroller min-w-0 flex-1"
        :dir="scrollDir"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="onPointerUp"
      >
        <StoneWall
          class="w-max ps-1 pe-7"
          :weeks="weeks"
          :selected="picked"
          variant="full"
          @pick="(day) => (picked = day)"
        >
          <template #label="{ index }">
            <span class="relative mb-[3px] block h-[34px]">
              <span
                v-if="columnLabels[index].year"
                class="absolute start-0 top-0 whitespace-nowrap font-display text-[15px] font-bold"
              >
                {{ columnLabels[index].year }}
              </span>
              <span
                v-if="columnLabels[index].month"
                class="absolute bottom-0.5 start-0 whitespace-nowrap text-[11px] font-bold text-text-secondary"
              >
                {{ columnLabels[index].month }}
              </span>
            </span>
          </template>
        </StoneWall>
      </div>
    </div>

    <div class="mt-5 flex items-center justify-between gap-3">
      <p class="text-[13px] text-text-secondary">{{ t("parcours.wall.scrollHint") }}</p>
      <button type="button" class="btn btn-soft btn-sm flex-none" @click="toToday()">
        {{ t("parcours.wall.today") }}
      </button>
    </div>
    <StoneLegend class="mt-5" />
    <p class="mt-4 text-[13px] leading-relaxed text-text-secondary">
      {{ t("parcours.wall.backfill") }}
    </p>

    <DaySheet :day="picked" source="parcours_full_wall" @close="picked = null" />
  </main>
</template>

<style scoped>
.wall-scroller {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  touch-action: pan-x;
}
.wall-scroller::-webkit-scrollbar {
  display: none;
}
</style>
