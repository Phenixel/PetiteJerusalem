<script setup lang="ts">
/**
 * Une habitude (P2-Habitude) : son nom (celui du modèle s'il reste vide),
 * ses jours en cases plates, et son moment, qu'on pose sur le fil du jour
 * en glissant le rond : au réveil, avec Cha'harit, à midi, avec Min'ha, avec
 * Arvit, au coucher ; ou toute la journée. Les trois tefilot ont chacune le
 * leur.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  ANCHOR_MOMENT,
  HABIT_ANCHORS,
  isOwnHabit,
  type HabitAnchor,
  type HabitPreset,
  type MomentId,
} from "../../../services/parcours/model";
import { haptic } from "../../../services/haptics";

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
 * « Ajouter à ma journée » ne répond qu'un instant après l'arrivée sur
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

/** Où sont les repères sur le fil, en pour cent de sa largeur. */
const POSITIONS: Record<HabitAnchor, number> = {
  wake: 6,
  chaharit: 18,
  noon: 40,
  minha: 66,
  arvit: 80,
  bedtime: 94,
};

const track = ref<HTMLElement | null>(null);
const dragging = ref<number | null>(null);

function nearest(position: number): HabitAnchor {
  return HABIT_ANCHORS.reduce((best, a) =>
    Math.abs(POSITIONS[a] - position) < Math.abs(POSITIONS[best] - position) ? a : best,
  );
}

/** Le repère, et le moment qui s'en déduit : le repère en dernier, il porte les deux. */
function setAnchor(next: HabitAnchor | null): void {
  moment.value = next ? ANCHOR_MOMENT[next] : "anytime";
  anchor.value = next;
}

function positionOf(event: PointerEvent): number {
  const rect = track.value?.getBoundingClientRect();
  if (!rect || rect.width === 0) return 50;
  const share = ((event.clientX - rect.left) / rect.width) * 100;
  // Le fil se lit dans le sens de la page : en hébreu, le réveil est à droite.
  const dirShare = getComputedStyle(track.value!).direction === "rtl" ? 100 - share : share;
  return Math.max(2, Math.min(98, dirShare));
}

function onDown(event: PointerEvent): void {
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // Le pointeur est déjà relâché : rien à capturer.
  }
  dragging.value = positionOf(event);
}
function onMove(event: PointerEvent): void {
  if (dragging.value === null) return;
  const before = nearest(dragging.value);
  dragging.value = positionOf(event);
  // Le rond passe d'un repère à l'autre : un battement.
  if (nearest(dragging.value) !== before) haptic("tick");
}
function onUp(): void {
  if (dragging.value === null) return;
  setAnchor(nearest(dragging.value));
  dragging.value = null;
}

function onKey(event: KeyboardEvent): void {
  const index = anchor.value ? HABIT_ANCHORS.indexOf(anchor.value) : -1;
  const forward = event.key === "ArrowRight" || event.key === "ArrowUp";
  const backward = event.key === "ArrowLeft" || event.key === "ArrowDown";
  if (!forward && !backward) return;
  event.preventDefault();
  const rtl = getComputedStyle(event.currentTarget as HTMLElement).direction === "rtl";
  const step =
    (forward ? 1 : -1) *
    (rtl && (event.key === "ArrowRight" || event.key === "ArrowLeft") ? -1 : 1);
  const next = Math.max(0, Math.min(HABIT_ANCHORS.length - 1, (index < 0 ? 0 : index) + step));
  setAnchor(HABIT_ANCHORS[next]);
}

const knot = computed(() => {
  if (dragging.value !== null) return dragging.value;
  return anchor.value ? POSITIONS[anchor.value] : null;
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

    <template v-if="preset !== 'tefilot'">
      <!-- Le moment se pose sur le fil du jour, du doigt. -->
      <p class="create-lab">{{ t("parcours.create.when") }}</p>
      <div
        ref="track"
        class="anchor-track"
        role="slider"
        tabindex="0"
        :aria-label="t('parcours.create.when')"
        :aria-valuetext="momentName"
        aria-valuemin="0"
        :aria-valuemax="HABIT_ANCHORS.length - 1"
        :aria-valuenow="anchor ? HABIT_ANCHORS.indexOf(anchor) : undefined"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @keydown="onKey"
      >
        <span class="anchor-line" />
        <template v-for="(a, i) in HABIT_ANCHORS" :key="a">
          <span class="anchor-point" :style="{ insetInlineStart: `${POSITIONS[a]}%` }" />
          <span
            class="anchor-label"
            :style="{ insetInlineStart: `${POSITIONS[a]}%`, top: i % 2 === 0 ? '70px' : '8px' }"
          >
            {{ t(`parcours.anchorPoints.${a}`) }}
          </span>
        </template>
        <span v-if="knot !== null" class="anchor-knot" :style="{ insetInlineStart: `${knot}%` }" />
      </div>
      <p class="mt-1.5 text-base font-bold">{{ momentName }}</p>
      <p class="mt-0.5 text-[13px] text-text-secondary">{{ opensNote }}</p>
      <p class="mt-0.5 text-[13px] text-text-secondary">
        {{ t("parcours.create.slide") }}
        <button
          type="button"
          class="font-bold text-primary"
          :aria-pressed="anchor === null"
          @click="setAnchor(null)"
        >
          {{ t("parcours.create.allDay") }}
        </button>
      </p>
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
      {{ t("parcours.create.addToDay") }}
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
/* Le fil du jour, et le rond qu'on y pose. */
.anchor-track {
  position: relative;
  height: 96px;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
}
.anchor-track:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-card);
}
.anchor-line {
  position: absolute;
  inset-inline: 0;
  top: 46px;
  height: 3px;
  border-radius: 3px;
  background: var(--color-line-strong);
}
.anchor-point {
  position: absolute;
  top: 42px;
  width: 11px;
  height: 11px;
  margin-inline-start: -5.5px;
  border-radius: var(--radius-pill);
  background: var(--color-page);
  box-shadow: inset 0 0 0 2px var(--color-line-strong);
}
.anchor-label {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}
[dir="rtl"] .anchor-label {
  transform: translateX(50%);
}
.anchor-knot {
  position: absolute;
  top: 33px;
  width: 30px;
  height: 30px;
  margin-inline-start: -15px;
  border-radius: var(--radius-pill);
  background: var(--color-brand);
  box-shadow:
    0 0 0 6px color-mix(in srgb, var(--color-brand) 25%, transparent),
    0 3px 8px rgb(58 46 30 / 0.25);
}
.create-cta {
  width: 100%;
  min-height: 48px;
  margin-top: 26px;
  font-size: 15px;
  font-weight: 700;
}
</style>
