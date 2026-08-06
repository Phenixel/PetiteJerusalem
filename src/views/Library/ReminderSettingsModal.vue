<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import CollapseTransition from "../../components/CollapseTransition.vue";

/**
 * Réglages des rappels de lecture.
 *
 * La cloche de l'en-tête ouvre toujours cette modale — activer comme couper
 * passe par ici, sinon un appui malheureux coupait les rappels sans un mot.
 * Deux rappels indépendants sous un même interrupteur : l'heure fixe, et le
 * dernier appel d'avant-chkia pour qui n'a pas trouvé le temps de la journée.
 *
 * L'heure fixe se choisit sur une horloge (heures puis minutes), façon
 * sélecteur d'heure Android, présentée comme un second écran de la modale. Les
 * minutes vont de 5 en 5 — même pas que la Cloud Function
 * `dailyReadingReminder` qui tourne toutes les 5 minutes.
 */

const props = defineProps<{
  show: boolean;
  /** Interrupteur général : au moins un rappel est actif. */
  enabled: boolean;
  /** Rappel à heure fixe. */
  daily: boolean;
  hour: number;
  minute: number;
  /** Rappel 20 minutes avant la chkia. */
  sunset: boolean;
  /** Minutes avant la chkia, pour le libellé de l'option. */
  sunsetOffset: number;
  /** Chkia du jour au lieu de l'utilisateur ("21:24"), null si incalculable. */
  sunsetTime: string | null;
  /** Lieu du calcul de la chkia, pour que l'utilisateur sache d'où elle vient. */
  placeLabel: string;
}>();

/** Les réglages tels que l'utilisateur les valide (voir ReminderChoice côté parent). */
interface ReminderChoice {
  enabled: boolean;
  daily: boolean;
  hour: number;
  minute: number;
  sunset: boolean;
}

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "save", settings: ReminderChoice): void;
}>();

const { t } = useI18n();

/** Écran courant : la liste des réglages, ou l'horloge de l'heure fixe. */
const view = ref<"settings" | "clock">("settings");
const enabled = ref(props.enabled);
const daily = ref(props.daily);
const sunset = ref(props.sunset);
const hour = ref(props.hour);
const minute = ref(props.minute);
const mode = ref<"hour" | "minute">("hour");

// À chaque ouverture, repart des réglages enregistrés.
watch(
  () => props.show,
  (shown) => {
    if (!shown) return;
    view.value = "settings";
    enabled.value = props.enabled;
    daily.value = props.daily;
    sunset.value = props.sunset;
    hour.value = props.hour;
    minute.value = props.minute;
    mode.value = "hour";
  },
);

/** Première activation : l'heure fixe est le rappel attendu, on la propose cochée. */
function onToggleEnabled(value: boolean) {
  enabled.value = value;
  if (value && !daily.value && !sunset.value) daily.value = true;
}

// Rappels activés mais aucun choisi : il n'y a rien à enregistrer, on le dit
// plutôt que d'enregistrer un réglage qui n'enverrait jamais rien.
const nothingChosen = computed(() => enabled.value && !daily.value && !sunset.value);

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

const timeLabel = computed(() => `${pad(hour.value)}:${pad(minute.value)}`);

/** Ouvre l'horloge : choisir une heure, c'est vouloir le rappel à heure fixe. */
function openClock() {
  daily.value = true;
  mode.value = "hour";
  view.value = "clock";
}

function close() {
  emit("update:show", false);
}

function confirm() {
  if (view.value === "clock") {
    view.value = "settings";
    return;
  }
  if (nothingChosen.value) return;
  emit("save", {
    enabled: enabled.value,
    daily: daily.value,
    hour: hour.value,
    minute: minute.value,
    sunset: sunset.value,
  });
  close();
}
</script>

