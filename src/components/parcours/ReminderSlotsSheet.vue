<script setup lang="ts">
/**
 * "The hours of my day": when each point of the day thread rings.
 *
 * A row per point (wake, Cha'harit, noon, Min'ha, Arvit, bedtime) and one
 * for the day's summary: its hour today, how many of today's objectives it
 * gathers, and its switch. Touching a row opens its second screen: a fixed
 * hour on the dial, or a zman of its moment with an offset before or after.
 * Rows separated by a hairline, no frames: a setting is a row one touches
 * (docs/design.md, "Reminders of the day").
 *
 * Opened by the alarm clock at the top of Mon parcours, by the line under
 * the light, by the daily reading page and by the notification settings.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import type { IconName } from "../icons/registry";
import ToggleSwitch from "../ToggleSwitch.vue";
import BottomSheet from "./BottomSheet.vue";
import TimeDial from "./pickers/TimeDial.vue";
import { useParcours } from "../../composables/useParcours";
import { useParcoursReminders } from "../../composables/useParcoursReminders";
import { useToast } from "../../composables/useToast";
import {
  ensureNotificationPermission,
  refreshPermission,
  useZmanReminders,
} from "../../composables/useZmanReminders";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { useZmanimPlaceLabel } from "../../composables/useZmanimPlaceLabel";
import { analyticsService } from "../../services/analyticsService";
import { addDays } from "../../services/parcours/days";
import {
  DEFAULT_SLOT_TIMES,
  OFFSET_CHOICES,
  REMINDER_SLOTS,
  SLOT_ZMANIM,
  slotCounts,
  slotTimeOn,
  type ReminderSlot,
  type SlotTime,
} from "../../services/parcours/reminders";
import { formatZmanTime, type ZmanKey } from "../../services/zmanimService";

const props = defineProps<{ open: boolean; source: string }>();
const emit = defineEmits<{ (e: "close"): void }>();

const { t, locale } = useI18n();
const toast = useToast();
const store = useParcours();
const reminders = useParcoursReminders();
const { permission } = useZmanReminders();
const { place } = useZmanimLocation();
const placeLabel = useZmanimPlaceLabel(place);

/** A point of the day, drawn by what the sky does then. */
const SLOT_ICON: Record<ReminderSlot, IconName> = {
  wake: "sunrise",
  chaharit: "sun",
  noon: "sun",
  minha: "sunset",
  arvit: "moon",
  bedtime: "moon",
  day: "list",
};

/** The slot being set on the second screen, null on the list. */
const editing = ref<ReminderSlot | null>(null);
/** Its draft: nothing is kept until « Enregistrer ». */
const draft = ref<SlotTime>({ ...DEFAULT_SLOT_TIMES.day });
/** The direction of the offset, kept apart so that 0 can be « avant » or « après ». */
const direction = ref<"before" | "after">("before");

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    editing.value = null;
    void refreshPermission();
    analyticsService.capture("parcours_reminders_opened", {
      source: props.source,
      active_count: reminders.activeSlots.value.length,
    });
  },
);

const blocked = computed(() => permission.value === "denied");

const counts = computed(() => slotCounts(store.todayTasks.value, store.data.value.objectives));

const pad = (n: number): string => String(n).padStart(2, "0");

function slotName(slot: ReminderSlot): string {
  return slot === "day" ? t("parcours.reminders.day") : t(`parcours.anchorPoints.${slot}`);
}

/** Its hour on a day, as written on the page. */
function timeLabel(time: SlotTime, day = store.today.value): string {
  if (time.kind === "fixed") return `${pad(time.hour)}:${pad(time.minute)}`;
  const at = slotTimeOn(time, place.value, day);
  return at ? formatZmanTime(at, place.value.tzid, locale.value) : "--:--";
}

