import { computed, ref, watch, type Ref } from "vue";
import {
  REMINDER_SLOTS,
  readReminderSettings,
  type ReminderSettings,
  type ReminderSlot,
  type SlotSetting,
} from "../services/parcours/reminders";

/**
 * The hours of my day, as the person sets them in Mon parcours: which
 * points of the day ring, and when.
 *
 * Kept on the DEVICE (localStorage), like the zmanim reminders
 * (useZmanReminders) and for the same reason: a notification is scheduled
 * by the phone that receives it, from the place chosen on that phone. The
 * planning itself lives in services/parcours/reminders.ts.
 */

const STORAGE_KEY = "pj_parcours_reminders";

interface StoredState {
  slots: ReminderSettings;
  /**
   * The evening reminder sent by the server (functions/src/dailyReminder.ts)
   * has been carried over into these settings, on this device.
   */
  migrated: boolean;
}

function readStored(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredState>) : {};
    return { slots: readReminderSettings(parsed.slots), migrated: parsed.migrated === true };
  } catch {
    return { slots: readReminderSettings(null), migrated: false };
  }
}

const state: Ref<StoredState> = ref(readStored());

watch(
  state,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage unavailable: the settings hold for this session.
    }
  },
  { deep: true },
);

export function useParcoursReminders() {
  const settings = computed(() => state.value.slots);
  /** The slots that ring, in the order of the day. */
  const activeSlots = computed(() => REMINDER_SLOTS.filter((slot) => state.value.slots[slot].on));
  const migrated = computed(() => state.value.migrated);

  function setSlot(slot: ReminderSlot, setting: SlotSetting): void {
    state.value = { ...state.value, slots: { ...state.value.slots, [slot]: setting } };
  }

  function setMigrated(slots?: Partial<ReminderSettings>): void {
    state.value = { slots: { ...state.value.slots, ...slots }, migrated: true };
  }

  return { settings, activeSlots, migrated, setSlot, setMigrated };
}
