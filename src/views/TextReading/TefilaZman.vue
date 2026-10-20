<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { formatZmanTime, getSunset } from "../../services/zmanimService";
import {
  isZmanMoment,
  zmanPhase,
  zmanPlan,
  zmanTarget,
  type ZmanMarkKey,
} from "../../services/tefilaZman";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { useNow } from "../../composables/useNow";
import { useZmanCountdown, useZmanDuration } from "../../composables/useZmanCountdown";
import ArtSky from "../../components/art/ArtSky.vue";
import BottomSheet from "../../components/parcours/BottomSheet.vue";
import ZmanArc from "../../components/ZmanArc.vue";

/**
 * The time of a moment of prayer, set right before what is read: the start
 * of Cha'harit, the end of the Chema before the Chema, Min'ha at the head of
 * Min'ha, the Sli'hot at the head of the Sli'hot. A pill in the theme color,
 * the sky of the moment in a small disc, and what matters now: « Min'ha
 * jusqu'à 18:51 · encore 2 h 21 », « Arvit à partir de 19:31 · dans 3 h ».
 *
 * Touched, it opens a sheet: the course of the sun with the moment's
 * landmarks, each one with its time and how long until it comes, then the
 * rule, said in full (both opinions where practice tells them apart). The
 * times are computed on the device for the place of the times page.
 *
 * The tefila files set the marker (`TextBlock.zman`); the reading page sets
 * `slihot` at the head of the Sli'hot.
 */
const props = defineProps<{ zman: string }>();

const { t, locale } = useI18n();
const { place } = useZmanimLocation();

// L'heure du jour change à minuit (et le lecteur peut rester ouvert) : les
// heures sont une donnée du calcul, pas une valeur figée à l'ouverture.
const now = useNow();
const countdown = useZmanCountdown();
const duration = useZmanDuration();

const clock = (date: Date) => formatZmanTime(date, place.value.tzid, locale.value);

const moment = computed(() => (isZmanMoment(props.zman) ? props.zman : null));
// Nuit ou jour polaire : sans les heures du moment, rien ne s'affiche plutôt
// qu'une heure vide.
const plan = computed(() => (moment.value ? zmanPlan(moment.value, place.value, now.value) : null));
const phase = computed(() => (plan.value ? zmanPhase(plan.value, now.value) : "after"));

const name = computed(() => (moment.value ? t(`textReading.zman.${moment.value}.name`) : ""));
const title = computed(() => (moment.value ? t(`textReading.zman.${moment.value}.title`) : ""));

/** « Min'ha jusqu'à 18:51 », and how long until that time. */
const pill = computed(() => {
  if (!plan.value) return { text: "", left: "" };
  const target = zmanTarget(plan.value, phase.value);
  const text = t(`textReading.zman.pill.${phase.value}`, { name: name.value, time: clock(target) });
  if (phase.value === "after") return { text, left: "" };
  const left =
    phase.value === "before"
      ? countdown(target, now.value)
      : t("textReading.zman.left", { duration: duration(target, now.value) });
  return { text, left };
});

/**
 * The sheet's list: each landmark with its time, passed or to come, and
 * « Maintenant » in its place among them.
 */
const rows = computed(() => {
  if (!plan.value) return [];
  const at = now.value.getTime();
  const rows: {
    key: string;
    time: string;
    label: string;
    state: "past" | "now" | "next" | "later";
    left: string;
  }[] = [];
  let nowPlaced = false;
  let nextFound = false;
  for (const mark of plan.value.marks) {
    const past = mark.date.getTime() <= at;
    if (!past && !nowPlaced) {
      rows.push({
        key: "now",
        time: clock(now.value),
        label: t("textReading.zman.now"),
        state: "now",
        left: "",
      });
      nowPlaced = true;
    }
    const state = past ? "past" : nextFound ? "later" : "next";
    if (state === "next") nextFound = true;
    rows.push({
      key: mark.key,
      time: clock(mark.date),
      label: t(`textReading.zman.marks.${mark.key as ZmanMarkKey}`),
      state,
      left: past ? "" : countdown(mark.date, now.value),
    });
  }
  if (!nowPlaced) {
    rows.push({
      key: "now",
      time: clock(now.value),
      label: t("textReading.zman.now"),
      state: "now",
      left: "",
    });
  }
  return rows;
});

