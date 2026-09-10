<script setup lang="ts">
// Page « Calendrier des fêtes » : une année hébraïque de fêtes et de jeûnes,
// avec leurs dates et, pour celles où le travail est interdit, l'heure
// d'entrée et l'heure de sortie.
//
// Comme la page des horaires, tout est calculé sur l'appareil (voir
// zmanimService) : les flèches parcourent les années sans rien charger, et la
// page continue de servir sans connexion.
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { HDate } from "@hebcal/core";
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
import { useHebrewOccasions } from "../../composables/useHebrewOccasions";
import {
  occasionDateIn,
  type HebrewOccasion,
  type OccasionKind,
} from "../../services/hebrewOccasions";
import OccasionsModal from "./OccasionsModal.vue";
import type { IconName } from "../../components/icons/registry";
import { revealFromOrigin } from "../../composables/useRevealOrigin";
import { dateTimeFormat } from "../../services/intlCache";
import { findFestivalBySlug, type SeoFestival } from "../../content/zmanimFestivals";
import { isSectionPath, localeOfPath, sectionPath, type SeoLocale } from "../../content/seoLocales";
import AppIcon from "../../components/icons/AppIcon.vue";
import PageTabs from "../../components/PageTabs.vue";
import { zmanimTabs } from "../../config/pageTabs";
import { isNativeApp } from "../../composables/useNativeApp";
import { useLocalePath } from "../../composables/useLocalePath";

/** Les pages traduites suivent l'espace de langue de l'URL ouverte. */
const { localePath } = useLocalePath();

/** Les deux onglets de l'app : les horaires du jour, le calendrier de l'année. */
const tabs = computed(() => zmanimTabs(localePath));

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
 * Les dates personnelles de l'année affichée, mêlées aux fêtes.
 *
 * Elles ne viennent pas du calendrier hébraïque mais de l'appareil (voir
 * useHebrewOccasions) : un anniversaire, un leilouy nichmat. Elles se lisent
 * au même endroit que les fêtes, parce que c'est la même question, « qu'est-ce
 * qui vient cette année ». L'app native seule les propose : le rappel est
 * programmé par le téléphone, et rien ne les porterait d'un appareil à
 * l'autre.
 */
const { occasions } = useHebrewOccasions();
const occasionsOpen = ref(false);

const KIND_ICONS: Record<OccasionKind, IconName> = {
  yahrzeit: "candle",
  birthday: "cake",
  other: "calendar",
};

/** Une ligne du calendrier : une fête de l'année, ou une date personnelle. */
type CalendarRow =
  | { key: string; abs: number; entry: CalendarEntry; occasion?: undefined }
  | { key: string; abs: number; entry?: undefined; occasion: HebrewOccasion; date: HDate };

const rows = computed<CalendarRow[]>(() => {
  const festivals: CalendarRow[] = entries.value.map((entry) => ({
    key: entry.key,
    abs: entry.first.abs(),
    entry,
  }));
  const personal: CalendarRow[] = isNativeApp
    ? occasions.value.map((occasion) => {
        const date = occasionDateIn(occasion, year.value);
        return { key: `occasion-${occasion.id}`, abs: date.abs(), occasion, date };
      })
    : [];
  return [...festivals, ...personal].sort((a, b) => a.abs - b.abs);
});

/** « jeudi 3 décembre 2026 », le jour civil d'une date personnelle. */
function civilOf(date: HDate): string {
  return dateTimeFormat(locale.value, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date.greg());
}

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
/**
 * Ce qui est derrière nous s'efface : le dernier jour d'une fête pour un bloc,
 * le jour lui-même pour une date personnelle.
 */
