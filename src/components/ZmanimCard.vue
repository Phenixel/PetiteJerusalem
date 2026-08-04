<script setup lang="ts">
// Carte « Horaires du jour » du tableau de bord : le prochain horaire, et les
// deux repères que l'on cherche le plus souvent (fin du Chéma, chkia).
// Tout est calculé sur l'appareil (voir zmanimService) : la carte s'affiche
// aussi vite hors ligne qu'en ligne, sans rien attendre du réseau.
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import {
  computeZmanim,
  formatZmanTime,
  HIGHLIGHT_KEYS,
  nextZman,
  type ZmanTime,
} from "../services/zmanimService";
import AppIcon from "./icons/AppIcon.vue";

const { t, locale } = useI18n();
const { place } = useZmanimLocation();

// L'horaire mis en avant change au fil de la journée : on suit l'heure à la
// minute plutôt que de figer l'état au montage.
const now = ref(new Date());
let ticker: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  ticker = setInterval(() => (now.value = new Date()), 30_000);
});
onUnmounted(() => {
  if (ticker) clearInterval(ticker);
});

const times = computed(() => computeZmanim(place.value, now.value));

/** Après le dernier horaire de la nuit, on enchaîne sur l'aube du lendemain. */
const upcoming = computed<ZmanTime | null>(() => {
  const today = nextZman(times.value, now.value);
  if (today) return today;
  const tomorrow = new Date(now.value);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return computeZmanim(place.value, tomorrow)[0] ?? null;
});

const highlights = computed(() =>
  HIGHLIGHT_KEYS.map((key) => times.value.find((zman) => zman.key === key)).filter(
    (zman): zman is ZmanTime => Boolean(zman),
  ),
);

const clock = (date: Date) => formatZmanTime(date, place.value.tzid, locale.value);

/** « dans 2 h 15 » / « dans 35 min » : le compte à rebours du prochain horaire. */
const countdown = computed(() => {
  if (!upcoming.value) return "";
  const minutes = Math.round((upcoming.value.date.getTime() - now.value.getTime()) / 60_000);
  if (minutes <= 0) return "";
  const duration =
    minutes < 60
      ? t("zmanim.durationM", { m: minutes })
      : t("zmanim.durationHM", { h: Math.floor(minutes / 60), m: minutes % 60 });
  return t("zmanim.nextIn", { duration });
});

const placeLabel = computed(() => place.value.city ?? t("zmanim.place.device"));
</script>

<template>
  <RouterLink to="/horaires" class="card card-hover p-6 block group">
    <div class="flex items-center justify-between gap-3 mb-4">
      <h3
        class="font-bold text-text-primary flex items-center gap-2.5 group-hover:text-primary transition-colors"
      >
        <AppIcon name="clock" :size="17" class="text-primary" />
        {{ t("zmanim.title") }}
      </h3>
      <AppIcon name="chevron-right" :size="15" class="text-text-secondary/50 rtl:rotate-180" />
    </div>

    <!-- Le prochain horaire : ce qu'on vient vérifier en un coup d'œil -->
    <div v-if="upcoming" class="flex items-baseline justify-between gap-3">
      <span class="min-w-0">
        <span class="block text-xs uppercase tracking-wide text-text-secondary">
          {{ t("zmanim.next") }}
        </span>
        <span class="block font-medium text-text-primary truncate">
          {{ t(`zmanim.names.${upcoming.key}`) }}
        </span>
      </span>
      <span class="shrink-0 text-right">
        <span class="block text-xl font-semibold text-primary tabular-nums">
          {{ clock(upcoming.date) }}
        </span>
        <span v-if="countdown" class="block text-xs text-text-secondary">{{ countdown }}</span>
      </span>
    </div>
    <p v-else class="text-sm text-text-secondary leading-relaxed">
      {{ t("zmanim.unavailable") }}
    </p>

    <!-- Les deux repères les plus consultés de la journée -->
    <ul v-if="highlights.length" class="mt-4 flex flex-col divide-y divide-line">
      <li
        v-for="zman in highlights"
        :key="zman.key"
        class="flex items-center justify-between gap-3 py-1.5 text-sm"
      >
        <span class="min-w-0 truncate text-text-secondary">
          {{ t(`zmanim.names.${zman.key}`) }}
        </span>
        <span class="shrink-0 font-medium text-text-primary tabular-nums">
          {{ clock(zman.date) }}
        </span>
      </li>
    </ul>

    <p class="mt-4 text-sm font-medium text-primary flex items-center gap-1.5">
      <AppIcon name="map-pin" :size="13" />
      {{ placeLabel }}
    </p>
  </RouterLink>
</template>
