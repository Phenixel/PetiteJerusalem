<script setup lang="ts">
// Page « Horaires du jour » : les zmanim d'un jour, groupés par moment de la
// journée, plus l'entrée et la sortie du Chabbat.
//
// Rien n'est chargé depuis le réseau : les horaires se calculent sur
// l'appareil (voir zmanimService), y compris pour les jours qu'on parcourt
// avec les flèches. La page reste donc utilisable hors ligne.
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { analyticsService } from "../../services/analyticsService";
import { seoService } from "../../services/seoService";
import { SITE_URL } from "../../config/site";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { getParashaForShabbat } from "../../services/dailyCycles";
import { hubPath } from "../../content/etudeTexts";
import {
  computeZmanim,
  formatHebrewDate,
  formatZmanDay,
  formatZmanTime,
  getShabbatTimes,
  hebrewDateFor,
  nextZman,
  ZMAN_PERIODS,
  type ZmanPeriod,
  type ZmanTime,
} from "../../services/zmanimService";
import { revealFromOrigin } from "../../composables/useRevealOrigin";
import AppIcon from "../../components/icons/AppIcon.vue";

const { t, locale } = useI18n();
const { place, status, useDevicePlace, useDefaultPlace } = useZmanimLocation();

const now = ref(new Date());
let ticker: ReturnType<typeof setInterval> | null = null;

/** Décalage en jours par rapport à aujourd'hui (flèches de navigation). */
const dayOffset = ref(0);

const day = computed(() => {
  const date = new Date(now.value);
  date.setDate(date.getDate() + dayOffset.value);
  return date;
});
const isToday = computed(() => dayOffset.value === 0);

const times = computed(() => computeZmanim(place.value, day.value));
const upcoming = computed(() => (isToday.value ? nextZman(times.value, now.value) : null));
const shabbat = computed(() => getShabbatTimes(place.value, now.value));

/**
 * La paracha de ce Chabbat-là — celui dont les horaires sont affichés, et non
 * celui d'aujourd'hui : le samedi soir après la sortie, le bloc montre déjà
 * le Chabbat suivant, sa paracha doit suivre.
 */
const parasha = computed(() =>
  shabbat.value ? getParashaForShabbat(shabbat.value.havdalah) : null,
);

const byPeriod = computed(() =>
  ZMAN_PERIODS.map((period) => ({
    period,
    zmanim: times.value.filter((zman) => zman.period === period),
  })).filter((group) => group.zmanim.length > 0),
);

const PERIOD_ICONS: Record<ZmanPeriod, "sunrise" | "sun" | "clock" | "moon"> = {
  dawn: "sunrise",
  morning: "sun",
  afternoon: "clock",
  evening: "moon",
};

const clock = (date: Date) => formatZmanTime(date, place.value.tzid, locale.value);
const isNext = (zman: ZmanTime) => upcoming.value?.key === zman.key;

