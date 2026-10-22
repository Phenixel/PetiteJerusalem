<script setup lang="ts">
/**
 * An hour picked on a dial, like Android's time picker: the hours first
 * (24 h, 1 to 12 on the outer ring, 00 and 13 to 23 inside), then the
 * minutes, five by five. Touching the hours or the minutes above the dial
 * switches between them.
 *
 * Taken from the evening reminder's window, which it served (the minutes
 * went five by five because the server sent every five minutes; a reminder
 * on the phone could be finer, five is kept for a dial that stays legible).
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

const hour = defineModel<number>("hour", { required: true });
const minute = defineModel<number>("minute", { required: true });

const { t } = useI18n();

const mode = ref<"hour" | "minute">("hour");

const DIAL_SIZE = 256;
const OUTER_RADIUS = 102;
const INNER_RADIUS = 64;

interface DialNumber {
  value: number;
  label: string;
  x: number;
  y: number;
}

/** Places the n-th number of a ring (12 positions, 12 o'clock on top). */
function place(value: number, label: string, index: number, radius: number): DialNumber {
  const angle = (index / 12) * 2 * Math.PI - Math.PI / 2;
  return {
    value,
    label,
    x: DIAL_SIZE / 2 + radius * Math.cos(angle),
    y: DIAL_SIZE / 2 + radius * Math.sin(angle),
  };
}

const hourNumbers: DialNumber[] = [
  ...Array.from({ length: 12 }, (_, i) =>
    place(i === 0 ? 12 : i, String(i === 0 ? 12 : i), i, OUTER_RADIUS),
  ),
  ...Array.from({ length: 12 }, (_, i) => {
    const value = i === 0 ? 0 : i + 12;
    return place(value, String(value).padStart(2, "0"), i, INNER_RADIUS);
  }),
];

const minuteNumbers: DialNumber[] = Array.from({ length: 12 }, (_, i) =>
  place(i * 5, String(i * 5).padStart(2, "0"), i, OUTER_RADIUS),
);

const numbers = computed(() => (mode.value === "hour" ? hourNumbers : minuteNumbers));
const selectedValue = computed(() => (mode.value === "hour" ? hour.value : minute.value));

const hand = computed(() => {
  const selected = numbers.value.find((n) => n.value === selectedValue.value) ?? numbers.value[0];
  return { x1: DIAL_SIZE / 2, y1: DIAL_SIZE / 2, x2: selected.x, y2: selected.y };
});

function pick(value: number): void {
  if (mode.value === "hour") {
    hour.value = value;
    // As on Android: the hour chosen, the minutes come next.
    mode.value = "minute";
  } else {
    minute.value = value;
  }
}

const pad = (n: number): string => String(n).padStart(2, "0");
</script>

<template>
  <div data-sheet-nodrag>
    <div class="my-4 flex items-center justify-center gap-1 text-4xl font-bold">
      <button
        type="button"
        :class="[
          'rounded-control px-3 py-1 tabular-nums transition-colors',
          mode === 'hour'
            ? 'bg-primary/10 text-primary'
            : 'text-text-primary hover:bg-black/5 dark:hover:bg-white/10',
        ]"
        :aria-label="t('notifications.pickHour')"
        @click="mode = 'hour'"
      >
        {{ pad(hour) }}
      </button>
      <span class="pb-1 text-text-secondary/70">:</span>
      <button
        type="button"
        :class="[
          'rounded-control px-3 py-1 tabular-nums transition-colors',
          mode === 'minute'
            ? 'bg-primary/10 text-primary'
            : 'text-text-primary hover:bg-black/5 dark:hover:bg-white/10',
        ]"
        :aria-label="t('notifications.pickMinute')"
        @click="mode = 'minute'"
      >
        {{ pad(minute) }}
      </button>
    </div>

    <div
      class="relative mx-auto rounded-full bg-black/5 dark:bg-white/10"
      :style="{ width: `${DIAL_SIZE}px`, height: `${DIAL_SIZE}px` }"
    >
      <svg
        class="pointer-events-none absolute inset-0"
        :width="DIAL_SIZE"
        :height="DIAL_SIZE"
        aria-hidden="true"
      >
        <circle :cx="hand.x1" :cy="hand.y1" r="4" class="fill-primary" />
        <line
          :x1="hand.x1"
          :y1="hand.y1"
          :x2="hand.x2"
          :y2="hand.y2"
          class="stroke-primary"
          stroke-width="2"
        />
      </svg>
      <button
        v-for="n in numbers"
        :key="`${mode}-${n.value}`"
        type="button"
        :class="[
          'absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full text-sm font-medium tabular-nums transition-colors',
          selectedValue === n.value
            ? 'bg-brand text-on-brand'
            : 'text-text-primary hover:bg-black/10 dark:hover:bg-white/15',
        ]"
        :style="{ left: `${n.x}px`, top: `${n.y}px` }"
        @click="pick(n.value)"
      >
        {{ n.label }}
      </button>
    </div>
  </div>
</template>
