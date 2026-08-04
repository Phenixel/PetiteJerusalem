<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";

/**
 * Choix de l'heure du rappel de lecture sur une horloge (heures puis minutes),
 * façon sélecteur d'heure Android. Les minutes vont de 5 en 5 — même pas que
 * la Cloud Function `dailyReadingReminder` qui tourne toutes les 5 minutes.
 */

const props = defineProps<{ show: boolean; hour: number; minute: number }>();
const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "confirm", time: { hour: number; minute: number }): void;
}>();

const { t } = useI18n();

const mode = ref<"hour" | "minute">("hour");
const hour = ref(props.hour);
const minute = ref(props.minute);

// À chaque ouverture, repart de l'heure courante du rappel, côté heures.
watch(
  () => props.show,
  (shown) => {
    if (shown) {
      hour.value = props.hour;
      minute.value = props.minute;
      mode.value = "hour";
    }
  },
);

const DIAL_SIZE = 256;
const OUTER_RADIUS = 102;
const INNER_RADIUS = 64;

interface DialNumber {
  value: number;
  label: string;
  x: number;
  y: number;
}

/** Place le n-ième chiffre d'un anneau (12 positions, 12 h en haut). */
function place(value: number, label: string, index: number, radius: number): DialNumber {
  const angle = (index / 12) * 2 * Math.PI - Math.PI / 2;
  return {
    value,
    label,
    x: DIAL_SIZE / 2 + radius * Math.cos(angle),
    y: DIAL_SIZE / 2 + radius * Math.sin(angle),
  };
}

// Cadran 24 h comme Android : 12, 1→11 sur l'anneau extérieur,
// 00, 13→23 sur l'anneau intérieur.
const hourNumbers: DialNumber[] = [
  ...Array.from({ length: 12 }, (_, i) =>
    place(i === 0 ? 12 : i, String(i === 0 ? 12 : i), i, OUTER_RADIUS),
  ),
  ...Array.from({ length: 12 }, (_, i) => {
    const value = i === 0 ? 0 : i + 12;
    return place(value, String(value).padStart(2, "0"), i, INNER_RADIUS);
  }),
];

// Cadran des minutes : 00 à 55, de 5 en 5.
const minuteNumbers: DialNumber[] = Array.from({ length: 12 }, (_, i) =>
  place(i * 5, String(i * 5).padStart(2, "0"), i, OUTER_RADIUS),
);

const numbers = computed(() => (mode.value === "hour" ? hourNumbers : minuteNumbers));
const selectedValue = computed(() => (mode.value === "hour" ? hour.value : minute.value));

/** Aiguille : angle et longueur pointant vers la valeur sélectionnée. */
const hand = computed(() => {
  const selected = numbers.value.find((n) => n.value === selectedValue.value) ?? numbers.value[0];
  return {
    x1: DIAL_SIZE / 2,
    y1: DIAL_SIZE / 2,
    x2: selected.x,
    y2: selected.y,
  };
});

function pick(value: number) {
  if (mode.value === "hour") {
    hour.value = value;
    // Comme sur Android : l'heure choisie, on enchaîne sur les minutes.
    mode.value = "minute";
  } else {
    minute.value = value;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function close() {
  emit("update:show", false);
}

function confirm() {
  emit("confirm", { hour: hour.value, minute: minute.value });
  close();
}
</script>

<template>
  <div v-if="show" class="modal-overlay animate-[fadeIn_0.3s_ease]" @click="close">
    <div class="modal-panel !max-w-sm animate-[scaleIn_0.3s_ease]" @click.stop>
      <div class="flex justify-between items-center mb-1">
        <h3 class="text-lg font-bold text-text-primary flex items-center gap-2">
          <AppIcon name="bell" :size="17" class="text-primary" />
          {{ t("notifications.title") }}
        </h3>
        <button @click="close" class="icon-btn" :aria-label="t('common.close')">
          <AppIcon name="x" :size="18" />
        </button>
      </div>
      <p class="text-sm text-text-secondary mb-5">{{ t("notifications.description") }}</p>

      <!-- Heure sélectionnée : toucher HH ou MM change le cadran affiché. -->
      <div class="flex items-center justify-center gap-1 text-4xl font-bold mb-5">
        <button
          type="button"
          @click="mode = 'hour'"
          :class="[
            'px-3 py-1 rounded-xl transition-colors tabular-nums',
            mode === 'hour' ? 'bg-primary/10 text-primary' : 'text-text-primary hover:bg-black/5 dark:hover:bg-white/10',
          ]"
          :aria-label="t('notifications.pickHour')"
        >
          {{ pad(hour) }}
        </button>
        <span class="text-text-secondary/70 pb-1">:</span>
        <button
          type="button"
          @click="mode = 'minute'"
          :class="[
            'px-3 py-1 rounded-xl transition-colors tabular-nums',
            mode === 'minute' ? 'bg-primary/10 text-primary' : 'text-text-primary hover:bg-black/5 dark:hover:bg-white/10',
          ]"
          :aria-label="t('notifications.pickMinute')"
        >
          {{ pad(minute) }}
        </button>
      </div>

      <!-- L'horloge -->
      <div
        class="relative mx-auto rounded-full bg-black/5 dark:bg-white/10"
        :style="{ width: `${DIAL_SIZE}px`, height: `${DIAL_SIZE}px` }"
      >
        <svg
          class="absolute inset-0 pointer-events-none"
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
          @click="pick(n.value)"
          :class="[
            'absolute w-9 h-9 -translate-x-1/2 -translate-y-1/2 rounded-full text-sm font-medium transition-colors tabular-nums',
            selectedValue === n.value
              ? 'bg-primary text-white'
              : 'text-text-primary hover:bg-black/10 dark:hover:bg-white/15',
          ]"
          :style="{ left: `${n.x}px`, top: `${n.y}px` }"
        >
          {{ n.label }}
        </button>
      </div>

      <div class="flex gap-3 justify-end pt-6">
        <button type="button" @click="close" class="btn btn-soft">
          {{ t("common.cancel") }}
        </button>
        <button type="button" @click="confirm" class="btn btn-primary">
          <AppIcon name="check" :size="14" />
          {{ t("common.confirm") }}
        </button>
      </div>
    </div>
  </div>
</template>
