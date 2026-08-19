<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { formatZmanTime, slihotWindow } from "../../services/zmanimService";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import AppIcon from "../../components/icons/AppIcon.vue";

/**
 * La plage où se disent les Sli'hot, en tête du texte : de hatsot au lever du
 * soleil, pour la nuit en cours (ou celle qui vient, une fois le jour levé).
 * Le « i » explique la règle plutôt que de laisser deviner à quoi correspondent
 * les deux heures.
 */
const { t, locale } = useI18n();
const { place } = useZmanimLocation();

const window = computed(() => slihotWindow(place.value));
const startTime = computed(() =>
  window.value ? formatZmanTime(window.value.start, place.value.tzid, locale.value) : "",
);
const endTime = computed(() =>
  window.value ? formatZmanTime(window.value.end, place.value.tzid, locale.value) : "",
);

const showInfo = ref(false);
</script>

<template>
  <div v-if="window" class="mb-6 card p-4">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <AppIcon name="moon" :size="18" class="text-primary flex-shrink-0" />
        <div class="min-w-0">
          <p class="text-sm font-semibold text-text-primary">
            {{ t("textReading.slihotHours") }}
          </p>
          <p class="text-sm text-text-secondary">
            {{ t("textReading.slihotRange", { start: startTime, end: endTime }) }}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="icon-btn flex-shrink-0"
        :aria-expanded="showInfo"
        :aria-label="t('textReading.slihotHoursInfo')"
        :title="t('textReading.slihotHoursInfo')"
        @click="showInfo = !showInfo"
      >
        <AppIcon name="info" :size="16" />
      </button>
    </div>
    <p v-if="showInfo" class="mt-3 text-sm text-text-secondary leading-relaxed">
      {{ t("textReading.slihotWindowExplained", { start: startTime, end: endTime }) }}
      <span v-if="place.city" class="text-text-secondary/70">, {{ place.city }}</span>
    </p>
  </div>
</template>