const isPastDay = (abs: number) => abs < today.value;

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
  const long = dateTimeFormat(locale.value, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (entry.first.abs() === entry.last.abs()) return long.format(from);
  const short = dateTimeFormat(locale.value, { weekday: "long", day: "numeric" });
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
 * L'année civile de l'occurrence mise en avant, celle du titre (« Roch Hachana
 * 2026 ») : la même que porte la page prérendue (zmanimSeoPages), qui date
 * son titre de la première occurrence à venir.
 */
const festivalYear = computed(() => {
  const key = festivalKey.value;
  const entry = key ? entries.value.find((e) => e.key === key) : null;
  return entry ? entry.first.greg().getFullYear() : new Date().getFullYear();
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
    title: wanted
      ? t("seo.festivalTitle", { festival: label, year: festivalYear.value })
      : t("seo.calendarTitle"),
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
    <!-- App native : le calendrier est le second onglet des horaires, et les
         onglets tiennent lieu de titre (voir PageTabs). Sur le site, le
         bandeau y mène, et le lien de retour reste. -->
    <PageTabs
      v-if="isNativeApp"
      :tabs="tabs"
      event="zmanim_tab_switched"
      :label="t('zmanim.navTitle')"
    />
    <RouterLink v-else :to="localePath('horaires')" class="back-link mb-6">
      <AppIcon name="chevron-left" :size="14" class="rtl:rotate-180" />
      {{ t("zmanim.navTitle") }}
    </RouterLink>

    <h1
      class="text-center text-2xl md:text-3xl font-bold text-text-primary tracking-tight"
      :class="isNativeApp ? 'sr-only' : ''"
    >
      {{ t("calendar.title") }}
    </h1>
    <p class="mt-2 flex items-center justify-center gap-1.5">
      <AppIcon name="map-pin" :size="16" class="text-primary shrink-0" />
      <span class="font-semibold text-text-primary">{{ placeLabel }}</span>
    </p>
    <p class="mt-3 text-center text-sm text-text-secondary leading-relaxed">
      {{ t("calendar.description") }}
    </p>

    <!-- Ses propres dates : anniversaires, leilouy nichmat. Elles se posent
         ici parce qu'elles se lisent ici, au milieu des fêtes de l'année. -->
    <div v-if="isNativeApp" class="mt-4 flex justify-center">
      <button type="button" class="btn btn-soft" @click="occasionsOpen = true">
        <AppIcon name="calendar" :size="16" class="text-primary" />
        {{ t("occasions.open") }}
      </button>
    </div>

    <!-- Année affichée : les flèches parcourent le calendrier sans rien recharger -->
    <div class="mx-auto mt-8 flex max-w-md items-center justify-between gap-3">
      <button
        type="button"
        class="icon-btn"
        :aria-label="t('calendar.previousYear')"
        @click="yearOffset--"
      >
        <AppIcon name="chevron-left" :size="18" class="rtl:rotate-180" />
      </button>
      <p class="text-lg font-semibold text-text-primary">{{ t("calendar.year", { year }) }}</p>
      <button
        type="button"
        class="icon-btn"
        :aria-label="t('calendar.nextYear')"
        @click="yearOffset++"
      >
        <AppIcon name="chevron-right" :size="18" class="rtl:rotate-180" />
      </button>
    </div>
    <div v-if="yearOffset !== 0" class="mt-3 text-center">
      <button type="button" class="btn btn-soft" @click="yearOffset = 0">
        {{ t("calendar.backToCurrent") }}
      </button>
    </div>

    <!-- Les fêtes à la suite. Celles qui sont passées s'effacent, la prochaine
         se distingue : c'est elle qu'on vient chercher. -->
    <ul class="mt-6 flex flex-col gap-3">
      <li
        v-for="row in rows"
        :key="row.key"
        :data-entry="row.key"
        class="card p-4"
        :class="[
          isPastDay(row.entry ? row.entry.last.abs() : row.abs) ? 'opacity-55' : '',
          row.key === nextKey || row.key === festivalKey
            ? 'border border-primary/30 bg-primary/5'
            : '',
        ]"
      >
        <!-- Une fête de l'année : son nom, ses dates, et ses heures quand le
             travail y est interdit. -->
        <div v-if="row.entry" class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="font-semibold text-text-primary">{{ title(row.entry) }}</p>
            <p class="text-sm text-text-secondary">{{ civilRange(row.entry) }}</p>
            <p class="text-xs text-text-secondary/80">{{ hebrewRange(row.entry) }}</p>
          </div>
          <dl v-if="row.entry.period" class="shrink-0 text-end text-sm">
            <div class="flex items-baseline justify-end gap-2">
              <dt class="text-xs text-text-secondary">{{ t("calendar.start") }}</dt>
              <dd class="font-semibold tabular-nums text-text-primary">
                {{ clock(row.entry.period.start) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-end gap-2">
              <dt class="text-xs text-text-secondary">{{ t("calendar.end") }}</dt>
              <dd class="font-semibold tabular-nums text-text-primary">
                {{ clock(row.entry.period.end) }}
              </dd>
            </div>
          </dl>
        </div>

        <!-- Une date à soi : la toucher rouvre son réglage, là où on l'a
             posée. L'icône dit ce qu'elle commémore, sans l'écrire. -->
        <button
          v-else
          type="button"
          class="flex w-full items-start gap-2.5 text-start"
          :aria-label="t('occasions.editAria', { name: row.occasion.name })"
          @click="occasionsOpen = true"
        >
          <AppIcon
            :name="KIND_ICONS[row.occasion.kind]"
            :size="17"
            class="mt-0.5 shrink-0 text-primary"
          />
          <span class="min-w-0">
            <span class="block font-semibold text-text-primary">{{ row.occasion.name }}</span>
            <span class="block text-sm text-text-secondary">{{ civilOf(row.date) }}</span>
            <span class="block text-xs text-text-secondary/80">
              {{ formatHebrewDate(row.date, locale) }}
            </span>
          </span>
        </button>
      </li>
    </ul>

    <p class="mt-5 border-t border-line pt-3 text-xs text-text-secondary leading-relaxed">
      {{ t("zmanim.disclaimer") }}
    </p>

    <OccasionsModal v-if="isNativeApp" v-model:show="occasionsOpen" :today="todayHd" />
  </main>
</template>
