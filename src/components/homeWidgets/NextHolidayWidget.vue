<script setup lang="ts">
/**
 * Widget « Prochaine fête » : la prochaine entrée du calendrier (une fête, un
 * bloc de Yom Tov, un jeûne), ses dates, et dans combien de jours. Il mène au
 * calendrier de l'année.
 *
 * Le compte des jours se fait sur le jour CIVIL, comme le bandeau des dates
 * personnelles (OccasionsBanner) : « demain » veut dire demain, et non ce soir
 * parce que le jour hébraïque a basculé à la chkia. Une fête en cours
 * (Pessah, 'Hanouka) reste affichée jusqu'à son dernier jour.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { useNow } from "../../composables/useNow";
import { useLocalePath } from "../../composables/useLocalePath";
import {
  formatHebrewDate,
  formatHebrewRangeStart,
  hebrewDayOf,
  yearCalendar,
} from "../../services/zmanimService";
import AppIcon from "../icons/AppIcon.vue";

const { t, locale } = useI18n();
const { place } = useZmanimLocation();
const { localePath } = useLocalePath();
// Horloge partagée entre les cartes de l'accueil (un seul setInterval).
const now = useNow();

const today = computed(() => hebrewDayOf(place.value, now.value));

/** La première entrée qui n'est pas finie, cette année ou la suivante. */
const next = computed(() => {
  const todayAbs = today.value.abs();
  const year = today.value.getFullYear();
  for (const y of [year, year + 1]) {
    const entry = yearCalendar(place.value, y, locale.value).find((e) => e.last.abs() >= todayAbs);
    if (entry) return entry;
  }
  return null;
});

/** Jours avant le premier jour ; 0 quand la fête a commencé. */
const inDays = computed(() =>
  next.value ? Math.max(0, next.value.first.abs() - today.value.abs()) : 0,
);

/** « du 15 au 22 Nissan 5786 », écrit comme sur le calendrier. */
const dates = computed(() => {
  const entry = next.value;
  if (!entry) return "";
  const last = formatHebrewDate(entry.last, locale.value);
  if (entry.first.abs() === entry.last.abs()) return last;
  const from = formatHebrewRangeStart(entry.first, entry.last, locale.value);
  return t("calendar.range", { from, to: last });
});

/** Aujourd'hui et demain se disent en mots ; au-delà, le nombre de jours parle. */
const when = computed(() => {
  if (inDays.value === 0) return t("occasions.when.today");
  if (inDays.value === 1) return t("occasions.when.tomorrow");
  return "";
});
</script>

<template>
  <RouterLink
    v-if="next"
    :to="localePath('calendrier')"
    class="card card-hover p-5 md:p-6 block group"
  >
    <div class="flex items-center justify-between gap-4">
      <div class="min-w-0">
        <h3
          class="font-semibold text-text-primary flex items-center gap-2.5 group-hover:text-primary transition-colors"
        >
          <AppIcon name="candle" :size="17" class="shrink-0 text-primary" />
          {{ t("home.widgets.catalog.next_holiday.name") }}
        </h3>
        <p class="mt-2 text-lg font-medium leading-snug text-text-primary">{{ next.name }}</p>
        <p class="mt-0.5 text-sm text-text-secondary">{{ dates }}</p>
        <p v-if="when" class="mt-1 text-sm font-medium text-primary">{{ when }}</p>
      </div>
      <span
        v-if="inDays > 1"
        class="shrink-0 text-4xl md:text-5xl font-bold leading-none tabular-nums text-primary"
      >
        {{ inDays
        }}<span class="ms-1 text-base md:text-lg font-semibold">{{
          t("home.widgets.nextHoliday.days", inDays)
        }}</span>
      </span>
    </div>
  </RouterLink>
</template>
