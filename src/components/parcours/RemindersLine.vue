<script setup lang="ts">
/**
 * The reminders still to come today, in one line under the light of Mon
 * parcours: « Rappels : Min'ha 18:12, Coucher 00:00 ». No frame: a line of
 * text one touches whole, which opens "The hours of my day". With nothing
 * set, it offers to set them; with nothing left today, it says what rings
 * first tomorrow.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import { useNow } from "../../composables/useNow";
import { useParcours } from "../../composables/useParcours";
import { useParcoursReminders } from "../../composables/useParcoursReminders";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { addDays } from "../../services/parcours/days";
import { slotTimeOn, type ReminderSlot } from "../../services/parcours/reminders";
import type { DayKey } from "../../services/parcours/model";
import { formatZmanTime } from "../../services/zmanimService";

const emit = defineEmits<{ (e: "open"): void }>();

const { t, locale } = useI18n();
const now = useNow();
const store = useParcours();
const reminders = useParcoursReminders();
const { place } = useZmanimLocation();

/** Shown by name: past these, a count. */
const SHOWN = 2;

function slotName(slot: ReminderSlot): string {
  return slot === "day" ? t("parcours.reminders.day") : t(`parcours.anchorPoints.${slot}`);
}

/** The active slots of a day, in the order they ring, still to come. */
function upcoming(day: DayKey): { name: string; time: string }[] {
  return reminders.activeSlots.value
    .map((slot) => ({
      slot,
      at: slotTimeOn(reminders.settings.value[slot].time, place.value, day),
    }))
    .filter((entry): entry is { slot: ReminderSlot; at: Date } => entry.at !== null)
    .filter((entry) => entry.at.getTime() > now.value.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((entry) => ({
      name: slotName(entry.slot),
      time: formatZmanTime(entry.at, place.value.tzid, locale.value),
    }));
}

const line = computed(() => {
  if (reminders.activeSlots.value.length === 0) return null;
  const today = upcoming(store.today.value);
  const entries = today.length > 0 ? today : upcoming(addDays(store.today.value, 1)).slice(0, 1);
  return {
    label: t(today.length > 0 ? "parcours.reminders.line" : "parcours.reminders.lineTomorrow"),
    entries: entries
      .slice(0, SHOWN)
      .map((entry) => ({ name: entry.name, label: `${entry.name}\u00a0${entry.time}` })),
    more:
      entries.length > SHOWN
        ? ` ${t("parcours.reminders.more", { n: entries.length - SHOWN })}`
        : "",
  };
});
</script>

<template>
  <button
    type="button"
    class="press-feedback max-w-full rounded-control px-2 py-1 text-center text-[13.5px] leading-relaxed"
    data-tour="parcours-reminders"
    @click="emit('open')"
  >
    <AppIcon name="alarm-clock" :size="16" class="me-1.5 inline-block align-[-3px] text-primary" />
    <template v-if="line">
      <span class="text-text-secondary">{{ `${line.label} ` }}</span>
      <template v-for="(entry, i) in line.entries" :key="entry.name">
        <span class="whitespace-nowrap font-bold text-text-primary">{{ entry.label }}</span>
        <span v-if="i < line.entries.length - 1" class="text-text-secondary">{{ ", " }}</span>
      </template>
      <span v-if="line.more" class="whitespace-nowrap text-text-secondary">{{ line.more }}</span>
    </template>
    <span v-else class="font-bold text-primary">{{ t("parcours.reminders.lineNone") }}</span>
  </button>
</template>
