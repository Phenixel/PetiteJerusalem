<script setup lang="ts">
/**
 * Les rappels d'horaires, vus depuis les réglages.
 *
 * Ils se posent sur la page Horaires, là où l'on regarde l'heure qui vient ;
 * cette page-ci est celle où l'on fait le compte de ce qu'on a posé, où l'on
 * coupe le rappel du Chabbat, et où l'on voit ce que le système bloque encore.
 *
 * App native seulement : une notification est programmée par le téléphone
 * (voir zmanReminderService), un navigateur n'a rien à programmer.
 */
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { isNativeApp } from "../../composables/useNativeApp";
import {
  ensureNotificationPermission,
  openExactAlarmSetting,
  refreshPermission,
  useZmanReminders,
} from "../../composables/useZmanReminders";
import AppIcon from "../icons/AppIcon.vue";

const { t } = useI18n();
const { reminders, restEnabled, permission, exactAlarms, clearReminder, setRestEnabled } =
  useZmanReminders();

/** Les rappels posés, dans l'ordre de la journée : celui de la liste des horaires. */
const posted = computed(() => [...reminders.value]);

const blocked = computed(() => permission.value === "denied");

// La permission se change dans les réglages du téléphone, hors de l'app : on
// la relit à l'ouverture de l'écran plutôt que de se fier au dernier état vu.
onMounted(() => void refreshPermission());

async function toggleRest(value: boolean): Promise<void> {
  // Activer, c'est demander à être prévenu : c'est le moment de demander la
  // permission au système, jamais avant.
  if (value && !(await ensureNotificationPermission(true))) return;
  setRestEnabled(value);
}

function delayLabel(minutes: number): string {
  return minutes === 0 ? t("zmanim.reminder.atTime") : t("zmanim.reminder.before", { minutes });
}
</script>

<template>
  <section v-if="isNativeApp">
    <h2 class="mb-2 text-2xl font-bold text-text-primary">
      {{ t("zmanim.reminder.settingsTitle") }}
    </h2>
    <p class="mb-6 text-text-secondary">{{ t("zmanim.reminder.settingsDescription") }}</p>

    <!-- Permission refusée : rien ne partira, et cela ne se règle que dans le
         téléphone. On le dit avant la liste, sinon les réglages du dessous
         mentent. -->
    <p
      v-if="blocked"
      class="mb-4 flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400"
    >
      <AppIcon name="alert-triangle" :size="15" class="mt-0.5 shrink-0" />
      {{ t("zmanim.reminder.permissionDenied") }}
    </p>

    <div class="rounded-card bg-surface p-5 shadow-card">
      <!-- Entrée du Chabbat et des fêtes -->
      <label class="flex cursor-pointer items-center justify-between gap-3">
        <span>
          <span class="block font-semibold text-text-primary">
            {{ t("zmanim.reminder.restOption") }}
          </span>
          <span class="block text-sm text-text-secondary">
            {{ t("zmanim.reminder.restOptionHint") }}
          </span>
        </span>
        <span class="relative inline-flex shrink-0 items-center">
          <input
            type="checkbox"
            class="sr-only peer"
            :checked="restEnabled"
            @change="toggleRest(($event.target as HTMLInputElement).checked)"
          />
          <span
            class="w-10 h-5 bg-black/15 peer-focus-visible:outline-2 peer-focus-visible:outline-primary rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:shadow-sm after:transition-all peer-checked:bg-primary dark:bg-white/20"
          ></span>
        </span>
      </label>

      <!-- Les rappels posés sur les horaires du jour -->
      <h3 class="mt-6 mb-1 text-sm font-semibold text-text-secondary">
        {{ t("zmanim.reminder.postedTitle") }}
      </h3>
      <p v-if="posted.length === 0" class="text-sm text-text-secondary">
        {{ t("zmanim.reminder.postedEmpty") }}
      </p>
      <ul v-else class="flex flex-col divide-y divide-line">
        <li
          v-for="reminder in posted"
          :key="reminder.key"
          class="flex items-center justify-between gap-3 py-2.5"
        >
          <span class="min-w-0">
            <span class="block font-medium leading-snug text-text-primary">
              {{ t(`zmanim.names.${reminder.key}`) }}
            </span>
            <span class="block text-sm text-text-secondary">
              {{ delayLabel(reminder.minutesBefore) }}
            </span>
          </span>
          <button
            type="button"
            class="icon-btn shrink-0"
            :aria-label="
              t('zmanim.reminder.removeAria', { name: t(`zmanim.names.${reminder.key}`) })
            "
            @click="clearReminder(reminder.key)"
          >
            <AppIcon name="trash" :size="16" />
          </button>
        </li>
      </ul>

      <!-- Android 12+ : sans « alarmes et rappels », le système garde la
           notification pour sa prochaine fenêtre de veille, et un rappel de
           dix minutes avant peut arriver après l'horaire qu'il annonce. -->
      <div v-if="!exactAlarms" class="mt-5 border-t border-line pt-4">
        <p class="text-sm text-text-secondary">{{ t("zmanim.reminder.exactAlarms") }}</p>
        <button type="button" class="btn btn-soft mt-2" @click="openExactAlarmSetting">
          <AppIcon name="settings" :size="14" />
          {{ t("zmanim.reminder.exactAlarmsCta") }}
        </button>
      </div>
    </div>
  </section>
</template>
