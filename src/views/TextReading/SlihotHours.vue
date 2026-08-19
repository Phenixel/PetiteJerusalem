<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { formatZmanTime, getSunset, slihotWindow } from "../../services/zmanimService";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import AppIcon from "../../components/icons/AppIcon.vue";

/**
 * La plage où se disent les Sli'hot, en tête du texte : de hatsot au lever du
 * soleil, pour la nuit en cours (ou celle qui vient, une fois le jour levé).
 * Le « i » explique la règle plutôt que de laisser deviner à quoi correspondent
 * les deux heures : le début, le moment le plus recommandé, et le rattrapage
 * de la journée pour qui n'a pas pu la nuit.
 */
const { t, locale } = useI18n();
const { place } = useZmanimLocation();

// La plage bascule sur la nuit suivante au lever du soleil : l'heure est une
// donnée du calcul, pas une valeur figée à l'ouverture de la page.
const now = ref(new Date());
let ticker: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  ticker = setInterval(() => (now.value = new Date()), 60_000);
});
onUnmounted(() => {
  if (ticker) clearInterval(ticker);
});

const range = computed(() => slihotWindow(place.value, now.value));
const clock = (date: Date) => formatZmanTime(date, place.value.tzid, locale.value);
const startTime = computed(() => (range.value ? clock(range.value.start) : ""));
const endTime = computed(() => (range.value ? clock(range.value.end) : ""));

/**
 * La chkia du jour où la plage se referme : à défaut d'avoir pu les dire la
 * nuit, c'est jusque-là qu'on les rattrape. Nulle aux latitudes extrêmes, où
 * le jour n'a pas de coucher de soleil : la ligne disparaît alors.
 */
const sunsetTime = computed(() => {
  if (!range.value) return "";
  const chkia = getSunset(place.value, range.value.end);
  return chkia ? clock(chkia) : "";
});

const showInfo = ref(false);
</script>

<template>
  <div v-if="range" class="mb-6 card p-4">
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
    <div v-if="showInfo" class="mt-3 text-sm text-text-secondary leading-relaxed">
      <p>{{ t("textReading.slihotWindowExplained") }}</p>
      <ul class="mt-2 space-y-1.5 list-disc ps-5">
        <li>{{ t("textReading.slihotWindowNight", { start: startTime }) }}</li>
        <li>{{ t("textReading.slihotWindowDawn", { end: endTime }) }}</li>
        <li v-if="sunsetTime">
          {{ t("textReading.slihotWindowDay", { sunset: sunsetTime }) }}
        </li>
      </ul>
      <p v-if="place.city" class="mt-2 text-text-secondary/70">
        {{ t("textReading.slihotWindowPlace", { city: place.city }) }}
      </p>
    </div>
  </div>
</template>
