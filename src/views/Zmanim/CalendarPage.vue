<script setup lang="ts">
// Page « Calendrier des fêtes » : une année hébraïque de fêtes et de jeûnes,
// avec leurs dates et, pour celles où le travail est interdit, l'heure
// d'entrée et l'heure de sortie.
//
// Comme la page des horaires, tout est calculé sur l'appareil (voir
// zmanimService) : les flèches parcourent les années sans rien charger, et la
// page continue de servir sans connexion.
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { localeMessagesReady } from "../../i18n";
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
import { findFestivalBySlug, type SeoFestival } from "../../content/zmanimFestivals";
import { isSectionPath, localeOfPath, sectionPath, type SeoLocale } from "../../content/seoLocales";
import AppIcon from "../../components/icons/AppIcon.vue";
import { useLocalePath } from "../../composables/useLocalePath";

/** Les pages traduites suivent l'espace de langue de l'URL ouverte. */
const { localePath } = useLocalePath();

const { t, locale } = useI18n();
const { place } = useZmanimLocation();
const placeLabel = useZmanimPlaceLabel(place);

const now = ref(new Date());
const todayHd = computed(() => hebrewDayOf(place.value, now.value));
const today = computed(() => todayHd.value.abs());

/**
 * L'année courante et ses fêtes. Le calcul est le plus lourd de la page (tout
 * le calendrier hébraïque de l'année, plus une entrée et une sortie par Yom
 * Tov) : il ne se fait qu'une fois, et sert à la fois à choisir l'année qui
 * s'ouvre et à la rendre.
 */
const currentYear = computed(() => todayHd.value.getFullYear());
const currentEntries = computed(() => yearCalendar(place.value, currentYear.value, locale.value));

/**
 * L'année ouverte : celle où l'on est, sauf dans les derniers jours d'Eloul,
 * où toutes ses fêtes sont passées. On ouvre alors sur la suivante : la page
 * sert à voir ce qui vient.
 */
const openingYear = computed(() =>
  currentEntries.value.some((entry) => entry.last.abs() >= today.value)
    ? currentYear.value
    : currentYear.value + 1,
);

/** Décalage en années par rapport à celle qui s'ouvre. */
const yearOffset = ref(0);
const year = computed(() => openingYear.value + yearOffset.value);

const entries = computed(() =>
  year.value === currentYear.value
    ? currentEntries.value
    : yearCalendar(place.value, year.value, locale.value),
);

/**
 * La première fête qui n'est pas encore passée : celle qu'on cherche du
 * regard. Elle n'a de sens que sur l'année qui s'ouvre : dans une année à
 * venir, tout est « pas encore passé », et la première entrée n'est pas pour
 * autant la prochaine fête.
 */
const nextKey = computed(() =>
  year.value === openingYear.value
    ? (entries.value.find((entry) => entry.last.abs() >= today.value)?.key ?? null)
    : null,
);
const isPast = (entry: CalendarEntry) => entry.last.abs() < today.value;

/** « Chabbat Roch Hachana » : le Chabbat qui prolonge une fête est du même bloc. */
function title(entry: CalendarEntry): string {
  if (!entry.period?.shabbat) return entry.name;
  return `${t("zmanim.shabbat.title")} ${entry.name}`;
}

const clock = (date: Date) => formatZmanTime(date, place.value.tzid, locale.value);

/** « jeudi 22 avril 2027 », ou « du jeudi 22 au vendredi 23 avril 2027 ». */
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
  return t("calendar.range", { from: short.format(from), to: long.format(to) });
}

/** « 15 Nissan 5787 », ou « du 15 au 16 Nissan 5787 » sur plusieurs jours. */
function hebrewRange(entry: CalendarEntry): string {
  const last = formatHebrewDate(entry.last, locale.value);
  if (entry.first.abs() === entry.last.abs()) return last;
  return t("calendar.range", { from: formatHebrewDate(entry.first, locale.value), to: last });
}

/** Racine de la page : cible du dévoilement circulaire (bouton rond natif). */
const root = ref<HTMLElement | null>(null);

// ---- /calendrier/:fete : la page d'une fête ------------------------------
//
// Même page, ouverte sur une fête : l'année affichée devient celle de sa
// prochaine occurrence, et son cadre est mis en avant. Les crawlers, eux,
// reçoivent une page prérendue qui porte ses dates sur plusieurs années
// (voir src/content/zmanimSeoPages.ts).

const route = useRoute();
const router = useRouter();

