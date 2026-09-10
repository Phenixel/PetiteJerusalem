<script setup lang="ts">
/**
 * Le calendrier de la maison : un mois, dans une fenêtre modale de l'app.
 *
 * Il sert partout où l'on choisit un jour, à la place du calendrier du système
 * (roue grise d'iOS, boîte bleue d'Android) : la date limite d'une chaîne
 * (AppDateField) et le jour affiché par les horaires, où il évite de cliquer
 * trente fois sur la flèche pour atteindre une date.
 *
 * La valeur est un jour local au format `YYYY-MM-DD`, celui que donnait un
 * `<input type="date">`. Jamais de date UTC : `new Date("2026-09-14")` se lit
 * minuit à Greenwich, soit la veille au soir à l'ouest.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppModal from "./AppModal.vue";
import AppIcon from "./icons/AppIcon.vue";
import { dateTimeFormat } from "../services/intlCache";
import { localDayKey } from "../services/dateService";

const props = defineProps<{
  open: boolean;
  /** Premier jour choisissable (les précédents sont éteints), au format YYYY-MM-DD. */
  min?: string;
  /** Ce que la fenêtre annonce, à défaut « Choisir une date ». */
  label?: string;
}>();

const emit = defineEmits<{ close: [] }>();
const model = defineModel<string>({ required: true });

const { t, locale } = useI18n();

/** Une valeur de champ (YYYY-MM-DD) en date locale. */
function parse(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

const todayKey = localDayKey();

/** Le mois affiché. Il se recale sur la date choisie à chaque ouverture. */
const cursor = ref(new Date());

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    const start = parse(model.value) ?? parse(props.min ?? "") ?? new Date();
    cursor.value = new Date(start.getFullYear(), start.getMonth(), 1);
  },
  { immediate: true },
);

function shiftMonth(delta: number): void {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1);
}

/**
 * Premier jour de la semaine : dimanche en hébreu, lundi ailleurs. Intl ne le
 * donne pas partout (getWeekInfo manque encore aux navigateurs que l'app
 * sert), et ces deux cas couvrent les trois langues.
 */
const weekStart = computed(() => (locale.value === "he" ? 0 : 1));

/** Les initiales des jours, dans la langue de l'interface. */
const weekdayLabels = computed(() => {
  const format = dateTimeFormat(locale.value, { weekday: "narrow" });
  // Un dimanche connu (4 janvier 1970) sert de point de départ.
  return Array.from({ length: 7 }, (_, index) =>
    format.format(new Date(1970, 0, 4 + ((weekStart.value + index) % 7))),
  );
});

const monthLabel = computed(() =>
  dateTimeFormat(locale.value, { month: "long", year: "numeric" }).format(cursor.value),
);

/** Les six semaines du mois affiché, débordements des mois voisins compris. */
const weeks = computed(() => {
  const first = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1);
  const offset = (first.getDay() - weekStart.value + 7) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + day);
      const key = localDayKey(date);
      return {
        key,
        day: date.getDate(),
        outside: date.getMonth() !== cursor.value.getMonth(),
        today: key === todayKey,
        chosen: key === model.value,
        disabled: props.min ? key < props.min : false,
      };
    }),
  );
});

/**
 * L'habillage d'un jour, en une seule chaîne : deux classes de couleur posées
 * ensemble (`text-primary` d'aujourd'hui et `text-text-primary` du jour
 * ordinaire) laisseraient la feuille de style trancher, pas nous.
 */
function cellClass(cell: {
  chosen: boolean;
  disabled: boolean;
  outside: boolean;
  today: boolean;
}): string {
  const hover = "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
  if (cell.chosen) return "bg-primary font-semibold text-white";
  if (cell.disabled) return "cursor-not-allowed text-text-secondary/35";
  if (cell.today) return `font-bold text-primary ${hover}`;
  if (cell.outside) return `text-text-secondary/60 ${hover}`;
  return `text-text-primary ${hover}`;
}

function pick(key: string, disabled: boolean): void {
  if (disabled) return;
  model.value = key;
  emit("close");
}
</script>

<template>
  <AppModal
    :open="open"
    :label="label ?? t('common.chooseDate')"
    panel-class="modal-panel !max-w-sm animate-[scaleIn_0.3s_ease]"
    @close="emit('close')"
  >
    <div class="mb-4 flex items-center justify-between gap-2">
      <button
        type="button"
        class="icon-btn"
        :aria-label="t('common.previousMonth')"
        @click="shiftMonth(-1)"
      >
        <AppIcon name="chevron-left" :size="18" class="rtl:rotate-180" />
      </button>
      <!-- Le mois s'écrit en toutes lettres : « sept. 2026 » se confond d'un
           mois à l'autre quand on cherche une date. -->
      <span class="font-semibold text-text-primary first-letter:uppercase">{{ monthLabel }}</span>
      <button
        type="button"
        class="icon-btn"
        :aria-label="t('common.nextMonth')"
        @click="shiftMonth(1)"
      >
        <AppIcon name="chevron-right" :size="18" class="rtl:rotate-180" />
      </button>
    </div>

    <div class="grid grid-cols-7 gap-1 text-center">
      <span
        v-for="(weekday, index) in weekdayLabels"
        :key="index"
        class="pb-1 text-xs font-semibold text-text-secondary"
      >
        {{ weekday }}
      </span>

      <template v-for="(week, weekIndex) in weeks" :key="weekIndex">
        <button
          v-for="cell in week"
          :key="cell.key"
          type="button"
          class="rounded-control py-2 text-sm transition-colors"
          :class="cellClass(cell)"
          :disabled="cell.disabled"
          :aria-current="cell.today ? 'date' : undefined"
          @click="pick(cell.key, cell.disabled)"
        >
          {{ cell.day }}
        </button>
      </template>
    </div>
  </AppModal>
</template>
