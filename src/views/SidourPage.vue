<script lang="ts">
/**
 * Le téléchargement des textes de la fête en cours, un seul à la fois pour
 * toute l'app : revenir sur la page pendant qu'il tourne ne le relance pas,
 * et ne compte pas pour téléchargés des livres encore en route.
 */
let feastDownload: Promise<void> | null = null;
</script>

<script setup lang="ts">
/**
 * Le Sidour : deuxième onglet de la barre du bas, et tout ce qu'on dit.
 *
 * Les tefilot, les brahot et les textes des fêtes vivaient dans trois livres
 * de la bibliothèque, mêlés aux textes d'étude. Ils n'en font plus qu'une
 * liste, rangée par usage (voir content/sidourGroups) : on ne se demande plus
 * dans quel livre est le Birkat Hamazon.
 *
 * At the top, the moment, as on the home page: the service whose time it is
 * (or the one coming up), in solid color, with what the day adds to it; then
 * two or three texts that are also said now (see services/sidourMoment). A
 * service already said steps aside (useOfficesDone).
 * Les fêtes restent en bas de la liste, et remontent en tête le temps de la
 * leur ; dans l'app, leurs textes se téléchargent alors d'eux-mêmes.
 *
 * Sous le moment, les outils : la direction du Kotel, le miroir des
 * téfilines, le temps de Souccot les six côtés du na'anou'a (voir
 * content/sidourTools). Celui dont c'est l'heure passe devant.
 *
 * Les textes gardent leur adresse sous /bibliotheque : elle est publiée.
 */
import { computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../components/icons/AppIcon.vue";
import CardArt, { type CardArtSpec } from "../components/CardArt.vue";
import type { IconName } from "../components/icons/registry";
import KotelCompass from "../components/KotelCompass.vue";
import NaanouimCompass from "../components/NaanouimCompass.vue";
import TefilinMirror from "../components/TefilinMirror.vue";
import { openKotelCompass } from "../composables/useKotelCompass";
import { openNaanouimCompass } from "../composables/useNaanouimCompass";
import { openTefilinMirror } from "../composables/useTefilinMirror";
import { useNow } from "../composables/useNow";
import { useOfficesDone } from "../composables/useOfficesDone";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import { useZmanimPlaceLabel } from "../composables/useZmanimPlaceLabel";
import { useLocalePath } from "../composables/useLocalePath";
import { isNativeApp } from "../composables/useNativeApp";
import { localeMessagesReady } from "../i18n";
import {
  MOMENT_TEXTS,
  sidourMoment,
  type SidourAddition,
  type SidourExtra,
  type SidourHero,
} from "../services/sidourMoment";
import {
  FEAST_LABEL_KEYS,
  sidourSections,
  sidourText,
  type SidourSection,
  type SidourText,
} from "../content/sidourGroups";
import { SIDOUR_HUB_PATH, SIDOUR_SEO } from "../content/sidourSeo";
import { SIDOUR_TOOLS, type SidourToolId } from "../content/sidourTools";
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

// A service already said (checked off in Mon parcours, or swiped on the home
// page) gives the card to what comes next.
const { isOfficeDone } = useOfficesDone();
const moment = computed(() => sidourMoment(place.value, now.value, isOfficeDone));
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
/** Le nom d'un texte sur la carte : l'hébreu du catalogue en hébreu, sinon le latin. */
const textName = (text: SidourText) => (locale.value === "he" ? text.hebrew : text.latin);

const hero = computed(() => {
  const h = moment.value.hero;
  if (!h) return null;
  const text = sidourText(h.text);
  if (!text) return null;
  let kicker = t("sidour.now");
  if (h.kind === "hanouka") kicker = t("sidour.tonight");
  else if (h.kind === "halevana") kicker = t("sidour.thisNight");
  else if (h.kind === "next-tefila") kicker = t("sidour.next");
  else if (h.kind === "feast" && h.feast) kicker = t(FEAST_LABEL_KEYS[h.feast]);
  const day = h.day && h.kind !== "hanouka" ? ` · ${t(DAY_LABELS[h.day])}` : "";
  const name = h.tefila ? tefilaName(h.tefila) : textName(text);
  let meta = "";
  if (h.kind === "tefila") meta = t("sidour.until", { time: time(h.end) });
  else if (h.kind === "next-tefila") meta = t("sidour.from", { time: time(h.start) });
  else if (h.kind === "slihot") meta = t("sidour.slihot.now", { time: time(h.end) });
  else if (h.kind === "halevana" && h.until)
    meta = t("sidour.halevana.until", { date: formatHebrewDate(h.until, locale.value) });
  else if (h.night) {
    const n = h.night;
    meta = h.beforeShabbat
      ? n === 1
        ? t("sidour.hanouka.beforeShabbatOne", { time: time(h.beforeShabbat) })
        : t("sidour.hanouka.beforeShabbat", { n, time: time(h.beforeShabbat) })
      : n === 1
        ? t("sidour.hanouka.nightOne")
        : t("sidour.hanouka.night", { n });
  } else if (h.text === MOMENT_TEXTS.loulav) meta = t("sidour.loulav.until", { time: time(h.end) });
  else if (h.text === MOMENT_TEXTS.slihot)
    meta = t("sidour.slihot.tonight", { start: time(h.start), end: time(h.end) });

  // L'objet du moment, dessiné dans la carte (voir CardArt) : le sidour pour
  // un office, et pour une occasion, son objet à elle.
  let art: CardArtSpec = { kind: "siddur" };
  if (h.kind === "halevana" && h.moonAge !== undefined) art = { kind: "moon", age: h.moonAge };
  else if (h.night) art = { kind: "hanoukia", night: h.night, lit: h.kind === "hanouka" };
  else if (h.text === MOMENT_TEXTS.slihot) art = { kind: "shofar" };
  else if (h.text === MOMENT_TEXTS.loulav) art = { kind: "loulav" };

  return {
    kind: h.kind,
    key: text.key,
    path: text.path,
    kicker: `${kicker}${day}`,
    name,
    meta,
    art,
    // Un objet clair (la lune, le chofar) : le texte qui passe devant garde
    // une ombre douce, et la ligne d'heure lui laisse sa place.
    lightArt: art.kind === "moon" || art.kind === "shofar",
    additions: h.additions.map(additionLabel),
  };
});

// --- La ligne dessous, un soir d'occasion ------------------------------------
function extraMeta(extra: SidourExtra): string {
  if (extra.key === "havdala") {
    return extra.start
      ? t("sidour.extras.havdala", { time: time(extra.start) })
      : t("sidour.extras.havdalaPlain");
  }
  const when = extra.now
    ? t("sidour.until", { time: time(extra.end) })
    : t("sidour.from", { time: time(extra.start) });
  const adds = (extra.additions ?? []).map(additionLabel).join(", ");
  const sentence = `${when.charAt(0).toLocaleUpperCase(locale.value)}${when.slice(1)}`;
  return adds ? `${sentence} · ${adds}` : sentence;
}

const extra = computed(() => {
  const e = moment.value.extra;
  const text = e ? sidourText(e.text) : null;
  if (!e || !text) return null;
  return {
    key: text.key,
    path: text.path,
    name: e.tefila ? tefilaName(e.tefila) : textName(text),
    meta: extraMeta(e),
    icon: e.tefila ? TEFILA_ICONS[e.tefila] : ("candle" as IconName),
  };
});

// --- Les outils ---------------------------------------------------------------
// Les fenêtres sont montées avec la page, fermées : le miroir doit demander la
// caméra dans le geste même qui l'ouvre (voir TefilinMirror), une fenêtre
// chargée après coup arriverait trop tard.
const tools = computed(() =>
  moment.value.tools
    .map((id) => SIDOUR_TOOLS.find((tool) => tool.id === id))
    .filter((tool) => tool !== undefined),
);
const offersNaanouim = computed(() => moment.value.tools.includes("naanouim"));

const TOOL_OPENERS: Record<SidourToolId, () => void> = {
  kotel: () => openKotelCompass("sidour"),
  tefilin: () => openTefilinMirror("sidour"),
  naanouim: () => openNaanouimCompass("sidour"),
};

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
function downloadFeastTexts(): Promise<void> {
  feastDownload ??= runFeastDownload().finally(() => {
    feastDownload = null;
  });
  return feastDownload;
}

async function runFeastDownload(): Promise<void> {
  const feast = moment.value.feast;
  if (!isNativeApp || !feast) return;
  // Hors connexion, chaque visite essayait et échouait : on attend le réseau.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
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
      class="sidour-hero press-feedback relative block rounded-card bg-brand px-5 pt-4 pb-5 text-on-brand"
      :class="{ 'sidour-hero-light': hero.lightArt }"
      @click="trackOpen(hero, 'hero')"
    >
      <!-- L'objet du moment, derrière le texte : le sidour, la lune, la
           'hanoukkia... Il ne sort de la carte que par le haut. -->
      <CardArt :art="hero.art" />
      <span class="relative block text-sm font-semibold text-on-brand/80">{{ hero.kicker }}</span>
      <span class="relative mt-1 block font-display text-3xl font-bold leading-tight">
        {{ hero.name }}
      </span>
      <span
        class="relative mt-1 block text-[15px] font-medium text-on-brand/90"
        :class="{ 'pe-[30%]': hero.lightArt }"
        >{{ hero.meta }}</span
      >
      <span
        v-if="hero.additions.length"
        class="relative mt-3 flex flex-wrap gap-1.5"
        :aria-label="t('sidour.additions.label')"
      >
        <span
          v-for="label in hero.additions"
          :key="label"
          class="rounded-pill bg-on-brand/10 px-2.5 py-1 text-xs font-semibold text-on-brand"
        >
          {{ label }}
        </span>
      </span>
    </RouterLink>

    <!-- Une ligne dessous, au plus, et seulement un soir d'occasion. -->
    <RouterLink
      v-if="extra"
      :to="extra.path"
      class="card card-hover press-feedback group mt-3 flex items-center gap-4 px-4 py-3.5"
      @click="trackOpen(extra, 'extra')"
    >
      <AppIcon :name="extra.icon" :size="21" class="shrink-0 text-secondary" />
      <span class="flex flex-col gap-0.5 min-w-0">
        <span class="font-semibold text-text-primary group-hover:text-primary transition-colors">
          {{ extra.name }}
        </span>
        <span class="text-sm text-text-secondary">{{ extra.meta }}</span>
      </span>
    </RouterLink>

    <p class="mt-4 flex justify-center">
      <RouterLink
        :to="localePath('horaires')"
        class="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors"
      >
        <AppIcon name="map-pin" :size="12" />
        {{ t("sidour.placeLink", { place: placeLabel }) }}
      </RouterLink>
    </p>

    <!-- Les outils, en une ligne qui défile : la pastille qui les ouvre
         depuis le texte, son dessin et son nom en toutes lettres ; celui du
         moment devant. Une ligne et pas des pastilles empilées : deux noms
         entiers ne tiennent pas côte à côte sur un téléphone, et la rangée
         doit garder sa hauteur quand les outils seront cinq. -->
    <section v-if="tools.length" class="mt-8" aria-labelledby="sidour-tools">
      <h2 id="sidour-tools" class="mb-1 ms-1 text-sm font-semibold text-text-secondary">
        {{ t("sidour.tools.label") }}
      </h2>
      <div class="sidour-tools -mx-6 flex gap-2 overflow-x-auto px-6 py-1">
        <button
          v-for="tool in tools"
          :key="tool.id"
          type="button"
          class="sidour-tool"
          :class="`sidour-tool-${tool.id}`"
          @click="TOOL_OPENERS[tool.id]()"
        >
          <AppIcon :name="tool.icon" :size="15" class="sidour-tool-icon shrink-0" />
          {{ t(tool.labelKey) }}
        </button>
      </div>
    </section>

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

    <KotelCompass />
    <TefilinMirror />
    <NaanouimCompass v-if="offersNaanouim" />
  </main>
</template>

<style scoped>
.sidour-hero {
  box-shadow: var(--shadow-card-hover);
}
/* Le texte sur un objet clair : un halo de la couleur de la carte, juste
   assez pour que le titre se lise là où il passe devant la lune (le brun de
   l'orange clair comme le blanc d'une teinte de fête). */
.sidour-hero-light {
  text-shadow:
    0 0 3px var(--color-brand),
    0 0 10px var(--color-brand);
}
/* Les lignes d'une liste posée dans une carte : un filet entre elles, pas de
   bordure autour (la carte se détache par son ombre). */
.sidour-row + .sidour-row {
  border-top: 1px solid var(--color-line);
}
.sidour-row:active {
  background-color: color-mix(in srgb, var(--color-text-primary) 5%, transparent);
}

/* Un outil : la pastille des commandes de titre du lecteur (`.title-action`,
   LiturgyText), à la taille du renvoi qu'elle porte seule sous un texte, à
   la couleur secondaire du thème : un instrument, pas un texte. */
/* La ligne défile au doigt, sans barre : la pastille coupée au bord de
   l'écran dit qu'il y en a d'autres. */
.sidour-tools {
  scrollbar-width: none;
}
.sidour-tools::-webkit-scrollbar {
  display: none;
}
.sidour-tool {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  white-space: nowrap;
  gap: 0.45rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-pill);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-secondary);
  background-color: color-mix(in srgb, var(--color-secondary) 11%, transparent);
  transition:
    background-color 0.2s ease,
    transform 0.15s ease;
}
.sidour-tool:hover {
  background-color: color-mix(in srgb, var(--color-secondary) 18%, transparent);
}
.sidour-tool:active {
  transform: scale(0.97);
}
.sidour-tool:focus-visible {
  outline: 2px solid var(--color-secondary);
  outline-offset: 2px;
}

/* Au survol, le dessin s'anime : l'aiguille de la boussole cherche son cap,
   le miroir pivote sur son manche. Au toucher, la fenêtre s'ouvre déjà : pas
   de mouvement à voir. */
@media (hover: hover) {
  .sidour-tool:hover .sidour-tool-icon {
    animation: tool-seek 0.6s ease-out;
  }
  .sidour-tool-tefilin:hover .sidour-tool-icon {
    transform-origin: 50% 85%;
    animation-name: tool-tilt;
  }
}
@keyframes tool-seek {
  0%,
  100% {
    transform: rotate(0deg);
  }
  30% {
    transform: rotate(-35deg);
  }
  60% {
    transform: rotate(14deg);
  }
  80% {
    transform: rotate(-5deg);
  }
}
@keyframes tool-tilt {
  0%,
  100% {
    transform: rotate(0deg);
  }
  35% {
    transform: rotate(-14deg);
  }
  70% {
    transform: rotate(6deg);
  }
}
:root.perf-lite .sidour-tool-icon {
  animation: none !important;
}
:root.perf-lite .sidour-tool:active {
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .sidour-tool-icon {
    animation: none !important;
  }
  .sidour-tool:active {
    transform: none;
  }
}
</style>