/** What its hour follows: « Heure fixe », « Chkia », « 20 min avant Chkia ». */
function ruleLabel(time: SlotTime): string {
  if (time.kind === "fixed") return t("parcours.reminders.fixed");
  const zman = t(`zmanim.names.${time.zman}`);
  if (time.offset === 0) return zman;
  return t(time.offset < 0 ? "parcours.reminders.before" : "parcours.reminders.after", {
    minutes: Math.abs(time.offset),
    zman,
  });
}

const rows = computed(() =>
  REMINDER_SLOTS.map((slot) => {
    const setting = reminders.settings.value[slot];
    const count = counts.value[slot];
    return {
      slot,
      on: setting.on,
      name: slotName(slot),
      icon: SLOT_ICON[slot],
      rule: ruleLabel(setting.time),
      time: timeLabel(setting.time),
      count,
      countLabel: t("parcours.reminders.objectives", { n: count }, count),
    };
  }),
);

/** Turning a slot on asks for the system's permission: the gesture is there. */
async function allowed(): Promise<boolean> {
  if (await ensureNotificationPermission(true)) return true;
  toast.error(t("notifications.permissionDenied"));
  return false;
}

function track(slot: ReminderSlot, on: boolean, time: SlotTime): void {
  analyticsService.capture("parcours_reminder_set", {
    slot,
    on,
    kind: time.kind,
    zman: time.kind === "zman" ? time.zman : null,
    offset: time.kind === "zman" ? time.offset : null,
    hour: time.kind === "fixed" ? time.hour : null,
  });
}

async function toggle(slot: ReminderSlot, on: boolean): Promise<void> {
  if (on && !(await allowed())) return;
  const setting = reminders.settings.value[slot];
  reminders.setSlot(slot, { ...setting, on });
  track(slot, on, setting.time);
}

function edit(slot: ReminderSlot): void {
  const time = reminders.settings.value[slot].time;
  draft.value = { ...time };
  direction.value = time.kind === "zman" && time.offset > 0 ? "after" : "before";
  editing.value = slot;
}

/** Switching between a fixed hour and the calendar keeps what each had. */
function setKind(kind: SlotTime["kind"]): void {
  if (draft.value.kind === kind || !editing.value) return;
  const saved = reminders.settings.value[editing.value].time;
  const fallback = DEFAULT_SLOT_TIMES[editing.value];
  if (kind === "fixed") {
    const from = saved.kind === "fixed" ? saved : fallback.kind === "fixed" ? fallback : null;
    draft.value = { kind: "fixed", hour: from?.hour ?? 21, minute: from?.minute ?? 0 };
  } else {
    const from = saved.kind === "zman" ? saved : fallback.kind === "zman" ? fallback : null;
    const zman = from?.zman ?? SLOT_ZMANIM[editing.value][0];
    draft.value = { kind: "zman", zman, offset: from?.offset ?? 0 };
    direction.value = (from?.offset ?? 0) > 0 ? "after" : "before";
  }
}

const zmanChoices = computed(() => {
  if (!editing.value) return [];
  const own = SLOT_ZMANIM[editing.value];
  // A zman chosen elsewhere (an older version, another list) stays offered.
  const current = draft.value.kind === "zman" ? draft.value.zman : null;
  const keys: ZmanKey[] = current && !own.includes(current) ? [...own, current] : [...own];
  return keys.map((key) => ({
    key,
    name: t(`zmanim.names.${key}`),
    time: timeLabel({ kind: "zman", zman: key, offset: 0 }),
  }));
});

const draftZman = computed(() => (draft.value.kind === "zman" ? draft.value.zman : null));

const offsetMinutes = computed(() =>
  draft.value.kind === "zman" ? Math.abs(draft.value.offset) : 0,
);

function setZman(zman: ZmanKey): void {
  if (draft.value.kind === "zman") draft.value = { ...draft.value, zman };
}

