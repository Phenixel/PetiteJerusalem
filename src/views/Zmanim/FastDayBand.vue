<script setup lang="ts">
/**
 * A fast drawn in its day: the night in deep blue, the day in sand, and the
 * fast as a bar in the theme color from its start to its end. A dawn fast
 * shows its few hours of night before the sun; Tich'a beAv, from the eve,
 * crosses a whole night. How long it lasts reads without counting.
 *
 * The band runs from two hours before the start to two hours after the
 * end, with the hours of the place that fall on a multiple of six marked
 * under it. Drawn from left to right in every language, like a clock face.
 */
import { computed } from "vue";
import {
  computeZmanim,
  formatZmanTime,
  placeDayAfter,
  type ZmanimPlace,
} from "../../services/zmanimService";

const props = defineProps<{
  start: Date;
  end: Date;
  place: ZmanimPlace;
  locale: string;
}>();

const WIDTH = 340;
const HEIGHT = 30;
const HOUR = 3_600_000;
const MARGIN = 2 * HOUR;

const range = computed(() => {
  const from = Math.floor((props.start.getTime() - MARGIN) / HOUR) * HOUR;
  const to = Math.ceil((props.end.getTime() + MARGIN) / HOUR) * HOUR;
  return { from, to };
});

const x = (time: number) =>
  ((time - range.value.from) / (range.value.to - range.value.from)) * WIDTH;

/** The days of the band, each from its sunrise to its sunset. */
const days = computed(() => {
  const out: { from: number; to: number }[] = [];
  const first = new Date(range.value.from);
  for (let offset = 0; offset <= 2; offset++) {
    const times = computeZmanim(props.place, placeDayAfter(props.place, first, offset));
    const sunrise = times.find((zman) => zman.key === "sunrise")?.date.getTime();
    const sunset = times.find((zman) => zman.key === "sunset")?.date.getTime();
    if (sunrise === undefined || sunset === undefined) continue;
    const from = Math.max(sunrise, range.value.from);
    const to = Math.min(sunset, range.value.to);
    if (to > from) out.push({ from: x(from), to: x(to) });
  }
  return out;
});

/** The hours of the place on a multiple of six: 00:00, 06:00, 12:00, 18:00. */
const ticks = computed(() => {
  const out: { x: number; label: string }[] = [];
  const wall = new Intl.DateTimeFormat("en-GB", {
    timeZone: props.place.tzid,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (let time = range.value.from; time <= range.value.to; time += HOUR) {
    const [hour, minute] = wall.format(time).split(":").map(Number);
    if (minute === 0 && hour % 6 === 0) {
      out.push({
        x: x(time),
        label: formatZmanTime(new Date(time), props.place.tzid, props.locale),
      });
    }
  }
  return out;
});

/** A few stars in the night before and after. */
const stars = computed(() => {
  const nights: [number, number][] = [];
  let cursor = 0;
  for (const day of days.value) {
    if (day.from - cursor > 24) nights.push([cursor, day.from]);
    cursor = day.to;
  }
  if (WIDTH - cursor > 24) nights.push([cursor, WIDTH]);
  return nights.flatMap(([from, to]) => [
    [from + (to - from) * 0.3, 6],
    [from + (to - from) * 0.7, 24],
  ]);
});

function star(cx: number, cy: number, size: number): string {
  const k = size * 0.28;
  return `M${cx} ${cy - size}L${cx + k} ${cy - k}L${cx + size} ${cy}L${cx + k} ${cy + k}L${cx} ${cy + size}L${cx - k} ${cy + k}L${cx - size} ${cy}L${cx - k} ${cy - k}Z`;
}
</script>

<template>
  <svg
    :viewBox="`0 0 ${WIDTH} ${HEIGHT + 16}`"
    class="fast-band"
    direction="ltr"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <clipPath id="fast-band-clip">
      <rect :width="WIDTH" :height="HEIGHT" rx="6" />
    </clipPath>
    <g clip-path="url(#fast-band-clip)">
      <rect :width="WIDTH" :height="HEIGHT" class="night" />
      <rect
        v-for="(day, i) in days"
        :key="i"
        :x="day.from"
        :width="day.to - day.from"
        :height="HEIGHT"
        class="day"
      />
      <path v-for="([sx, sy], i) in stars" :key="`s${i}`" :d="star(sx, sy, 2.6)" class="star" />
    </g>
    <rect
      :x="x(start.getTime())"
      :y="HEIGHT / 2 - 5"
      :width="x(end.getTime()) - x(start.getTime())"
      height="10"
      rx="5"
      class="fast"
    />
    <text v-for="tick in ticks" :key="tick.label" :x="tick.x" :y="HEIGHT + 12" class="tick">
      {{ tick.label }}
    </text>
  </svg>
</template>

<style scoped>
.fast-band {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  font-family: var(--font-sans);
}
/* The sky keeps its own colors, in every theme. */
.night {
  fill: #26345a;
}
.day {
  fill: #f4dfb3;
}
.star {
  fill: #f6e9c6;
}
.fast {
  fill: var(--color-primary);
}
.tick {
  font-size: 10px;
  fill: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
  text-anchor: middle;
}
</style>