const civilDate = computed(() =>
  new Intl.DateTimeFormat(locale.value, {
    timeZone: place.value.tzid,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(day.value),
);
const hebrewDate = computed(() =>
  formatHebrewDate(hebrewDateFor(place.value, day.value, now.value), locale.value),
);

const placeLabel = computed(() => place.value.city ?? t("zmanim.place.device"));
const coordinates = computed(() =>
  place.value.source === "device"
    ? `${place.value.latitude.toFixed(3)}, ${place.value.longitude.toFixed(3)}`
    : null,
);

async function locateMe() {
  const granted = await useDevicePlace();
  analyticsService.capture("zmanim_location_requested", { granted });
}

/** Racine de la page : cible du dévoilement circulaire (bouton rond natif). */
const root = ref<HTMLElement | null>(null);

onMounted(() => {
  revealFromOrigin(root.value);
  ticker = setInterval(() => (now.value = new Date()), 30_000);
  const url = `${SITE_URL}/horaires`;
  seoService.setMeta({
    title: t("seo.zmanimTitle"),
    description: t("seo.zmanimDescription"),
    canonical: url,
    og: { url },
  });
  analyticsService.capture("zmanim_viewed", { place: place.value.source });
});
onUnmounted(() => {
  if (ticker) clearInterval(ticker);
});
</script>

<template>
  <main ref="root" class="flex-1 mx-auto w-full max-w-3xl px-6 py-10">
    <h1 class="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
      {{ t("zmanim.title") }}
    </h1>

    <!-- Lieu de calcul, sur une ligne : le titre et les horaires doivent
         rester en vue, pas être repoussés par un bloc de réglages. -->
    <div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span class="flex items-center gap-1.5 min-w-0">
        <AppIcon name="map-pin" :size="14" class="text-primary shrink-0" />
        <span class="font-medium text-text-primary truncate">{{ placeLabel }}</span>
        <span v-if="coordinates" class="text-xs text-text-secondary tabular-nums shrink-0">
          {{ coordinates }}
        </span>
      </span>
      <button
        type="button"
        class="flex items-center gap-1.5 font-medium text-primary hover:underline disabled:opacity-60"
        :disabled="status === 'loading'"
        @click="locateMe"
      >
        <AppIcon
          :name="status === 'loading' ? 'spinner' : 'locate'"
          :size="14"
          :class="status === 'loading' ? 'animate-spin' : ''"
        />
        {{
          status === "loading"
            ? t("zmanim.place.locating")
            : place.source === "device"
              ? t("zmanim.place.refresh")
              : t("zmanim.place.useMine")
        }}
      </button>
      <button
        v-if="place.source === 'device'"
        type="button"
        class="text-text-secondary hover:underline"
        @click="useDefaultPlace"
      >
        {{ t("zmanim.place.reset") }}
      </button>
    </div>

    <!-- Une seule ligne d'explication : ce que sont ces horaires, et ce qu'il
         advient de la position. Un refus prend sa place, il est plus urgent. -->
    <p class="mt-1.5 text-xs text-text-secondary leading-relaxed">
      {{
        status === "denied"
          ? t("zmanim.place.denied")
          : status === "unavailable"
            ? t("zmanim.place.unavailable")
            : t("zmanim.description")
      }}
    </p>

    <!-- Jour affiché : les flèches parcourent le calendrier sans rien recharger -->
    <div class="mt-6 flex items-center justify-between gap-3">
      <button
        type="button"
        class="icon-btn"
        :aria-label="t('zmanim.previousDay')"
        @click="dayOffset--"
      >
        <AppIcon name="chevron-left" :size="18" class="rtl:rotate-180" />
      </button>
      <div class="text-center min-w-0">
        <p class="font-semibold text-text-primary truncate">{{ civilDate }}</p>
        <p class="text-sm text-text-secondary truncate">{{ hebrewDate }}</p>
      </div>
      <button type="button" class="icon-btn" :aria-label="t('zmanim.nextDay')" @click="dayOffset++">
        <AppIcon name="chevron-right" :size="18" class="rtl:rotate-180" />
      </button>
    </div>
    <div v-if="!isToday" class="mt-2 text-center">
      <button type="button" class="text-sm font-medium text-primary" @click="dayOffset = 0">
        {{ t("zmanim.backToToday") }}
      </button>
    </div>

    <!-- Le prochain horaire du jour, mis en avant -->
    <div
      v-if="upcoming"
      class="card p-4 mt-5 flex items-center justify-between gap-3 bg-primary/5 dark:bg-primary/10"
    >
      <span class="min-w-0">
        <span class="block text-xs uppercase tracking-wide text-text-secondary">
          {{ t("zmanim.next") }}
        </span>
        <span class="block font-medium text-text-primary truncate">
          {{ t(`zmanim.names.${upcoming.key}`) }}
        </span>
      </span>
      <span class="shrink-0 text-xl font-semibold text-primary tabular-nums">
        {{ clock(upcoming.date) }}
      </span>
    </div>

    <p v-if="times.length === 0" class="mt-6 text-text-secondary">{{ t("zmanim.unavailable") }}</p>

    <!-- Les horaires, groupés par moment de la journée -->
    <section v-for="group in byPeriod" :key="group.period" class="card p-5 mt-5">
      <h2 class="font-bold text-text-primary flex items-center gap-2.5 mb-3">
        <AppIcon :name="PERIOD_ICONS[group.period]" :size="17" class="text-primary" />
        {{ t(`zmanim.periods.${group.period}`) }}
      </h2>
      <ul class="flex flex-col divide-y divide-line">
        <li
          v-for="zman in group.zmanim"
          :key="zman.key"
          class="flex items-center justify-between gap-4 py-2.5"
        >
          <span class="min-w-0">
            <span
              class="block font-medium truncate"
              :class="isNext(zman) ? 'text-primary' : 'text-text-primary'"
            >
              {{ t(`zmanim.names.${zman.key}`) }}
            </span>
            <span class="block text-xs text-text-secondary">
              {{ t(`zmanim.hints.${zman.key}`) }}
            </span>
          </span>
          <span
            class="shrink-0 font-semibold tabular-nums"
            :class="isNext(zman) ? 'text-primary' : 'text-text-primary'"
          >
            {{ clock(zman.date) }}
          </span>
        </li>
      </ul>
    </section>

    <!-- Entrée et sortie du Chabbat (celui en cours, sinon le prochain) -->
    <section v-if="shabbat" class="card p-5 mt-5">
      <h2 class="font-bold text-text-primary flex items-center gap-2.5">
        <AppIcon name="flame" :size="17" class="text-primary" />
        {{ t("zmanim.shabbat.title") }}
      </h2>

      <!-- La paracha de ce Chabbat, cliquable pour la lire -->
      <p v-if="parasha" class="mt-1 mb-3 flex flex-wrap items-center gap-x-1.5 text-sm">
        <span class="text-text-secondary">{{ t("zmanim.shabbat.parasha") }}</span>
        <template v-for="(entry, index) in parasha.entries" :key="entry.id">
          <span v-if="index > 0" class="text-text-secondary">·</span>
          <RouterLink :to="hubPath(entry)" class="font-medium text-primary hover:underline">
            {{ entry.name }}
          </RouterLink>
        </template>
      </p>
      <div v-else class="mb-3"></div>
      <ul class="flex flex-col divide-y divide-line">
        <li class="flex items-center justify-between gap-4 py-2.5">
          <span class="min-w-0">
            <span class="block font-medium text-text-primary">
              {{ t("zmanim.shabbat.candleLighting") }}
            </span>
            <span class="block text-xs text-text-secondary">
              {{ formatZmanDay(shabbat.candleLighting, place.tzid, locale) }}
            </span>
          </span>
          <span class="shrink-0 font-semibold text-text-primary tabular-nums">
            {{ clock(shabbat.candleLighting) }}
          </span>
        </li>
        <li class="flex items-center justify-between gap-4 py-2.5">
          <span class="min-w-0">
            <span class="block font-medium text-text-primary">
              {{ t("zmanim.shabbat.havdalah") }}
            </span>
            <span class="block text-xs text-text-secondary">
              {{ formatZmanDay(shabbat.havdalah, place.tzid, locale) }}
            </span>
          </span>
          <span class="shrink-0 font-semibold text-text-primary tabular-nums">
            {{ clock(shabbat.havdalah) }}
          </span>
        </li>
      </ul>
      <p class="mt-3 text-xs text-text-secondary">{{ t("zmanim.shabbat.note") }}</p>
    </section>

    <p class="mt-6 text-xs text-text-secondary leading-relaxed">{{ t("zmanim.disclaimer") }}</p>
  </main>
</template>