function setOffset(minutes: number, towards = direction.value): void {
  if (draft.value.kind !== "zman") return;
  direction.value = towards;
  draft.value = { ...draft.value, offset: towards === "before" ? -minutes : minutes };
}

const fixedHour = computed({
  get: () => (draft.value.kind === "fixed" ? draft.value.hour : 0),
  set: (hour: number) => {
    if (draft.value.kind === "fixed") draft.value = { ...draft.value, hour };
  },
});
const fixedMinute = computed({
  get: () => (draft.value.kind === "fixed" ? draft.value.minute : 0),
  set: (minute: number) => {
    if (draft.value.kind === "fixed") draft.value = { ...draft.value, minute };
  },
});

/** The hour of the draft today, and how it moves (the calendar) or not. */
const preview = computed(() => {
  const tomorrow = addDays(store.today.value, 1);
  return {
    today: timeLabel(draft.value),
    note:
      draft.value.kind === "fixed"
        ? t("parcours.reminders.previewFixed")
        : t("parcours.reminders.previewMoves", { time: timeLabel(draft.value, tomorrow) }),
  };
});

/** Choosing an hour is wanting the reminder: saving turns it on. */
async function save(): Promise<void> {
  const slot = editing.value;
  if (!slot) return;
  if (!(await allowed())) return;
  const time = draft.value;
  reminders.setSlot(slot, { on: true, time });
  track(slot, true, time);
  editing.value = null;
}
</script>

