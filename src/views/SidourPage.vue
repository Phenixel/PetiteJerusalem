<script setup lang="ts">
/**
 * Le Sidour : deuxième onglet de la barre du bas, et tout ce qu'on dit.
 *
 * Les tefilot, les brahot et les textes des fêtes vivaient dans trois livres
 * de la bibliothèque, mêlés aux textes d'étude. Ils n'en font plus qu'une
 * liste, rangée par usage (voir content/sidourGroups) : on ne se demande plus
 * dans quel livre est le Birkat Hamazon.
 *
 * En tête, le moment, comme sur l'accueil : l'office dont c'est l'heure (ou
 * celui qui vient), à pleine couleur, avec ce que le jour y ajoute ; puis deux
 * ou trois textes qui se disent aussi maintenant (voir services/sidourMoment).
 * Les fêtes restent en bas de la liste, et remontent en tête le temps de la
 * leur ; dans l'app, leurs textes se téléchargent alors d'eux-mêmes.
 *
 * Les textes gardent leur adresse sous /bibliotheque : elle est publiée.
 */
import { computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../components/icons/AppIcon.vue";
import type { IconName } from "../components/icons/registry";
import { useNow } from "../composables/useNow";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import { useZmanimPlaceLabel } from "../composables/useZmanimPlaceLabel";
import { useLocalePath } from "../composables/useLocalePath";
import { isNativeApp } from "../composables/useNativeApp";
import { localeMessagesReady } from "../i18n";
import {
  sidourMoment,
  type SidourAddition,
  type SidourExtra,
  type SidourHero,
} from "../services/sidourMoment";
import {
  sidourSections,
  sidourText,
  type SidourSection,
  type SidourText,
} from "../content/sidourGroups";
import { SIDOUR_HUB_PATH, SIDOUR_SEO } from "../content/sidourSeo";
import {
  formatHebrewDate,
  formatZmanDay,
  formatZmanTime,
  hebrewDateFor,
} from "../services/zmanimService";
import type { TefilaKey } from "../services/sidourService";
import { analyticsService } from "../services/analyticsService";
import { pageTitle, seoService } from "../services/seoService";
import { SITE_URL } from "../config/site";

const { t, locale } = useI18n();
const now = useNow();
const { place } = useZmanimLocation();
const placeLabel = useZmanimPlaceLabel(place);
const { localePath } = useLocalePath();

const moment = computed(() => sidourMoment(place.value, now.value));
const sections = computed<SidourSection[]>(() => sidourSections(moment.value.feast));

const time = (date: Date | undefined) =>
  date ? formatZmanTime(date, place.value.tzid, locale.value) : "";

// --- La date, en tête -------------------------------------------------------
// Le jour civil, puis le jour hébraïque, qui bascule à la chkia.
const dateLine = computed(() => {
  const civil = formatZmanDay(now.value, place.value.tzid, locale.value);
  const hebrew = formatHebrewDate(hebrewDateFor(place.value, now.value, now.value), locale.value);
  return `${civil.charAt(0).toLocaleUpperCase(locale.value)}${civil.slice(1)} · ${hebrew}`;
});

// --- La carte du moment -----------------------------------------------------
const TEFILA_ICONS: Record<TefilaKey, IconName> = {
  chaharit: "sunrise",
  minha: "sun",
  arvit: "moon",
};

const DAY_LABELS: Record<NonNullable<SidourHero["day"]>, string> = {
  hanouka: "sidour.days.hanouka",
  pourim: "sidour.days.pourim",
  holHamoed: "sidour.days.holHamoed",
  roshHodech: "sidour.days.roshHodech",
  taanit: "sidour.days.taanit",
  teshuva: "sidour.days.teshuva",
  motsaeChabbat: "sidour.days.motsaeChabbat",
  eloul: "sidour.days.eloul",
};

const ADDITION_LABELS: Record<SidourAddition["key"], string> = {
  yaaleVeyavo: "sidour.additions.yaaleVeyavo",
  alHanissim: "sidour.additions.alHanissim",
  hamelekh: "sidour.additions.hamelekh",
  hallel: "sidour.additions.hallel",
  moussaf: "sidour.additions.moussaf",
  anenou: "sidour.additions.anenou",
  ataHonantanou: "sidour.additions.ataHonantanou",
  omer: "sidour.additions.omer",
};

function additionLabel(addition: SidourAddition): string {
  if (addition.key === "omer")
    return addition.n === 1
      ? t("sidour.additions.omerOne")
      : t("sidour.additions.omer", { n: addition.n });
  return t(ADDITION_LABELS[addition.key]);
}

const tefilaName = (tefila: TefilaKey) => t(`home.sidourNow.names.${tefila}`);

const hero = computed(() => {
  const h = moment.value.hero;
  if (!h) return null;
  const text = sidourText(h.text);
  if (!text) return null;
  const kicker =
    h.kind === "hanouka"
      ? t("sidour.tonight")
      : h.kind === "next-tefila"
        ? t("sidour.next")
        : t("sidour.now");
  const day = h.day && !(h.kind === "hanouka") ? ` · ${t(DAY_LABELS[h.day])}` : "";
  const name = h.tefila ? tefilaName(h.tefila) : text.latin;
  let meta = "";
  if (h.kind === "tefila") meta = t("sidour.until", { time: time(h.end) });
  else if (h.kind === "next-tefila") meta = t("sidour.from", { time: time(h.start) });
  else if (h.kind === "slihot") meta = t("sidour.slihot.now", { time: time(h.end) });
  else if (h.kind === "hanouka") {
    const n = h.night ?? 1;
    meta = h.beforeShabbat
      ? n === 1
        ? t("sidour.hanouka.beforeShabbatOne", { time: time(h.beforeShabbat) })
        : t("sidour.hanouka.beforeShabbat", { n, time: time(h.beforeShabbat) })
      : n === 1
        ? t("sidour.hanouka.nightOne")
        : t("sidour.hanouka.night", { n });
  }
  const icon: IconName = h.tefila
    ? TEFILA_ICONS[h.tefila]
    : h.kind === "hanouka"
      ? "candle"
      : "moon";
  return {
    kind: h.kind,
    key: text.key,
    path: text.path,
    kicker: `${kicker}${day}`,
    name,
    meta,
    icon,
    additions: h.additions.map(additionLabel),
  };
});

// --- Ce qui se dit aussi maintenant ---------------------------------------
const EXTRA_ICONS: Record<SidourExtra["key"], IconName> = {
  tefila: "sun",
  havdala: "candle",
  halevana: "moon",
  loulav: "book-open",
  hochanot: "book-open",
  slihot: "moon",
  chema: "moon",
  tikoun: "moon",
};

function extraMeta(extra: SidourExtra): string {
  switch (extra.key) {
    case "tefila": {
      const when = extra.now
        ? t("sidour.until", { time: time(extra.end) })
        : t("sidour.from", { time: time(extra.start) });
      const adds = (extra.additions ?? []).map(additionLabel).join(", ");
      const sentence = `${when.charAt(0).toLocaleUpperCase(locale.value)}${when.slice(1)}`;
      return adds ? `${sentence} · ${adds}` : sentence;
    }
    case "havdala":
      return extra.start
        ? t("sidour.extras.havdala", { time: time(extra.start) })
        : t("sidour.extras.havdalaPlain");
    case "halevana":
      return extra.until
        ? t("sidour.extras.halevana", { date: formatHebrewDate(extra.until, locale.value) })
        : "";
    case "loulav":
      return t("sidour.extras.loulav");
    case "hochanot":
      return t("sidour.extras.hochanot");
    case "slihot":
      return t("sidour.extras.slihot", { start: time(extra.start), end: time(extra.end) });
    case "chema":
      return t("sidour.extras.chema");
    case "tikoun":
      return extra.start && now.value.getTime() < extra.start.getTime()
        ? t("sidour.extras.tikounFrom", { time: time(extra.start) })
        : t("sidour.extras.tikounUntil", { time: time(extra.end) });
  }
}

const extras = computed(() =>
  moment.value.extras
    .map((extra) => {
      const text = sidourText(extra.text);
      if (!text) return null;
      return {
        key: text.key,
        path: text.path,
        name: extra.tefila ? tefilaName(extra.tefila) : text.latin,
        meta: extraMeta(extra),
        icon: extra.tefila ? TEFILA_ICONS[extra.tefila] : EXTRA_ICONS[extra.key],
      };
    })
    .filter((extra) => extra !== null),
);

// --- Mesure d'audience -------------------------------------------------------
// Ce que la carte proposait à l'arrivée : l'office, celui qui vient, la fête.
function heroValue(h: SidourHero | null): string | null {
  if (!h) return null;
  if (h.kind === "tefila") return h.tefila ?? null;
  if (h.kind === "next-tefila") return `next_${h.tefila}`;
  return h.kind;
}

function trackOpen(
  text: SidourText | { key: string },
  source: "hero" | "extra" | "list",
  section?: string,
) {
  analyticsService.capture("sidour_text_opened", {
    text: text.key,
    source,
    section: section ?? null,
    feast: moment.value.feast,
  });
}

// --- La fête qui remonte : ses textes se téléchargent d'eux-mêmes (app) ------
// Le temps d'une fête, ses textes viennent en tête : ils doivent s'ouvrir sans
// réseau, à la synagogue comme ailleurs. Rien ne se télécharge si le système
// le refuse en arrière-plan (vieux Android sans accès au stockage).
async function downloadFeastTexts(): Promise<void> {
  const feast = moment.value.feast;
  if (!isNativeApp || !feast) return;
  const feastSection = sections.value.find((section) => section.kind === "feast-now");
  if (!feastSection) return;
  const [library, store] = await Promise.all([
    import("../services/offlineLibraryService"),
    import("../services/offlineTextStore"),
  ]);
  await store.ensureManifestLoaded();
  const books = feastSection.items
    .map((text) => library.bookForEntry(text.entry))
    .filter((book): book is NonNullable<typeof book> => !!book)
    .filter((book) => !library.isBookBundled(book) && !library.isBookDownloaded(book));
  if (books.length === 0 || !(await store.backgroundDownloadAllowed())) return;
  const failed = await library.downloadBooks(books);
  analyticsService.capture("offline_download_completed", {
    scope: "feast",
    tab: feast,
    books_count: books.length - failed.length,
    books_failed: failed.length,
  });
}

// --- Référencement ----------------------------------------------------------
function applySeoMeta() {
  const fr = locale.value === "fr";
  seoService.setMeta({
    title: fr ? SIDOUR_SEO.title : pageTitle(t("sidour.title")),
    description: fr ? SIDOUR_SEO.description : t("sidour.seoDescription"),
    canonical: SITE_URL + SIDOUR_HUB_PATH,
  });
}
watch([locale, localeMessagesReady], applySeoMeta);

onMounted(() => {
  applySeoMeta();
  analyticsService.capture("sidour_viewed", {
    hero: heroValue(moment.value.hero),
    feast: moment.value.feast,
  });
  void downloadFeastTexts().catch((error) =>
    console.warn("Téléchargement des textes de la fête impossible :", error),
  );
});
</script>

<template>
  <main class="mx-auto max-w-3xl px-6 py-12">
    <header class="text-center mb-8 animate-[fadeIn_0.4s_ease]">
      <h1 class="text-3xl md:text-4xl font-bold text-text-primary tracking-tight">
        {{ t("sidour.title") }}
      </h1>
      <p class="mt-2 text-sm text-text-secondary">{{ dateLine }}</p>
      <p
        v-if="!isNativeApp"
        class="mt-4 text-base md:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed"
      >
        {{ t("sidour.subtitle") }}
      </p>
    </header>

    <!-- Le moment : la seule carte en couleur de la page, celle qu'on vient
         chercher (voir docs/design.md, « Ce qu'on vient chercher prend la
         couleur, pleine »). -->
    <RouterLink
      v-if="hero"
      :to="hero.path"
      class="sidour-hero press-feedback block rounded-card bg-primary px-5 pt-4 pb-5 text-white"
      @click="trackOpen(hero, 'hero')"
    >
      <span class="block text-sm font-semibold text-white/85">{{ hero.kicker }}</span>
      <span class="mt-1 flex items-center justify-between gap-3">
        <span class="font-display text-3xl font-bold leading-tight">{{ hero.name }}</span>
        <AppIcon :name="hero.icon" :size="30" class="shrink-0" />
      </span>
      <span class="mt-1 block text-[15px] font-medium text-white/90">{{ hero.meta }}</span>
      <span
        v-if="hero.additions.length"
        class="mt-3 flex flex-wrap gap-1.5"
        :aria-label="t('sidour.additions.label')"
      >
        <span
          v-for="label in hero.additions"
          :key="label"
          class="rounded-pill bg-white/20 px-2.5 py-1 text-xs font-semibold text-white"
        >
          {{ label }}
        </span>
      </span>
    </RouterLink>

    <div v-if="extras.length" class="mt-3 flex flex-col gap-3">
      <RouterLink
        v-for="extra in extras"
        :key="extra.key"
        :to="extra.path"
        class="card card-hover press-feedback group flex items-center gap-4 px-4 py-3.5"
        @click="trackOpen(extra, 'extra')"
      >
        <AppIcon :name="extra.icon" :size="21" class="shrink-0 text-primary" />
        <span class="flex flex-col gap-0.5 min-w-0">
          <span class="font-semibold text-text-primary group-hover:text-primary transition-colors">
            {{ extra.name }}
          </span>
          <span class="text-sm text-text-secondary">{{ extra.meta }}</span>
        </span>
      </RouterLink>
    </div>

    <p class="mt-4 flex justify-center">
      <RouterLink
        :to="localePath('horaires')"
        class="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors"
      >
        <AppIcon name="map-pin" :size="12" />
        {{ t("sidour.placeLink", { place: placeLabel }) }}
      </RouterLink>
    </p>

    <!-- Tous les textes, rangés par usage ; les fêtes en bas, celle du moment
         en tête. -->
    <section v-for="section in sections" :key="section.id" class="mt-8">
      <h2 class="mb-2 ms-1 flex items-center gap-2 text-sm font-semibold text-text-secondary">
        {{ t(section.labelKey) }}
        <span
          v-if="section.kind === 'feast-now'"
          class="rounded-pill bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"
        >
          {{ t("sidour.nowPill") }}
        </span>
      </h2>
      <div class="card overflow-hidden">
        <RouterLink
          v-for="text in section.items"
          :key="text.key"
          :to="text.path"
          class="sidour-row group flex min-h-12 items-center justify-between gap-3 px-4 py-2.5"
          @click="trackOpen(text, 'list', section.id)"
        >
          <span class="font-medium text-text-primary group-hover:text-primary transition-colors">
            {{ text.latin }}
          </span>
          <span class="font-hebrew text-lg text-text-secondary" lang="he" dir="rtl">
            {{ text.hebrew }}
          </span>
        </RouterLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.sidour-hero {
  box-shadow: var(--shadow-card-hover);
}
/* Les lignes d'une liste posée dans une carte : un filet entre elles, pas de
   bordure autour (la carte se détache par son ombre). */
.sidour-row + .sidour-row {
  border-top: 1px solid var(--color-line);
}
.sidour-row:active {
  background-color: color-mix(in srgb, var(--color-text-primary) 5%, transparent);
}
</style>
