<script setup lang="ts">
/**
 * L'écart d'allumage suivi, sous l'avis des horaires.
 *
 * 18, 20, 30 ou 40 minutes avant la chkia : c'est l'usage d'une communauté et
 * non d'une ville (voir composables/useCandleLighting). La première ligne
 * rend la main au lieu, et dit ce qu'il commande, pour qu'on sache toujours
 * quelle heure on retrouve en ne choisissant rien.
 *
 * Le même sélecteur sert aux deux endroits, comme celui de l'avis : l'onglet
 * Préférences dans l'app, la fenêtre ouverte depuis la page des horaires sur
 * le site.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { CANDLE_LIGHTING_CHOICES, localCandleLightingMinutes } from "../../services/zmanimService";
import { useCandleLighting } from "../../composables/useCandleLighting";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import AppIcon from "../icons/AppIcon.vue";

const { t } = useI18n();
const { minutes, choose } = useCandleLighting();
// Le lieu est partagé par toute l'application (voir useZmanimLocation) : le
// sélecteur n'a pas à se le faire passer, et suit le lieu qui change.
const { place } = useZmanimLocation();

const localMinutes = computed(() => localCandleLightingMinutes(place.value));

/** Les lignes : l'usage du lieu d'abord, puis les quatre écarts. */
const options = computed(() => [
  {
    value: null as number | null,
    label: t("zmanim.candle.local", { minutes: localMinutes.value }),
  },
  ...CANDLE_LIGHTING_CHOICES.map((value) => ({
    value: value as number | null,
    label: t("zmanim.candle.minutes", { minutes: value }),
  })),
]);
</script>

<template>
  <section>
    <h3 class="mb-1 font-semibold text-text-primary">{{ t("zmanim.candle.title") }}</h3>
    <p class="mb-2 text-sm text-text-secondary leading-relaxed">
      {{ t("zmanim.candle.description") }}
    </p>

    <ul class="flex flex-col divide-y divide-line">
      <li v-for="option in options" :key="option.value ?? 'local'">
        <button
          type="button"
          class="flex w-full items-center gap-3 py-2.5 text-start transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
          :aria-pressed="minutes === option.value"
          @click="choose(option.value)"
        >
          <AppIcon
            name="check"
            :size="16"
            class="shrink-0"
            :class="minutes === option.value ? 'text-primary' : 'opacity-0'"
          />
          <span class="min-w-0 text-text-primary">{{ option.label }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>