<template>
  <BottomSheet :open="open" :label="t('parcours.reminders.title')" @close="emit('close')">
    <template v-if="editing === null">
      <p class="font-display text-2xl font-bold outline-none" tabindex="-1" data-autofocus>
        {{ t("parcours.reminders.title") }}
      </p>
      <p class="mt-1.5 text-[14px] leading-normal text-text-secondary">
        {{ t("parcours.reminders.intro", { place: placeLabel }) }}
      </p>
      <p
        v-if="blocked"
        class="mt-3 flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400"
      >
        <AppIcon name="alert-triangle" :size="15" class="mt-0.5 shrink-0" />
        {{ t("notifications.permissionDenied") }}
      </p>

      <ul class="mt-3 flex flex-col divide-y divide-line">
        <li v-for="row in rows" :key="row.slot" class="flex items-center gap-3 py-2.5">
          <button
            type="button"
            class="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-start"
            :aria-label="t('parcours.reminders.editAria', { name: row.name })"
            @click="edit(row.slot)"
          >
            <AppIcon
              :name="row.icon"
              :size="20"
              class="shrink-0"
              :class="row.on ? 'text-text-secondary' : 'text-text-secondary/60'"
            />
            <span class="min-w-0 flex-1">
              <span
                class="block text-[15px] font-bold"
                :class="row.on ? '' : 'text-text-secondary'"
              >
                {{ row.name }}
              </span>
              <span class="block text-[13px] text-text-secondary">
                {{ row.rule }} ·
                <span
                  class="whitespace-nowrap font-semibold"
                  :class="row.on && row.count > 0 ? 'text-primary' : ''"
                >
                  {{ row.countLabel }}
                </span>
              </span>
            </span>
            <span
              class="shrink-0 text-[15px] tabular-nums"
              :class="row.on ? 'font-bold' : 'font-semibold text-text-secondary'"
            >
              {{ row.time }}
            </span>
          </button>
          <ToggleSwitch
            :model-value="row.on"
            :label="t('parcours.reminders.toggleAria', { name: row.name })"
            @update:model-value="(on: boolean) => toggle(row.slot, on)"
          />
        </li>
      </ul>
      <p class="mt-2 text-[13px] leading-normal text-text-secondary">
        {{ t("parcours.reminders.footer") }}
      </p>
    </template>

    <!-- ===== The hour of one point of the day ===== -->
    <template v-else>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="icon-btn -ms-2"
          :aria-label="t('common.back')"
          @click="editing = null"
        >
          <AppIcon name="chevron-left" :size="20" class="rtl:rotate-180" />
        </button>
        <p class="font-display text-2xl font-bold outline-none" tabindex="-1">
          {{ slotName(editing) }}
        </p>
      </div>

      <div class="segmented mt-4" role="group" :aria-label="t('parcours.reminders.modeLabel')">
        <button
          type="button"
          :class="{ 'is-on': draft.kind === 'fixed' }"
          :aria-pressed="draft.kind === 'fixed'"
          @click="setKind('fixed')"
        >
          {{ t("parcours.reminders.modeFixed") }}
        </button>
        <button
          type="button"
          :class="{ 'is-on': draft.kind === 'zman' }"
          :aria-pressed="draft.kind === 'zman'"
          @click="setKind('zman')"
        >
          {{ t("parcours.reminders.modeZman") }}
        </button>
      </div>

      <TimeDial
        v-if="draft.kind === 'fixed'"
        v-model:hour="fixedHour"
        v-model:minute="fixedMinute"
      />

      <template v-else>
        <p class="mb-2 mt-5 text-[13px] font-bold">{{ t("parcours.reminders.relativeTo") }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="choice in zmanChoices"
            :key="choice.key"
            type="button"
            class="pill"
            :class="{ 'is-on': draftZman === choice.key }"
            :aria-pressed="draftZman === choice.key"
            @click="setZman(choice.key)"
          >
            {{ choice.name }}
            <span class="pill-time">{{ choice.time }}</span>
          </button>
        </div>

        <p class="mb-2 mt-5 text-[13px] font-bold">{{ t("parcours.reminders.offset") }}</p>
        <div class="segmented mb-2.5" role="group" :aria-label="t('parcours.reminders.offset')">
          <button
            type="button"
            :class="{ 'is-on': direction === 'before' }"
            :aria-pressed="direction === 'before'"
            @click="setOffset(offsetMinutes, 'before')"
          >
            {{ t("parcours.reminders.beforeShort") }}
          </button>
          <button
            type="button"
            :class="{ 'is-on': direction === 'after' }"
            :aria-pressed="direction === 'after'"
            @click="setOffset(offsetMinutes, 'after')"
          >
            {{ t("parcours.reminders.afterShort") }}
          </button>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="minutes in OFFSET_CHOICES"
            :key="minutes"
            type="button"
            class="pill"
            :class="{ 'is-on': offsetMinutes === minutes }"
            :aria-pressed="offsetMinutes === minutes"
            @click="setOffset(minutes)"
          >
            {{ t("parcours.reminders.minutes", { n: minutes }) }}
          </button>
        </div>
      </template>

      <div class="mt-5 text-center">
        <p class="font-display text-[40px] font-bold leading-none text-primary tabular-nums">
          {{ preview.today }}
        </p>
        <p class="mt-1.5 text-[13px] text-text-secondary">
          {{ t("parcours.reminders.previewToday", { place: placeLabel }) }}
          <br />
          {{ preview.note }}
        </p>
      </div>

      <button type="button" class="btn btn-primary mt-5 min-h-11 w-full" @click="save">
        {{ t("parcours.reminders.save") }}
      </button>
    </template>
  </BottomSheet>
</template>

<style scoped>
/* Fixed hour or calendar, before or after: two segments, the one taken in solid color. */
.segmented {
  display: flex;
  padding: 3px;
  border-radius: var(--radius-btn);
  background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
}
.segmented button {
  flex: 1;
  height: 38px;
  border-radius: 11px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-secondary);
}
.segmented button.is-on {
  background: var(--color-brand);
  color: var(--color-on-brand);
}
.pill {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-height: 38px;
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  font-size: 14px;
  font-weight: 700;
  background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
  color: var(--color-text-primary);
}
.pill.is-on {
  background: var(--color-brand);
  color: var(--color-on-brand);
}
.pill-time {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}
</style>
