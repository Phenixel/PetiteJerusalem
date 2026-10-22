<script setup lang="ts">
/**
 * Reading, seen from the settings.
 *
 * Auto-scroll starts with a double tap on the text, and two close taps
 * happen without being meant. Turned off here, the gesture no longer
 * answers at all, and the text no longer starts moving down without anyone
 * knowing why. The speed stays in the bottom pill: it is set while reading,
 * not before.
 *
 * In the Android app, a second row: what a tefila does with the phone's
 * quiet modes when it opens (offer them, turn them on by themselves with or
 * without the panel as a reminder, or nothing).
 *
 * Rows separated by a rule, without a frame: the list must be able to grow
 * without becoming a stack of boxes (see docs/design.md).
 */
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import AppSelect, { type SelectOption } from "../AppSelect.vue";
import {
  prayerQuietChoice,
  restorePrayerQuietChoice,
  setPrayerQuietChoice,
  type PrayerQuietChoice,
} from "../../composables/usePrayerQuiet";
import { quietModesSupported } from "../../services/prayerQuiet";
import {
  autoScrollEnabled,
  restoreAutoScrollFromDevice,
  setAutoScrollEnabled,
} from "../../composables/useAutoScroll";
import ToggleSwitch from "../ToggleSwitch.vue";

const { t } = useI18n();

// Le réglage peut n'exister que dans les préférences natives (localStorage
// vidé par le système) : on le relit à l'ouverture de l'écran, sans quoi
// l'interrupteur s'afficherait allumé alors qu'il est coupé.
onMounted(() => void restoreAutoScrollFromDevice());

// Android app: what a tefila does with the phone's quiet modes when it opens
// (usePrayerQuiet). « Les activer d'office », with the panel as a reminder or
// without it, is offered once the panel's « À chaque tefila » has kept which
// ones; the choices of the panel are undone here.
onMounted(() => void restorePrayerQuietChoice());
const prayerQuietOptions = computed<SelectOption[]>(() => {
  const options: SelectOption[] = [{ value: "offer", label: t("prayerQuiet.settings.offer") }];
  const wish = prayerQuietChoice.value.wish;
  if (wish) {
    const modes = [
      wish.dnd ? t("prayerQuiet.modes.dnd") : null,
      wish.ringer === "silent" ? t("prayerQuiet.modes.silent") : null,
      wish.ringer === "vibrate" ? t("prayerQuiet.modes.vibrate") : null,
    ]
      .filter((mode): mode is string => mode !== null)
      .join(", ");
    options.push(
      { value: "always", label: t("prayerQuiet.settings.always", { modes }) },
      { value: "alwaysHidden", label: t("prayerQuiet.settings.alwaysHidden", { modes }) },
    );
  }
  options.push({ value: "never", label: t("prayerQuiet.settings.never") });
  return options;
});
/** « alwaysHidden »: the modes applied by themselves, without the panel. */
const prayerQuietMode = computed({
  get: () => {
    const { mode, remind } = prayerQuietChoice.value;
    return mode === "always" && !remind ? "alwaysHidden" : mode;
  },
  set: (value: string) =>
    setPrayerQuietChoice({
      mode: (value === "alwaysHidden" ? "always" : value) as PrayerQuietChoice["mode"],
      wish: prayerQuietChoice.value.wish,
      remind: value !== "alwaysHidden",
    }),
});
</script>

<template>
  <section>
    <h2 class="mb-2 text-2xl font-bold text-text-primary">
      {{ t("textReading.autoScroll.settingsTitle") }}
    </h2>
    <p class="mb-3 text-text-secondary">{{ t("textReading.autoScroll.settingsDescription") }}</p>

    <ul class="flex flex-col divide-y divide-line">
      <li>
        <label class="flex cursor-pointer items-center justify-between gap-3 py-3">
          <span class="min-w-0">
            <span class="block font-semibold text-text-primary">
              {{ t("textReading.autoScroll.option") }}
            </span>
            <span class="block text-sm text-text-secondary leading-relaxed">
              {{ t("textReading.autoScroll.optionHint") }}
            </span>
          </span>
          <ToggleSwitch
            :model-value="autoScrollEnabled"
            @update:model-value="setAutoScrollEnabled"
          />
        </label>
      </li>
      <li v-if="quietModesSupported" class="py-3">
        <span class="block font-semibold text-text-primary">
          {{ t("prayerQuiet.settings.title") }}
        </span>
        <span class="mb-2 block text-sm text-text-secondary leading-relaxed">
          {{ t("prayerQuiet.settings.hint") }}
        </span>
        <AppSelect v-model="prayerQuietMode" :options="prayerQuietOptions" />
      </li>
    </ul>
  </section>
</template>
