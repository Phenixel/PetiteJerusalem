<script setup lang="ts">
/**
 * Une habitude (P2-Habitude) : son nom (celui du modèle s'il reste vide),
 * ses jours en cases plates, et son moment. Un temps d'étude et une habitude
 * à soi le posent sur le fil du jour en glissant le rond : au réveil, avec
 * Cha'harit, à midi, avec Min'ha, avec Arvit, au coucher ; ou toute la
 * journée. Les autres ont le leur, qu'on ne redemande pas (choosesItsTime) :
 * il se dit, sans barre ; les trois tefilot ont chacune le sien.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  ANCHOR_MOMENT,
  choosesItsTime,
  isOwnHabit,
  type HabitAnchor,
  type HabitPreset,
  type MomentId,
} from "../../../services/parcours/model";
import AnchorTrack from "../pickers/AnchorTrack.vue";

const props = withDefaults(
  defineProps<{
    preset: HabitPreset;
    /** Les réglages d'une habitude déjà prise : tout s'enregistre au fil des touches. */
    editing?: boolean;
  }>(),
  { editing: false },
);
const name = defineModel<string>("name", { required: true });
const days = defineModel<number[]>("days", { required: true });
const moment = defineModel<MomentId>("moment", { required: true });
const anchor = defineModel<HabitAnchor | null>("anchor", { required: true });
const emit = defineEmits<{ (e: "create"): void }>();

const { t } = useI18n();

const WEEKDAY_KEYS = [0, 1, 2, 3, 4, 5, 6];

/** Ce que la carte fera : ouvrir le Sidour, la bibliothèque, ou se cocher d'un geste. */
const hint = computed(() => {
  if (props.preset === "limoud") return t("parcours.create.habitStudy");
  return isOwnHabit(props.preset) ? t("parcours.create.habitOwn") : t("parcours.create.habitText");
});

/**
 * « Ajouter à mon parcours » ne répond qu'un instant après l'arrivée sur
 * l'étape : un double toucher sur la liste des modèles ne l'atteint pas.
 */
const ARM_MS = 400;
const armed = ref(false);
let armTimer: ReturnType<typeof setTimeout> | undefined;
onMounted(() => (armTimer = setTimeout(() => (armed.value = true), ARM_MS)));
onBeforeUnmount(() => clearTimeout(armTimer));

function create(): void {
  if (armed.value && days.value.length > 0) emit("create");
}
/** Les tefilin, la tsédaka : Chabbat est en pause, d'office. */
const restsOnChabbat = computed(() => props.preset === "tefilin" || props.preset === "tsedaka");

function toggleDay(day: number): void {
  if (day === 6 && restsOnChabbat.value) return;
  days.value = days.value.includes(day)
    ? days.value.filter((d) => d !== day)
    : [...days.value, day].sort((a, b) => a - b);
}

const daysNote = computed(() => {
  const n = days.value.length;
  if (n === 7) return t("parcours.create.everyDay");
  if (n === 6 && !days.value.includes(6)) return t("parcours.create.exceptChabbat");
  return t("parcours.create.someDays", { n }, n);
});

/** Le repère, et le moment qui s'en déduit : le repère en dernier, il porte les deux. */
function setAnchor(next: HabitAnchor | null): void {
  moment.value = next ? ANCHOR_MOMENT[next] : "anytime";
  anchor.value = next;
}

/** Le rond du fil : poser un repère pose aussi le moment. */
const trackAnchor = computed({
  get: () => anchor.value,
  set: (next: HabitAnchor | null) => setAnchor(next),
});

/** Ce que le repère fait de la carte : d'où elle s'ouvre (voir useOfficeTimes). */
const opensNote = computed(() => {
  const at = anchor.value;
  if (at === "noon" || at === "minha") return t(`parcours.create.anchorOpens.${at}`);
  if (at === "arvit" || at === "bedtime") return t("parcours.create.anchorOpens.night");
  return t("parcours.create.anchorOpens.free");
});

const momentName = computed(() =>
  anchor.value ? t(`parcours.anchors.${anchor.value}`) : t("parcours.day.moments.anytime"),
);
</script>