/** The times the explanations speak of, by name. */
const params = computed<Record<string, string>>(() => {
  const p = plan.value;
  if (!p) return {};
  const values: Record<string, string> = {
    start: clock(p.start),
    end: clock(p.end),
  };
  for (const mark of p.marks) values[mark.key] = clock(mark.date);
  // La chkia du jour où les Sli'hot se referment : à défaut de la nuit,
  // c'est jusque-là qu'on les rattrape.
  if (p.moment === "slihot") {
    const sunset = getSunset(place.value, p.end);
    if (sunset) values.sunset = clock(sunset);
  }
  return values;
});

/** How many lines each moment's rule takes (textReading.zman.<moment>.d1..dN). */
const DETAILS: Record<string, number> = {
  chaharit: 4,
  shema: 3,
  amida: 2,
  minha: 4,
  arvit: 3,
  slihot: 4,
};

const details = computed(() => {
  if (!moment.value) return [];
  const lines: string[] = [];
  for (let i = 1; i <= DETAILS[moment.value]; i++) {
    const key = `textReading.zman.${moment.value}.d${i}`;
    // The Sli'hot's day line needs the sunset, which the far north lacks.
    if (moment.value === "slihot" && i === 4 && !params.value.sunset) continue;
    lines.push(t(key, params.value));
  }
  return lines;
});

const open = ref(false);
</script>

<template>
  <div v-if="plan && moment" class="zman-line">
    <button type="button" class="zman-pill" aria-haspopup="dialog" @click="open = true">
      <span class="zman-disc" aria-hidden="true"><ArtSky :moment="moment" /></span>
      <span class="min-w-0">
        {{ pill.text }}<template v-if="pill.left">{{ " · " }}{{ pill.left }}</template>
      </span>
    </button>

    <BottomSheet :open="open" :label="title" @close="open = false">
      <div class="flex items-center gap-3">
        <p class="min-w-0 flex-1 text-xl font-extrabold">{{ title }}</p>
        <span class="zman-sheet-sky" aria-hidden="true"><ArtSky :moment="moment" /></span>
      </div>
      <p v-if="place.city" class="mt-0.5 text-sm text-text-secondary">
        {{ t("textReading.zman.place", { city: place.city }) }}
      </p>

      <ZmanArc :plan="plan" :now="now" :clock="clock" class="mt-4" />

      <ul class="mt-3">
        <li v-for="row in rows" :key="row.key" class="zman-row" :class="`zman-row-${row.state}`">
          <span class="zman-time">{{ row.time }}</span>
          <span class="min-w-0 flex-1">{{ row.label }}</span>
          <span v-if="row.left" class="zman-left">{{ row.left }}</span>
        </li>
      </ul>

      <ul class="mt-4 space-y-1.5 text-sm leading-relaxed text-text-secondary">
        <li v-for="(line, i) in details" :key="i">{{ line }}</li>
      </ul>

      <button type="button" class="btn btn-primary sheet-close" @click="open = false">
        {{ t("common.close") }}
      </button>
    </BottomSheet>
  </div>
</template>

<style scoped>
.zman-line {
  margin-block: 1.25rem;
}

/* A pill in the theme color, like the other commands placed in a text (the
   parchment, the Kotel): the sky of the moment in its disc, and its time. */
.zman-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 100%;
  padding: 0.25rem 0.85rem 0.25rem 0.25rem;
  border-radius: var(--radius-pill);
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.3;
  text-align: start;
  font-variant-numeric: tabular-nums;
  transition: background-color 0.15s ease;
}
.zman-pill:hover {
  background-color: color-mix(in srgb, var(--color-primary) 16%, transparent);
}

.zman-disc {
  flex: none;
  width: 1.75rem;
  height: 1.75rem;
  overflow: hidden;
  border-radius: var(--radius-pill);
}
.zman-disc :deep(svg),
.zman-sheet-sky :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.zman-sheet-sky {
  flex: none;
  width: 4.5rem;
  height: 3rem;
  overflow: hidden;
  border-radius: var(--radius-lg);
}

.zman-row {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding-block: 0.5rem;
  border-top: 1px solid var(--color-line);
  font-size: 0.9rem;
}
.zman-row:first-child {
  border-top: 0;
}
.zman-time {
  flex: none;
  min-width: 3rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.zman-left {
  flex: none;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}
/* What has passed recedes; « Maintenant » and what comes next stand out. */
.zman-row-past {
  color: var(--color-text-secondary);
}
.zman-row-now {
  color: var(--color-primary);
  font-weight: 700;
}
.zman-row-next .zman-left {
  color: var(--color-primary);
  font-weight: 700;
}
</style>
