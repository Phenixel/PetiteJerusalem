<script setup lang="ts">
/**
 * Les rappels d'horaires, vus depuis les réglages.
 *
 * Ils se posent sur la page Horaires, là où l'on regarde l'heure qui vient ;
 * cet onglet-ci est celui où l'on fait le compte de ce qu'on a posé, où l'on
 * coupe le rappel du Chabbat, et où l'on voit ce que le système bloque encore.
 *
 * C'est l'appelant qui décide de l'afficher : l'onglet Notifications du profil
 * n'existe que dans l'app native, un navigateur n'ayant rien à programmer
 * (voir zmanReminderService).
 *
 * Des lignes séparées d'un filet, sans cadre, comme l'onglet Préférences et
 * comme la liste des horaires : un réglage est une ligne qu'on touche, pas une
 * carte qui répond à une question (voir docs/design.md).
 */
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import {
  ensureNotificationPermission,
  openExactAlarmSetting,
  refreshPermission,
  useZmanReminders,
} from "../../composables/useZmanReminders";
import AppIcon from "../icons/AppIcon.vue";
import ToggleSwitch from "../ToggleSwitch.vue";

const { t } = useI18n();
const { reminders, restEnabled, permission, exactAlarms, clearReminder, setRestEnabled } =
  useZmanReminders();

/** Les rappels posés, dans l'ordre où ils ont été posés (le dernier en bas). */
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
  <section>
    <h2 class="mb-2 text-2xl font-bold text-text-primary">
      {{ t("zmanim.reminder.settingsTitle") }}
    </h2>
    <p class="mb-3 text-text-secondary">{{ t("zmanim.reminder.settingsDescription") }}</p>

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

    <!-- Entrée du Chabbat et des fêtes -->
    <ul class="flex flex-col divide-y divide-line">
      <li>
        <label class="flex cursor-pointer items-center justify-between gap-3 py-3">
          <span class="min-w-0">
            <span class="block font-semibold text-text-primary">
              {{ t("zmanim.reminder.restOption") }}
            </span>
            <span class="block text-sm text-text-secondary leading-relaxed">
              {{ t("zmanim.reminder.restOptionHint") }}
            </span>
          </span>
          <ToggleSwitch :model-value="restEnabled" @update:model-value="toggleRest" />
        </label>
      </li>
    </ul>

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
        class="flex items-center justify-between gap-3 py-3"
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
          :aria-label="t('zmanim.reminder.removeAria', { name: t(`zmanim.names.${reminder.key}`) })"
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
  </section>
</template>
