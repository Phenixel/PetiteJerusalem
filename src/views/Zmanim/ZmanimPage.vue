<script setup lang="ts">
// Page « Horaires du jour » : les zmanim d'un jour, groupés par moment de la
// journée, plus l'entrée et la sortie du Chabbat.
//
// Rien n'est chargé depuis le réseau : les horaires se calculent sur
// l'appareil (voir zmanimService), y compris pour les jours qu'on parcourt
// avec les flèches. Une fois la page ouverte, elle continue donc de servir
// sans connexion, et dans l'app native, dont les fichiers sont embarqués,
// elle s'ouvre aussi hors ligne. Le site web, lui, n'a pas de service
// worker : là, il faut le réseau pour charger la page (mais pas après).
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { localeMessagesReady } from "../../i18n";
import { analyticsService } from "../../services/analyticsService";
import { seoService } from "../../services/seoService";
import { SITE_URL } from "../../config/site";
import { isNativeApp } from "../../composables/useNativeApp";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { useZmanimPlaceLabel } from "../../composables/useZmanimPlaceLabel";
import { useZmanCountdown } from "../../composables/useZmanCountdown";
import { getParashaForShabbat } from "../../services/dailyCycles";
import {
  candleLightingMinutes,
  computeZmanim,
  dayHighlights,
  festivalsOn,
  formatHebrewDate,
  formatZmanTime,
  hebrewDayOf,
  restPeriodsNear,
  sameCivilDay,
  tachanunStatus,
  type City,
  nextZman,
  ZMAN_PERIODS,
  type ZmanPeriod,
  type ZmanTime,
} from "../../services/zmanimService";
import { revealFromOrigin } from "../../composables/useRevealOrigin";
import { cityInSentence, citySlug, findCityBySlug } from "../../content/zmanimCities";
import { isSectionPath, localeOfPath, sectionPath } from "../../content/seoLocales";
import RestTimes from "./RestTimes.vue";

// Chargé à la demande : le sélecteur embarque la liste des villes, inutile
// tant qu'on ne l'ouvre pas.
const CityPicker = defineAsyncComponent(() => import("./CityPicker.vue"));
import AppIcon from "../../components/icons/AppIcon.vue";
import { useLocalePath } from "../../composables/useLocalePath";

/** Les pages traduites suivent l'espace de langue de l'URL ouverte. */
const { localePath } = useLocalePath();

const { t, locale } = useI18n();
const { place, status, locateDevice, selectCity, ensureNearby } = useZmanimLocation();

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

/**
 * Les temps de repos qui suivent le jour affiché : le Chabbat, un Yom Tov, ou
 * les deux d'un coup quand ils se touchent. Parcourir le calendrier avec les
 * flèches doit montrer ceux de cette semaine-là, pas toujours ceux d'à côté.
 */
const restPeriods = computed(() => restPeriodsNear(place.value, day.value, locale.value));

/** 18 minutes avant la chkia, 40 à Jérusalem : la note le dit au lieu affiché. */
const candleMinutes = computed(() => candleLightingMinutes(place.value));

/**
 * Le repos passe devant les horaires du jour le jour où il entre et tant qu'il
 * dure : le vendredi, l'heure d'allumage est ce qu'on vient vérifier. Les
 * autres jours, il garde sa place en bas de la page.
 */
const restFirst = computed(() => {
  const period = restPeriods.value[0];
  if (!period) return false;
  return (
    period.start.getTime() <= day.value.getTime() ||
    sameCivilDay(place.value, period.start, day.value)
  );
});

/**
 * La paracha du Chabbat couvert par un bloc, celui dont les horaires sont
 * affichés, et non celui d'aujourd'hui : le samedi soir après la sortie, le
 * bloc montre déjà le Chabbat suivant, sa paracha doit suivre.
 */
const parashaOf = (shabbat: Date | null) => (shabbat ? getParashaForShabbat(shabbat) : null);

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

// « dans 2 h 15 » sous le prochain horaire, comme sur la carte de l'accueil :
// l'heure dit quand, le décompte dit s'il faut se presser.
const countdown = useZmanCountdown();
const timeLeft = computed(() => (upcoming.value ? countdown(upcoming.value.date, now.value) : ""));

