<script setup lang="ts">
/**
 * Le rappel du soir, venu de la lecture du jour d'avant : une notification à
 * l'heure choisie, et un dernier appel avant la chkia. C'est le serveur qui
 * l'envoie (functions/src/dailyReminder.ts), il passe donc par le compte et
 * ne vaut que dans l'app : ailleurs, ce bouton ne paraît pas, plutôt que de
 * promettre ce qu'il ne tiendrait pas.
 */
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { isNativeApp } from "../../composables/useNativeApp";
import { useParcours } from "../../composables/useParcours";
import { useToast } from "../../composables/useToast";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { useZmanimPlaceLabel } from "../../composables/useZmanimPlaceLabel";
import { analyticsService } from "../../services/analyticsService";
import { authService } from "../../services/authService";
import { pushService } from "../../services/pushService";
import {
  SUNSET_REMINDER_OFFSET_MINUTES,
  coarsePlace,
  formatZmanTime,
  getSunset,
} from "../../services/zmanimService";
import ReminderSettingsModal from "./ReminderSettingsModal.vue";

const { t, locale } = useI18n();
const toast = useToast();
const store = useParcours();
const { place } = useZmanimLocation();
const placeLabel = useZmanimPlaceLabel(place);

const available = computed(() => isNativeApp && store.signedIn.value);

const enabled = ref(false);
const daily = ref(true);
const hour = ref(18);
const minute = ref(0);
const sunset = ref(false);
const busy = ref(false);
const open = ref(false);

const sunsetToday = computed(() => {
  const at = getSunset(place.value);
  return at ? formatZmanTime(at, place.value.tzid, locale.value) : null;
});

const summary = computed(() =>
  enabled.value
    ? describe({
        enabled: true,
        daily: daily.value,
        hour: hour.value,
        minute: minute.value,
        sunset: sunset.value,
      })
    : "",
);

onMounted(async () => {
  const user = await authService.getCurrentUser();
  if (!user || !isNativeApp) return;
  const { userPreferencesService } = await import("../../services/userPreferencesService");
  const prefs =
    userPreferencesService.getCachedPreferences(user.id) ??
    (await userPreferencesService.getPreferences(user.id));
  enabled.value = prefs.pushReminderEnabled === true;
  daily.value = prefs.pushReminderDailyEnabled !== false;
  hour.value = prefs.pushReminderHour ?? 18;
  minute.value = prefs.pushReminderMinute ?? 0;
  sunset.value = prefs.pushSunsetReminderEnabled === true;
});

interface ReminderChoice {
  enabled: boolean;
  daily: boolean;
  hour: number;
  minute: number;
  sunset: boolean;
}

const time = (h: number, m: number) =>
  `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

function describe(choice: ReminderChoice): string {
  const parts: string[] = [];
  if (choice.daily)
    parts.push(t("notifications.summaryDaily", { time: time(choice.hour, choice.minute) }));
  if (choice.sunset) {
    parts.push(t("notifications.summarySunset", { minutes: SUNSET_REMINDER_OFFSET_MINUTES }));
  }
  return parts.join(t("notifications.summaryJoin"));
}

function openSettings(): void {
  if (busy.value) return;
  if (!navigator.onLine) {
    toast.info(t("parcours.reminder.offline"));
    return;
  }
  analyticsService.capture("reminder_settings_opened", {
    enabled: enabled.value,
    daily: daily.value,
    sunset: sunset.value,
  });
  open.value = true;
}

async function save(choice: ReminderChoice): Promise<void> {
  const user = await authService.getCurrentUser();
  if (!user) return;
  busy.value = true;
  try {
    if (!choice.enabled) {
      await pushService.disable(user.id);
      enabled.value = false;
      analyticsService.capture("reminder_disabled");
      toast.success(t("notifications.disabledToast"));
      return;
    }
    await pushService.enable(user.id, String(locale.value), {
      daily: choice.daily,
      hour: choice.hour,
      minute: choice.minute,
      sunset: choice.sunset,
      // La position ne quitte l'appareil que pour ce rappel-là, et arrondie.
      place: choice.sunset ? coarsePlace(place.value) : null,
    });
    enabled.value = true;
    daily.value = choice.daily;
    hour.value = choice.hour;
    minute.value = choice.minute;
    sunset.value = choice.sunset;
    analyticsService.capture("reminder_enabled", {
      hour: choice.hour,
      minute: choice.minute,
      daily: choice.daily,
      sunset: choice.sunset,
    });
    toast.success(t("notifications.enabledToast", { reminders: describe(choice) }));
  } catch (error: unknown) {
    const denied = error instanceof Error && error.message === "PERMISSION_DENIED";
    if (choice.enabled) {
      analyticsService.capture(
        "reminder_enable_failed",
        denied
          ? { reason: "permission_denied" }
          : {
              reason: "error",
              error_message: error instanceof Error ? error.message : String(error),
            },
      );
    } else {
      analyticsService.capture("reminder_disable_failed", {
        error_message: error instanceof Error ? error.message : String(error),
      });
    }
    toast.error(t(denied ? "notifications.permissionDenied" : "notifications.error"));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div v-if="available">
    <button
      type="button"
      class="card card-hover press-feedback flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
      :disabled="busy"
      @click="openSettings"
    >
      <span>
        <span class="block text-[15px] font-bold">{{ t("parcours.reminder.title") }}</span>
        <span class="block text-[13px] text-text-secondary">
          {{ enabled ? summary : t("parcours.reminder.off") }}
        </span>
      </span>
      <span class="text-sm font-bold text-primary">{{ t("parcours.reminder.set") }}</span>
    </button>
    <ReminderSettingsModal
      v-model:show="open"
      :enabled="enabled"
      :daily="daily"
      :hour="hour"
      :minute="minute"
      :sunset="sunset"
      :sunset-offset="SUNSET_REMINDER_OFFSET_MINUTES"
      :sunset-time="sunsetToday"
      :place-label="placeLabel"
      @save="save"
    />
  </div>
</template>
