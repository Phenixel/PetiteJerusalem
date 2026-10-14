<script setup lang="ts">
/**
 * Le mur entier (P2-Annee) : toutes les pierres posées depuis le premier
 * jour, en un mur continu qui s'ouvre sur aujourd'hui, au bout à droite. On
 * remonte le temps en glissant vers la gauche, et la ligne au-dessus dit les
 * mois qu'on regarde ; une pierre touchée s'ouvre et se complète, même des
 * mois après.
 */
import { HDate } from "@hebcal/core";
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import DaySheet from "../../components/parcours/DaySheet.vue";
import ParcoursBack from "../../components/parcours/ParcoursBack.vue";
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

/** Ce que l'œil voit du mur : de combien il a glissé depuis aujourd'hui, et sa largeur. */
const view = ref({ offset: 0, width: 0 });

/** « De Tichri à 'Hechvan 5787 » : les mois des colonnes qu'on regarde. */
const range = computed(() => {
  const list = weeks.value;
  if (list.length === 0) return "";
  const last = list.length - 1;
  const newest = Math.max(0, last - Math.floor(view.value.offset / COLUMN));
  const oldest = Math.max(
    0,
    last - Math.floor((view.value.offset + Math.max(0, view.value.width - MARGIN)) / COLUMN),
  );
  const at = (i: number) => {
    const hd = hebrewOf(weekStart(list[i].week));
    return {
      month: hebrewMonthName(hd.getMonth(), hd.getFullYear(), locale.value),
      year: hd.getFullYear(),
    };
  };
  const from = at(oldest);
  const to = at(newest);
  if (from.month === to.month && from.year === to.year) return `${to.month} ${to.year}`;
  if (from.year === to.year) {
    return t("parcours.wall.range", { from: from.month, to: to.month, year: to.year });
  }
  return t("parcours.wall.rangeYears", {
    from: `${from.month} ${from.year}`,
    to: `${to.month} ${to.year}`,
  });
});

function onScroll(): void {
  const el = scroller.value;
  if (el) view.value = { offset: Math.abs(el.scrollLeft), width: el.clientWidth };
}

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
  onScroll();
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
  <main class="mx-auto w-full max-w-5xl px-4 pb-9 pt-[18px] md:px-6 md:py-12">
    <ParcoursBack to="/parcours" :label="t('parcours.title')" />
    <h1 class="mt-0.5 text-center font-display text-[34px] font-bold md:text-4xl">
      {{ t("parcours.wall.page") }}
    </h1>
    <p v-if="since" class="mt-1 text-center text-sm text-text-secondary">
      {{
        t("parcours.wall.since", {
          held: store.streak.value.held,
          since,
          current: store.streak.value.current,
        })
      }}
    </p>

    <p class="mt-[18px] text-center text-[15px] font-bold">{{ range }}</p>

    <div class="mt-3.5 flex gap-1">
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
        @scroll.passive="onScroll"
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

    <div class="mt-[18px] flex items-center justify-between gap-3">
      <p class="text-[13px] leading-snug text-text-secondary">
        {{ t("parcours.wall.scrollHint") }}
      </p>
      <button type="button" class="btn btn-soft sheet-like flex-none" @click="toToday()">
        {{ t("parcours.wall.today") }}
      </button>
    </div>
    <StoneLegend class="mt-[18px]" />
    <p class="mt-3.5 text-[13px] leading-normal text-text-secondary">
      {{ t("parcours.wall.backfill") }}
      <template v-if="since">{{ t("parcours.wall.before", { since }) }}</template>
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
.sheet-like {
  min-height: 44px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 700;
}
</style>