/** La fête demandée par l'URL, ou null sur /calendrier. */
const festival = ref<SeoFestival | null>(null);

/** hebcal-fr écrit « H̲anoukah » : la marque diacritique ne compte pas. */
const cleanName = (name: string): string => name.replace(/[\u0331\u0332]/g, "");

/** L'entrée mise en avant : la prochaine occurrence de la fête demandée. */
const festivalKey = computed(() => {
  const wanted = festival.value;
  if (!wanted) return null;
  const found = entries.value.find(
    (entry) =>
      cleanName(entry.name) === wanted.names[calendarLocale.value] &&
      entry.last.abs() >= today.value,
  );
  return found?.key ?? null;
});

/**
 * La langue dans laquelle le calendrier est calculé : celle de l'interface,
 * ramenée aux trois langues du site. C'est elle qui nomme les fêtes, donc elle
 * qui sert à reconnaître celle de l'URL.
 */
const calendarLocale = computed<SeoLocale>(() => {
  const code = locale.value as string;
  return code === "en" || code === "he" ? code : "fr";
});

/** Le titre et le canonique : /calendrier, ou /calendrier/<fete>. */
function applyMeta(): void {
  const wanted = festival.value;
  // Chaque fête a une adresse par langue : le canonique suit celle de la page
  // ouverte, et le nom affiché suit la langue de l'interface.
  const pathLocale = localeOfPath(route.path);
  const url = `${SITE_URL}${
    wanted
      ? sectionPath("calendrier", pathLocale, wanted.slugs[pathLocale])
      : sectionPath("calendrier", pathLocale)
  }`;
  const label = wanted?.labels[calendarLocale.value] ?? "";
  seoService.setMeta({
    title: wanted ? t("seo.festivalTitle", { festival: label }) : t("seo.calendarTitle"),
    description: wanted
      ? t("seo.festivalDescription", { festival: label })
      : t("seo.calendarDescription"),
    canonical: url,
    og: { url },
  });
}

/**
 * Applique la fête de l'URL : on avance d'année en année jusqu'à celle qui la
 * porte (jamais plus d'une, une fête tombant une fois par an, mais l'année en
 * cours peut l'avoir déjà passée), puis on amène son cadre à l'écran. Un slug
 * inconnu ramène au calendrier plutôt que d'afficher une page vide.
 */
async function applyRouteFestival(): Promise<void> {
  const raw = route.params.fete;
  const slug = typeof raw === "string" ? raw.toLowerCase() : "";
  if (!slug) {
    festival.value = null;
    applyMeta();
    return;
  }
  const found = findFestivalBySlug(slug);
  if (!found) {
    void router.replace(sectionPath("calendrier", localeOfPath(route.path)));
    return;
  }
  // Slug d'une autre langue (le sélecteur de langue traduit la section, pas
  // le slug de la fête) : on rétablit l'adresse canonique de cet espace, pour
  // que l'URL partagée soit celle que le prérendu et les hreflang déclarent.
  const pathLocale = localeOfPath(route.path);
  if (slug !== found.slugs[pathLocale]) {
    void router.replace(sectionPath("calendrier", pathLocale, found.slugs[pathLocale]));
    return;
  }
  festival.value = found;
  yearOffset.value = 0;
  for (let step = 0; step < 2 && !festivalKey.value; step++) yearOffset.value += 1;
  applyMeta();
  await nextTick();
  const key = festivalKey.value;
  if (!key) return;
  root.value
    ?.querySelector(`[data-entry="${CSS.escape(key)}"]`)
    ?.scrollIntoView({ block: "center" });
}

watch(
  () => route.params.fete,
  () => {
    if (isSectionPath(route.path, "calendrier")) void applyRouteFestival();
  },
);

// Les messages en et he arrivent par import dynamique : le titre se repose
// quand ils sont là.
watch([locale, localeMessagesReady], applyMeta);

onMounted(() => {
  revealFromOrigin(root.value);
  void applyRouteFestival();
  analyticsService.capture("calendar_viewed", { festival: festival.value?.slugs.fr ?? null });
});
</script>

<template>
  <main ref="root" class="flex-1 mx-auto w-full max-w-3xl px-6 py-10">
    <RouterLink :to="localePath('horaires')" class="back-link mb-6">
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
        :data-entry="entry.key"
        class="card p-4"
        :class="[
          isPast(entry) ? 'opacity-55' : '',
          entry.key === nextKey || entry.key === festivalKey
            ? 'border border-primary/30 bg-primary/5'
            : '',
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