<template>
  <div>
    <label class="name-field mt-[18px]">
      <input
        v-model.lazy="name"
        :placeholder="t(`parcours.habits.${preset}`)"
        :aria-label="t('parcours.form.name')"
        maxlength="60"
      />
    </label>
    <p class="mt-2 text-[13px] text-text-secondary">{{ hint }}</p>

    <p class="create-lab">{{ t("parcours.form.days") }}</p>
    <div class="flex gap-1" role="group" :aria-label="t('parcours.form.days')">
      <button
        v-for="day in WEEKDAY_KEYS"
        :key="day"
        type="button"
        class="day-cell"
        :class="day === 6 && restsOnChabbat ? 'is-rest' : days.includes(day) ? 'is-on' : 'is-off'"
        :aria-pressed="days.includes(day)"
        :disabled="day === 6 && restsOnChabbat"
        :aria-label="t(`parcours.weekdays.${day}`)"
        @click="toggleDay(day)"
      >
        {{ t("parcours.weekdayInitials").split(",")[day] }}
      </button>
    </div>
    <p class="mt-2 text-[13px] text-text-secondary">{{ daysNote }}</p>

    <template v-if="choosesItsTime(preset)">
      <!-- Le moment se pose sur le fil du jour, du doigt. -->
      <p class="create-lab">{{ t("parcours.create.when") }}</p>
      <AnchorTrack
        v-model:anchor="trackAnchor"
        :label="t('parcours.create.when')"
        :value-text="momentName"
      />
      <p v-if="anchor" class="mt-1.5 text-base font-bold">{{ momentName }}</p>
      <p class="mt-0.5 text-[13px] text-text-secondary">{{ opensNote }}</p>
      <p v-if="anchor" class="mt-0.5 text-[13px] text-text-secondary">
        {{ t("parcours.create.slide") }}
      </p>
    </template>
    <template v-else-if="preset !== 'tefilot'">
      <!-- Son moment d'office : il se dit, on ne le demande pas. -->
      <p class="create-lab">{{ t("parcours.create.when") }}</p>
      <p class="text-base font-bold">{{ momentName }}</p>
      <p class="mt-0.5 text-[13px] text-text-secondary">{{ opensNote }}</p>
    </template>
    <p v-else class="mt-4 text-[13px] text-text-secondary">
      {{ t("parcours.create.tefilotHint") }}
    </p>

    <button
      v-if="!editing"
      type="button"
      class="btn btn-primary create-cta"
      :disabled="days.length === 0"
      :aria-disabled="armed ? undefined : 'true'"
      @click="create"
    >
      {{ t("parcours.create.confirmAdd") }}
    </button>
  </div>
</template>

<style scoped>
.create-lab {
  margin: 28px 0 12px;
  font-size: 15px;
  font-weight: 700;
}
.name-field {
  display: flex;
  height: 52px;
  align-items: center;
  padding: 0 14px;
  border-radius: var(--radius-control);
  background: var(--color-surface);
  box-shadow: inset 0 0 0 1px var(--color-line-strong);
}
.name-field input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.name-field:focus-within {
  box-shadow: inset 0 0 0 2px var(--color-primary);
}
/* Les jours, en cases plates : un choix, pas le mur. */
.day-cell {
  flex: 1;
  height: 44px;
  border-radius: 3px;
  font-size: 13px;
  font-weight: 700;
}
.day-cell.is-on {
  background: #e6cd9c;
  box-shadow: inset 0 0 0 3px #cfb07a;
  color: #5a4626;
}
.day-cell.is-off {
  background: color-mix(in srgb, var(--color-text-primary) 7%, transparent);
  box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.1);
  color: var(--color-text-secondary);
}
.day-cell.is-rest {
  background: #f5efe3;
  box-shadow: inset 0 0 0 3px #e3dac7;
  color: #8a7f6c;
  cursor: default;
}
.create-cta {
  width: 100%;
  min-height: 48px;
  margin-top: 26px;
  font-size: 15px;
  font-weight: 700;
}
</style>