<template>
  <div v-if="show" class="modal-overlay animate-[fadeIn_0.3s_ease]" @click="close">
    <div class="modal-panel !max-w-sm animate-[scaleIn_0.3s_ease]" @click.stop>
      <div class="flex justify-between items-center mb-1">
        <h3 class="text-lg font-bold text-text-primary flex items-center gap-2">
          <!-- L'horloge n'est qu'un détour : on peut en revenir sans rien perdre. -->
          <button
            v-if="view === 'clock'"
            type="button"
            @click="view = 'settings'"
            class="icon-btn"
            :aria-label="t('common.back')"
          >
            <AppIcon name="chevron-left" :size="18" />
          </button>
          <AppIcon v-else name="bell" :size="17" class="text-primary" />
          {{ view === "clock" ? t("notifications.pickTime") : t("notifications.title") }}
        </h3>
        <button @click="close" class="icon-btn" :aria-label="t('common.close')">
          <AppIcon name="x" :size="18" />
        </button>
      </div>

      <!-- ===== Écran des réglages ===== -->
      <template v-if="view === 'settings'">
        <p class="text-sm text-text-secondary mb-4">{{ t("notifications.description") }}</p>

        <label
          class="flex items-center justify-between gap-3 py-3 border-b border-black/5 dark:border-white/10 cursor-pointer"
        >
          <span class="font-semibold text-text-primary">{{ t("notifications.enable") }}</span>
          <span class="relative inline-flex items-center shrink-0">
            <input
              type="checkbox"
              class="sr-only peer"
              :checked="enabled"
              @change="onToggleEnabled(($event.target as HTMLInputElement).checked)"
            />
            <span
              class="w-10 h-5 bg-black/15 peer-focus-visible:outline-2 peer-focus-visible:outline-primary rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:shadow-sm after:transition-all peer-checked:bg-primary dark:bg-white/20"
            ></span>
          </span>
        </label>

        <CollapseTransition>
          <div v-show="enabled">
            <!-- Rappel à heure fixe -->
            <div class="py-3 border-b border-black/5 dark:border-white/10">
              <label class="flex items-center justify-between gap-3 cursor-pointer">
                <span>
                  <span class="block font-medium text-text-primary">
                    {{ t("notifications.dailyOption") }}
                  </span>
                  <span class="block text-sm text-text-secondary">
                    {{ t("notifications.dailyOptionHint") }}
                  </span>
                </span>
                <span class="relative inline-flex items-center shrink-0">
                  <input type="checkbox" class="sr-only peer" v-model="daily" />
                  <span
                    class="w-10 h-5 bg-black/15 peer-focus-visible:outline-2 peer-focus-visible:outline-primary rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:shadow-sm after:transition-all peer-checked:bg-primary dark:bg-white/20"
                  ></span>
                </span>
              </label>
              <button
                type="button"
                @click="openClock"
                :class="[
                  'mt-2 inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-2xl font-bold tabular-nums transition-colors',
                  daily
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:bg-black/5 dark:hover:bg-white/10',
                ]"
                :aria-label="t('notifications.pickTime')"
              >
                {{ timeLabel }}
                <AppIcon name="clock" :size="16" />
              </button>
            </div>

            <!-- Dernier appel avant la chkia -->
            <label class="flex items-center justify-between gap-3 py-3 cursor-pointer">
              <span>
                <span class="block font-medium text-text-primary">
                  {{ t("notifications.sunsetOption", { minutes: sunsetOffset }) }}
                </span>
                <span class="block text-sm text-text-secondary">
                  {{ t("notifications.sunsetOptionHint") }}
                </span>
                <!-- La chkia dépend du lieu : on montre celui qui sert au calcul,
                     et l'heure d'aujourd'hui pour rendre le réglage concret. -->
                <span v-if="sunsetTime" class="block text-sm text-text-secondary mt-0.5">
                  {{ t("notifications.sunsetToday", { time: sunsetTime, place: placeLabel }) }}
                </span>
              </span>
              <span class="relative inline-flex items-center shrink-0">
                <input type="checkbox" class="sr-only peer" v-model="sunset" />
                <span
                  class="w-10 h-5 bg-black/15 peer-focus-visible:outline-2 peer-focus-visible:outline-primary rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:shadow-sm after:transition-all peer-checked:bg-primary dark:bg-white/20"
                ></span>
              </span>
            </label>

            <p
              v-if="nothingChosen"
              class="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5"
            >
              <AppIcon name="alert-triangle" :size="14" />
              {{ t("notifications.pickAtLeastOne") }}
            </p>
          </div>
        </CollapseTransition>
      </template>

      <!-- ===== Écran de l'horloge ===== -->
      <template v-else>
        <!-- Heure sélectionnée : toucher HH ou MM change le cadran affiché. -->
        <div class="flex items-center justify-center gap-1 text-4xl font-bold my-5">
          <button
            type="button"
            @click="mode = 'hour'"
            :class="[
              'px-3 py-1 rounded-xl transition-colors tabular-nums',
              mode === 'hour'
                ? 'bg-primary/10 text-primary'
                : 'text-text-primary hover:bg-black/5 dark:hover:bg-white/10',
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
              mode === 'minute'
                ? 'bg-primary/10 text-primary'
                : 'text-text-primary hover:bg-black/5 dark:hover:bg-white/10',
            ]"
            :aria-label="t('notifications.pickMinute')"
          >
            {{ pad(minute) }}
          </button>
        </div>

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
      </template>

      <div class="flex gap-3 justify-end pt-6">
        <button type="button" @click="close" class="btn btn-soft">
          {{ t("common.cancel") }}
        </button>
        <button
          type="button"
          @click="confirm"
          :disabled="nothingChosen"
          class="btn btn-primary disabled:opacity-50"
        >
          <AppIcon name="check" :size="14" />
          {{ t("common.confirm") }}
        </button>
      </div>
    </div>
  </div>
</template>
