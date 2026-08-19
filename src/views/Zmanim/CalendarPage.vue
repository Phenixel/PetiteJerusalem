<script setup lang="ts">
// Page « Calendrier des fêtes » : une année hébraïque de fêtes et de jeûnes,
// avec leurs dates et, pour celles où le travail est interdit, l'heure
// d'entrée et l'heure de sortie.
//
// Comme la page des horaires, tout est calculé sur l'appareil (voir
// zmanimService) : les flèches parcourent les années sans rien charger, et la
// page continue de servir sans connexion.
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { analyticsService } from "../../services/analyticsService";
import { seoService } from "../../services/seoService";
import { SITE_URL } from "../../config/site";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { useZmanimPlaceLabel } from "../../composables/useZmanimPlaceLabel";
import {
  formatHebrewDate,
  formatZmanTime,
  hebrewDayOf,
  yearCalendar,
  type CalendarEntry,
} from "../../services/zmanimService";
import { revealFromOrigin } from "../../composables/useRevealOrigin";
import AppIcon from "../../components/icons/AppIcon.vue";

const { t, locale } = useI18n();
const { place } = useZmanimLocation();
const placeLabel = useZmanimPlaceLabel(place);

const now = ref(new Date());
const today = computed(() => hebrewDayOf(place.value, now.value).abs());

/**
 * L'année ouverte : celle où l'on est — sauf dans les derniers jours d'Eloul,
 * où toutes ses fêtes sont passées. On ouvre alors sur la suivante : la page
 * sert à voir ce qui vient.
 */
const openingYear = computed(() => {
  const current = hebrewDayOf(place.value, now.value).getFullYear();
  const entries = yearCalendar(place.value, current, locale.value);
  return entries.some((entry) => entry.last.abs() >= today.value) ? current : current + 1;
});

/** Décalage en années par rapport à celle qui s'ouvre. */
const yearOffset = ref(0);
const year = computed(() => openingYear.value + yearOffset.value);

const entries = computed(() => yearCalendar(place.value, year.value, locale.value));

/** La première fête qui n'est pas encore passée : celle qu'on cherche du regard. */
const nextKey = computed(
  () => entries.value.find((entry) => entry.last.abs() >= today.value)?.key ?? null,
);
const isPast = (entry: CalendarEntry) => entry.last.abs() < today.value;

/** « Chabbat Roch Hachana » : le Chabbat qui prolonge une fête est du même bloc. */
function title(entry: CalendarEntry): string {
  if (!entry.period?.shabbat) return entry.name;
  return `${t("zmanim.shabbat.title")} ${entry.name}`;
}

const clock = (date: Date) => formatZmanTime(date, place.value.tzid, locale.value);

/** « jeudi 22 avril 2027 », ou « jeudi 22 – vendredi 23 avril 2027 » sur deux jours. */
function civilRange(entry: CalendarEntry): string {
  const from = entry.first.greg();
  const to = entry.last.greg();
  const long = new Intl.DateTimeFormat(locale.value, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (entry.first.abs() === entry.last.abs()) return long.format(from);
  const short = new Intl.DateTimeFormat(locale.value, { weekday: "long", day: "numeric" });
  return `${short.format(from)} – ${long.format(to)}`;
}

/** « 15 Nissan 5787 », ou « 15 – 16 Nissan 5787 » sur plusieurs jours. */
function hebrewRange(entry: CalendarEntry): string {
  const last = formatHebrewDate(entry.last, locale.value);
  if (entry.first.abs() === entry.last.abs()) return last;
  return `${formatHebrewDate(entry.first, locale.value)} – ${last}`;
}

/** Racine de la page : cible du dévoilement circulaire (bouton rond natif). */
const root = ref<HTMLElement | null>(null);

onMounted(() => {
  revealFromOrigin(root.value);
  const url = `${SITE_URL}/calendrier`;
  seoService.setMeta({
    title: t("seo.calendarTitle"),
    description: t("seo.calendarDescription"),
    canonical: url,
    og: { url },
  });
  analyticsService.capture("calendar_viewed");
});
</script>

<template>
  <main ref="root" class="flex-1 mx-auto w-full max-w-3xl px-6 py-10">
    <RouterLink to="/horaires" class="back-link mb-6">
      <AppIcon name="chevron-left" :size="14" />
      {{ t("zmanim.navTitle") }}
    </RouterLink>

    <h1 class="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
      {{ t("calendar.title") }}
    </h1>
    <p class="mt-1.5 flex items-center gap-1.5 text-sm">
      <AppIcon name="map-pin" :size="14" class="text-primary shrink-0" />
      <span class="font-medium text-text-primary truncate">{{ placeLabel }}</span>
    </p>
    <p class="mt-1.5 text-xs text-text-secondary leading-relaxed">
      {{ t("calendar.description") }}
    </p>

    <!-- Année affichée : les flèches parcourent le calendrier sans rien recharger -->
    <div class="mt-6 flex items-center justify-between gap-3">
      <button
        type="button"
        class="icon-btn"
        :aria-label="t('calendar.previousYear')"
        @click="yearOffset--"
      >
        <AppIcon name="chevron-left" :size="18" class="rtl:rotate-180" />
      </button>
      <p class="font-semibold text-text-primary">{{ t("calendar.year", { year }) }}</p>
      <button
        type="button"
        class="icon-btn"
        :aria-label="t('calendar.nextYear')"
        @click="yearOffset++"
      >
        <AppIcon name="chevron-right" :size="18" class="rtl:rotate-180" />
      </button>
    </div>
    <div v-if="yearOffset !== 0" class="mt-2 text-center">
      <button type="button" class="text-sm font-medium text-primary" @click="yearOffset = 0">
        {{ t("calendar.backToCurrent") }}
      </button>
    </div>

    <!-- Les fêtes à la suite. Celles qui sont passées s'effacent, la prochaine
         se distingue : c'est elle qu'on vient chercher. -->
    <ul class="mt-6 flex flex-col gap-3">
      <li
        v-for="entry in entries"
        :key="entry.key"
        class="card p-4"
        :class="[
          isPast(entry) ? 'opacity-55' : '',
          entry.key === nextKey ? 'border border-primary/30 bg-primary/5' : '',
        ]"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="font-semibold text-text-primary">{{ title(entry) }}</p>
            <p class="text-sm text-text-secondary">{{ civilRange(entry) }}</p>
            <p class="text-xs text-text-secondary/80">{{ hebrewRange(entry) }}</p>
          </div>
          <dl v-if="entry.period" class="shrink-0 text-end text-sm">
            <div class="flex items-baseline justify-end gap-2">
              <dt class="text-xs text-text-secondary">{{ t("calendar.start") }}</dt>
              <dd class="font-semibold tabular-nums text-text-primary">
                {{ clock(entry.period.start) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-end gap-2">
              <dt class="text-xs text-text-secondary">{{ t("calendar.end") }}</dt>
              <dd class="font-semibold tabular-nums text-text-primary">
                {{ clock(entry.period.end) }}
              </dd>
            </div>
          </dl>
        </div>
      </li>
    </ul>

    <p class="mt-5 border-t border-line pt-3 text-xs text-text-secondary leading-relaxed">
      {{ t("zmanim.disclaimer") }}
    </p>
  </main>
</template>