const civilDate = computed(() =>
  new Intl.DateTimeFormat(locale.value, {
    timeZone: place.value.tzid,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(day.value),
);
/**
 * La date hébraïque de l'en-tête : celle de la JOURNÉE civile affichée, sans
 * bascule à la chkia. Les deux dates de l'en-tête décrivent ainsi toujours le
 * même jour, du matin jusqu'à minuit ; le soir, la bascule est annoncée par
 * une ligne dédiée (nightNote) au lieu de changer la date en silence, ce qui
 * faisait cohabiter deux jours sous la même date civile.
 */
const hebrewDay = computed(() => hebrewDayOf(place.value, day.value));
const hebrewDate = computed(() => formatHebrewDate(hebrewDay.value, locale.value));

/**
 * La nuit tombée, le jour hébraïque suivant a commencé : la ligne du soir le
 * dit explicitement, avec ce que cette nuit ouvre (Roch Hodech, une fête, un
 * jeûne…), pour ne perdre aucune information en ancrant l'en-tête sur la
 * journée civile. Seulement pour aujourd'hui : un jour parcouru avec les
 * flèches se lit comme une journée, pas comme un instant.
 */
const nightNote = computed(() => {
  if (!isToday.value) return null;
  const sunset = times.value.find((zman) => zman.key === "sunset");
  if (!sunset || now.value.getTime() < sunset.date.getTime()) return null;
  const tonight = hebrewDay.value.next();
  const date = formatHebrewDate(tonight, locale.value);
  const names = [
    ...festivalsOn(place.value, tonight, locale.value),
    ...dayHighlights(place.value, tonight, locale.value),
  ];
  return names.length > 0
    ? t("zmanim.nightNoteWith", { date, names: names.join(" · ") })
    : t("zmanim.nightNote", { date });
});

/**
 * Ce que le jour a de particulier : Roch Hodech, 'Hanouka, un jeûne,
 * 'Hol haMoed… Les Yom Tov n'y sont d'ordinaire pas répétés, ils ont leur
 * cadre, avec leurs heures d'entrée et de sortie ; ils reviennent ici quand
 * aucun cadre affiché ne couvre le jour (un jour parcouru avec les flèches
 * dont le repos est déjà sorti à cette heure-là, un lieu sans chkia
 * calculable), plutôt que de laisser une fête sans nom.
 */
const holidays = computed(() => {
  const abs = hebrewDay.value.abs();
  const covered = restPeriods.value.some(
    (period) => period.first.abs() <= abs && abs <= period.last.abs(),
  );
  const festivals = covered ? [] : festivalsOn(place.value, hebrewDay.value, locale.value);
  return [...festivals, ...dayHighlights(place.value, hebrewDay.value, locale.value)];
});
/** Dit-on le tahanoun (null le Chabbat : la question ne s'y pose pas). */
const tachanun = computed(() => tachanunStatus(place.value, hebrewDay.value));

const placeLabel = useZmanimPlaceLabel(place);
// Les coordonnées restent affichées, entre parenthèses : le nom dit où l'on
// est, elles disent avec quelle précision les horaires sont calculés.
const coordinates = computed(() =>
  place.value.source === "device"
    ? `(${place.value.latitude.toFixed(3)}, ${place.value.longitude.toFixed(3)})`
    : null,
);

async function locateMe() {
  const granted = await locateDevice();
  analyticsService.capture("zmanim_location_requested", { granted });
}

const pickerOpen = ref(false);

function chooseCity(city: City) {
  selectCity(city);
  analyticsService.capture("zmanim_city_chosen", { city: city.name, country: city.country });
}

/** Racine de la page : cible du dévoilement circulaire (bouton rond natif). */
const root = ref<HTMLElement | null>(null);

const route = useRoute();
const router = useRouter();

/** La ville de l'URL, gardée pour reposer le titre quand la langue change. */
const routeCity = ref<City | null>(null);

/** Le titre et le canonique de la page : /horaires, ou /horaires/<ville>. */
function setMeta(city: City | null): void {
  // La page a une adresse par langue (/horaires, /en/shabbat-times,
  // /he/zmanei-shabbat) : le canonique suit celle qui est ouverte.
  const pathLocale = localeOfPath(route.path);
  const url = `${SITE_URL}${
    city
      ? sectionPath("horaires", pathLocale, citySlug(city.name))
      : sectionPath("horaires", pathLocale)
  }`;
  // Le catalogue est en français : « Genève », « Jérusalem ». Le titre d'une
  // page anglaise doit écrire Geneva, celui d'une page hébraïque ירושלים. En
  // hébreu, la préposition se colle au nom (avec un maqaf devant un nom
  // latin) : elle voyage donc avec la valeur, pas dans le gabarit.
  const uiLocale = locale.value === "en" || locale.value === "he" ? locale.value : "fr";
  const name = city ? cityInSentence(city.name, uiLocale) : "";
  seoService.setMeta({
    title: city ? t("seo.zmanimCityTitle", { city: name }) : t("seo.zmanimTitle"),
    description: city ? t("seo.zmanimCityDescription", { city: name }) : t("seo.zmanimDescription"),
    canonical: url,
    og: { url },
  });
}

/**
 * Applique la ville de l'URL (/horaires/:ville) : elle devient le lieu de
 * calcul, comme si elle avait été choisie dans le sélecteur. Le catalogue est
 * chargé à la demande, comme pour le sélecteur ; un slug inconnu ramène aux
 * horaires du lieu courant.
 */
async function applyRouteCity(): Promise<void> {
  const raw = route.params.ville;
  const slug = typeof raw === "string" ? raw.toLowerCase() : "";
  if (!slug) {
    routeCity.value = null;
    setMeta(null);
    return;
  }
  const { default: cities } = await import("../../datas/cities.json");
  const city = findCityBySlug(cities as City[], slug);
  if (!city) {
    void router.replace(sectionPath("horaires", localeOfPath(route.path)));
    return;
  }
  routeCity.value = city;
  chooseCity(city);
  setMeta(city);
}

// La même page sert /horaires et /horaires/:ville : passer de l'une à l'autre
// ne remonte pas le composant, on suit donc le paramètre.
watch(
  () => route.params.ville,
  () => {
    // La même page sert six adresses (trois langues, avec et sans ville) :
    // c'est le chemin qui dit si l'on est encore chez elle, pas le nom.
    if (isSectionPath(route.path, "horaires")) void applyRouteCity();
  },
);

// Les messages en et he arrivent par import dynamique : le titre se repose
// quand ils sont là, avec le nom de la ville dans la bonne langue.
watch([locale, localeMessagesReady], () => setMeta(routeCity.value));

onMounted(() => {
  revealFromOrigin(root.value);
  // Position partagée avant que l'app ne sache la nommer : on la nomme ici,
  // sur la page où l'utilisateur regarde son lieu (le catalogue de villes y
  // est de toute façon à un clic, via le choix de ville).
  void ensureNearby();
  ticker = setInterval(() => (now.value = new Date()), 30_000);
  void applyRouteCity();
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
      <RouterLink
        :to="localePath('calendrier')"
        class="flex items-center gap-1.5 text-text-secondary hover:text-primary hover:underline"
      >
        <AppIcon name="calendar" :size="14" />
        {{ t("calendar.link") }}
      </RouterLink>
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
        <!-- La bascule du soir, dite au lieu d'être appliquée en silence -->
        <p
          v-if="nightNote"
          class="mt-0.5 flex items-center justify-center gap-1 text-xs text-primary"
        >
          <AppIcon name="moon" :size="12" class="shrink-0" />
          {{ nightNote }}
        </p>
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

    <!-- Le jour dans le calendrier : Roch Hodech, 'Hanouka, un jeûne… et si
         l'on dit le tahanoun. Un cadre, comme le Chabbat : ce sont des repères
         du jour, pas des étiquettes. Les fêtes déjà portées par le cadre du
         repos (avec leurs heures) n'y sont pas répétées. -->
    <section v-if="holidays.length > 0 || tachanun" class="card mt-4 p-4">
      <p
        v-for="name in holidays"
        :key="name"
        class="flex items-center gap-2 font-medium text-text-primary"
      >
        <AppIcon name="calendar" :size="15" class="shrink-0 text-primary" />
        {{ name }}
      </p>
      <p
        v-if="tachanun"
        class="text-sm text-text-secondary"
        :class="holidays.length > 0 ? 'mt-2' : ''"
      >
        {{ t(`zmanim.tachanun.${tachanun}`) }}
      </p>
    </section>

    <!-- Le prochain horaire, mis en avant. Pas d'intitulé : une heure isolée
         au-dessus de la liste, en couleur, ne peut être que celle-là. -->
    <div
      v-if="upcoming"
      class="card mt-4 flex items-center justify-between gap-3 bg-primary/5 p-4 dark:bg-primary/10"
    >
      <span class="min-w-0">
        <span class="block font-medium leading-snug text-text-primary">
          {{ t(`zmanim.names.${upcoming.key}`) }}
        </span>
        <!-- Le temps qui reste : c'est lui qui dit s'il faut se presser. -->
        <span v-if="timeLeft" class="block text-xs text-text-secondary">{{ timeLeft }}</span>
      </span>
      <span class="shrink-0 text-xl font-semibold tabular-nums text-primary">
        {{ clock(upcoming.date) }}
      </span>
    </div>

    <p v-if="times.length === 0" class="mt-6 text-text-secondary">{{ t("zmanim.unavailable") }}</p>

    <!-- Le repos commencé passe devant : c'est ce qu'on vient vérifier -->
    <RestTimes
      v-for="period in restFirst ? restPeriods : []"
      :key="period.start.getTime()"
      :period="period"
      :parasha="parashaOf(period.shabbat)"
      :tzid="place.tzid"
      :candle-minutes="candleMinutes"
      class="mt-5"
    />

    <!-- Les horaires à la suite : chaque titre ouvre son groupe et sert de
         séparation. Sans cadres, la journée se lit d'un trait, et tient en
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

    <RestTimes
      v-for="period in restFirst ? [] : restPeriods"
      :key="period.start.getTime()"
      :period="period"
      :parasha="parashaOf(period.shabbat)"
      :tzid="place.tzid"
      :candle-minutes="candleMinutes"
      class="mt-5 first:mt-0"
    />

    <p class="mt-5 border-t border-line pt-3 text-xs text-text-secondary leading-relaxed">
      {{ t("zmanim.disclaimer") }}
    </p>

    <CityPicker v-model:show="pickerOpen" :current="place.city" @select="chooseCity" />
  </main>
</template>
