<script setup lang="ts">
// Page « Horaires du jour » : les zmanim d'un jour, groupés par moment de la
// journée, plus l'entrée et la sortie du Chabbat.
//
// Rien n'est chargé depuis le réseau : les horaires se calculent sur
// l'appareil (voir zmanimService), y compris pour les jours qu'on parcourt
// avec les flèches. Une fois la page ouverte, elle continue donc de servir
// sans connexion — et dans l'app native, dont les fichiers sont embarqués,
// elle s'ouvre aussi hors ligne. Le site web, lui, n'a pas de service
// worker : là, il faut le réseau pour charger la page (mais pas après).
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { analyticsService } from "../../services/analyticsService";
import { seoService } from "../../services/seoService";
import { SITE_URL } from "../../config/site";
import { isNativeApp } from "../../composables/useNativeApp";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { getParashaForShabbat } from "../../services/dailyCycles";
import {
  computeZmanim,
  formatHebrewDate,
  formatZmanTime,
  getShabbatTimes,
  hebrewDateFor,
  featuredShabbat,
  type City,
  nextZman,
  ZMAN_PERIODS,
  type ZmanPeriod,
  type ZmanTime,
} from "../../services/zmanimService";
import { revealFromOrigin } from "../../composables/useRevealOrigin";
import ShabbatTimes from "./ShabbatTimes.vue";

// Chargé à la demande : le sélecteur embarque la liste des villes, inutile
// tant qu'on ne l'ouvre pas.
const CityPicker = defineAsyncComponent(() => import("./CityPicker.vue"));
import AppIcon from "../../components/icons/AppIcon.vue";

const { t, locale } = useI18n();
const { place, status, useDevicePlace, useCity } = useZmanimLocation();

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
// Le Chabbat suit le jour affiché : parcourir le calendrier avec les flèches
// doit montrer le Chabbat de cette semaine-là, pas toujours celui d'à côté.
const shabbat = computed(() => getShabbatTimes(place.value, day.value));

/**
 * Vendredi et samedi, le Chabbat passe devant les horaires du jour : c'est ce
 * qu'on vient vérifier ces jours-là. Le samedi soir, une fois sorti, il
 * retrouve sa place en bas.
 */
const shabbatFirst = computed(() => featuredShabbat(place.value, day.value) !== null);

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

const pickerOpen = ref(false);

function chooseCity(city: City) {
  useCity(city);
  analyticsService.capture("zmanim_city_chosen", { city: city.name, country: city.country });
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
        type="button"
        class="flex items-center gap-1.5 text-text-secondary hover:text-primary hover:underline"
        @click="pickerOpen = true"
      >
        <AppIcon name="search" :size="14" />
        {{ t("zmanim.place.chooseCity") }}
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
            : t(isNativeApp ? "zmanim.descriptionOffline" : "zmanim.description")
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

    <!-- Le prochain horaire, mis en avant. Pas d'intitulé : une heure isolée
         au-dessus de la liste, en couleur, ne peut être que celle-là. -->
    <div
      v-if="upcoming"
      class="card mt-4 flex items-center justify-between gap-3 bg-primary/5 p-4 dark:bg-primary/10"
    >
      <span class="min-w-0 font-medium leading-snug text-text-primary">
        {{ t(`zmanim.names.${upcoming.key}`) }}
      </span>
      <span class="shrink-0 text-xl font-semibold tabular-nums text-primary">
        {{ clock(upcoming.date) }}
      </span>
    </div>

    <p v-if="times.length === 0" class="mt-6 text-text-secondary">{{ t("zmanim.unavailable") }}</p>

    <!-- Vendredi : le Chabbat d'abord, c'est ce qu'on vient vérifier -->
    <ShabbatTimes
      v-if="shabbat && shabbatFirst"
      :times="shabbat"
      :parasha="parasha"
      :tzid="place.tzid"
      class="mt-5"
    />

    <!-- Les horaires à la suite : chaque titre ouvre son groupe et sert de
         séparation. Sans cadres, la journée se lit d'un trait — et tient en
         beaucoup moins de défilement. -->
    <section v-for="group in byPeriod" :key="group.period">
      <h2
        class="flex items-center gap-2 border-t border-line pt-4 pb-1 text-sm font-bold uppercase tracking-wide text-text-secondary"
      >
        <AppIcon :name="PERIOD_ICONS[group.period]" :size="15" class="text-primary" />
        {{ t(`zmanim.periods.${group.period}`) }}
      </h2>
      <ul class="flex flex-col divide-y divide-line">
        <li
          v-for="zman in group.zmanim"
          :key="zman.key"
          class="flex items-center justify-between gap-4 py-2"
        >
          <span class="min-w-0">
            <span
              class="block font-medium leading-snug"
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

    <ShabbatTimes
      v-if="shabbat && !shabbatFirst"
      :times="shabbat"
      :parasha="parasha"
      :tzid="place.tzid"
    />

    <p class="mt-5 border-t border-line pt-3 text-xs text-text-secondary leading-relaxed">
      {{ t("zmanim.disclaimer") }}
    </p>

    <CityPicker v-model:show="pickerOpen" :current="place.city" @select="chooseCity" />
  </main>
</template>
