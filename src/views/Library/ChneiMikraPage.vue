<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  adjacentParasha,
  getChneiMikraForShabbat,
  isVezotHaberakha,
  parashaTitle,
  shabbatOfWeek,
  simhatTorahAfter,
  type WeeklyParasha,
} from "../../services/dailyCycles";
import { localeMessagesReady } from "../../i18n";
import { dateTimeFormat } from "../../services/intlCache";
import { pageTitle, seoService } from "../../services/seoService";
import { useWeeklyParasha } from "../../composables/useTehilimDay";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { isIsraelPlace } from "../../services/zmanimService";
import { analyticsService } from "../../services/analyticsService";
import { useReadingPinch } from "../../composables/useReadingPinch";
import { useAutoScroll } from "../../composables/useAutoScroll";
import { useKeepAwake } from "../../composables/useKeepAwake";
import { useChneiMikraOptions } from "../../composables/useChneiMikraOptions";
import { useEntriesTranslation } from "../../composables/useEntriesTranslation";
import AppIcon from "../../components/icons/AppIcon.vue";
import { useChneiMikraChecks } from "../../composables/useChneiMikraChecks";
import { useParcours } from "../../composables/useParcours";
import ChneiMikraAliyotSheet from "../../components/ChneiMikraAliyotSheet.vue";
import ReadingMenu from "../../components/ReadingMenu.vue";
import ReadingProgressBar from "../../components/ReadingProgressBar.vue";
import ReadingSizeControl from "../../components/ReadingSizeControl.vue";
import type { TextStudyJsonEntry } from "../../models/models";
import DailyReadingItem from "./DailyReadingItem.vue";
import { appendHebrewNumeral } from "../../services/hebrewNumerals";
import {
  ALIYOT_PER_PARASHA,
  aliyaAnchor,
  aliyaName,
  aliyotLabel,
  parseAliyotQuery,
} from "../../services/parcours/aliyot";
import type { ReadingNavSection } from "../../composables/useReadingNav";

// Venu de Mon parcours : la fin de la lecture coche la carte du jour (chargée
// à la demande, elle tire le calendrier hébraïque).
const ReaderTaskCard = defineAsyncComponent(
  () => import("../../components/parcours/ReaderTaskCard.vue"),
);
import { SITE_URL } from "../../config/site";

/**
 * Le chnei mikra : la paracha de la semaine, chaque verset suivi de son
 * Targoum Onkelos.
 *
 * Il ne se lisait que depuis la lecture quotidienne, qui demande un compte et
 * qu'il faut avoir pensé à activer. Cette page l'ouvre à tout le monde, et la
 * bibliothèque y renvoie depuis le Tanakh.
 *
 * La semaine affichée vit dans l'URL (`?semaine=2026-08-15`, le Chabbat où la
 * paracha est lue) : le bouton « précédent » du navigateur défait un
 * feuilletage, et un lien envoyé à quelqu'un ouvre bien la même paracha.
 */

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
// App native : pincer dans la page agrandit le texte lu, pas la page.
useReadingPinch();
// Verse written twice, Rashi: set in the reading menu, shared with the daily reading.
const { doubleVerses, withRashi } = useChneiMikraOptions();

const WEEK_PARAM = "semaine";

/** La paracha de la semaine en cours : le défaut, et le retour. Suit le jour
 * hébraïque (samedi soir, la suivante) et le temps qui passe. */
const { parasha: currentWeek } = useWeeklyParasha();

/** Le calendrier du lieu des horaires : Israël lit parfois une paracha d'avance. */
const { place } = useZmanimLocation();
const il = computed(() => isIsraelPlace(place.value));

/**
 * La paracha demandée par l'URL. Une semaine inconnue (lien trafiqué, Chabbat
 * de fête sans paracha ordinaire) retombe sur celle de la semaine : mieux vaut
 * une page utile qu'une erreur.
 */
const parasha = computed<WeeklyParasha | null>(() => {
  const asked = route.query[WEEK_PARAM];
  if (typeof asked !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(asked)) return currentWeek.value;
  return getChneiMikraForShabbat(shabbatOfWeek(asked), il.value) ?? currentWeek.value;
});

// Double appui sur le texte : la page descend toute seule, à l'allure choisie
// dans la pastille du bas (AutoScrollPill). Sans paracha, il n'y a rien à
// faire descendre.
useAutoScroll(() => parasha.value !== null);

// L'écran ne s'éteint pas tant que la paracha est ouverte : les chnei mikra
// se lisent verset après verset, sans une main pour réveiller le téléphone.
useKeepAwake(() => parasha.value !== null);

const isCurrentWeek = computed(() => parasha.value?.weekKey === currentWeek.value?.weekKey);

/**
 * Mon parcours, une montée par jour (`?montees=2-3`, comptées de 1 sur la
 * semaine, de 8 à 14 pour la seconde d'une paracha double) : la page se
 * réduit aux montées de la carte. « Toute la paracha » rend le reste.
 */
const montees = computed(() =>
  route.query[WEEK_PARAM] === undefined ? parseAliyotQuery(route.query.montees) : null,
);
const objectiveId = computed(() =>
  typeof route.query.objectif === "string" ? route.query.objectif : null,
);
type ShownEntry = {
  entry: TextStudyJsonEntry;
  /** Son rang dans la semaine : 1 pour le second texte d'une paracha double. */
  index: number;
  blocks?: { from: number; to: number };
};
const shownEntries = computed(() =>
  (parasha.value?.entries ?? []).flatMap((entry, index): ShownEntry[] => {
    const range = montees.value;
    if (!range) return [{ entry, index }];
    const start = index * ALIYOT_PER_PARASHA;
    const from = Math.max(range.from, start) - start;
    const to = Math.min(range.to, start + ALIYOT_PER_PARASHA) - start;
    return to > from ? [{ entry, index, blocks: { from, to } }] : [];
  }),
);
const monteesLabel = computed(() =>
  montees.value && parasha.value
    ? aliyotLabel(
        montees.value,
        parasha.value.entries.map((entry) => appendHebrewNumeral(entry.name)),
        t,
      )
    : "",
);

/**
 * The week's checked aliyot (useChneiMikraChecks), kept by Mon parcours: each
 * one is checked at its end in the text, or from the week's sheet opened on
 * the paracha's name, and the dots under that name say where the week stands.
 */
const aliyaChecks = useChneiMikraChecks();
const aliyotCount = computed(() => (parasha.value?.entries.length ?? 0) * ALIYOT_PER_PARASHA);
const checkedAliyot = computed(() =>
  parasha.value ? aliyaChecks.checked(parasha.value.weekKey, aliyotCount.value) : new Set<number>(),
);
const aliyotDone = computed(() => checkedAliyot.value.size);
/** The dots under the paracha's name: seven per paracha, lit once read. */
const aliyaDots = computed(() =>
  Array.from({ length: aliyotCount.value }, (_, aliya) => ({
    aliya,
    done: checkedAliyot.value.has(aliya),
    // A double paracha: a wider gap between the two weeks' halves.
    split: aliya > 0 && aliya % ALIYOT_PER_PARASHA === 0,
  })),
);
const aliyotOpen = ref(false);
/** Les montées cochées d'un des textes de la semaine (le second d'une double part de 7). */
function checkedIn(entryIndex: number): number[] {
  const base = entryIndex * ALIYOT_PER_PARASHA;
  return [...checkedAliyot.value].filter((a) => a >= base).map((a) => a - base);
}
function setAliya(
  aliya: number,
  done: boolean,
  label: string,
  source: "text" | "sheet" = "text",
): void {
  const week = parasha.value;
  if (!week) return;
  aliyaChecks.setChecked(week.weekKey, aliya, aliyotCount.value, done);
  const entry = week.entries[Math.floor(aliya / ALIYOT_PER_PARASHA)];
  analyticsService.capture("chnei_mikra_aliya_toggled", {
    done,
    text_id: entry?.id ?? null,
    aliya: label,
    source,
  });
}
/**
 * From the week's sheet. The aliyah is named as the text names it
 * (« 1re montée »), whatever the reader's language, so that the measure
 * adds up with the checks made in the text.
 */
function toggleFromSheet(aliya: number, done: boolean): void {
  const n = (aliya % ALIYOT_PER_PARASHA) + 1;
  setAliya(aliya, done, `${n === 1 ? "1re" : `${n}e`} montée`, "sheet");
}
function toggleFromText(entryIndex: number, index: number, done: boolean, label: string): void {
  setAliya(entryIndex * ALIYOT_PER_PARASHA + index, done, label);
}
/** Les coches de la version d'avant, reprises une fois (voir takeLegacyChecks). */
function adoptLegacy(entryIndex: number, indexes: number[]): void {
  const week = parasha.value;
  if (!week) return;
  for (const index of indexes) {
    const aliya = entryIndex * ALIYOT_PER_PARASHA + index;
    if (!checkedAliyot.value.has(aliya)) {
      aliyaChecks.setChecked(week.weekKey, aliya, aliyotCount.value, true);
    }
  }
}

/**
 * Opened from Mon parcours for a single aliyah, the reading ends with the
 * pull of the day's portion (ReaderTaskCard), which checks that aliyah: a
 * check of its own, just above, would ask the same thing twice. With several
 * aliyot (or « Toute la paracha »), each keeps its check, to be ticked one by
 * one, and the pull still does them all at once.
 */
const store = useParcours();
const endPull = computed(
  () =>
    objectiveId.value !== null &&
    store.todayTasks.value.some((task) => task.objectiveId === objectiveId.value),
);
const shownAliyot = computed(() =>
  shownEntries.value.reduce(
    (sum, shown) => sum + (shown.blocks ? shown.blocks.to - shown.blocks.from : ALIYOT_PER_PARASHA),
    0,
  ),
);
const hideAliyaChecks = computed(() => endPull.value && shownAliyot.value === 1);

function showWhole(): void {
  const query = { ...route.query };
  delete query.montees;
  void router.replace({ query });
}

const title = computed(() => parashaTitle(parasha.value));
const entryNames = computed(() =>
  (parasha.value?.entries ?? []).map((entry) => appendHebrewNumeral(entry.name)),
);

/** « Chabbat 8 août », le Chabbat où la paracha affichée est lue ; pour
 * Vezot Haberakha, qui n'a pas de Chabbat, le jour de Sim'hat Torah. */
const shabbatLabel = computed(() => {
  if (!parasha.value) return "";
  const format = dateTimeFormat(locale.value, { day: "numeric", month: "long" });
  if (isVezotHaberakha(parasha.value)) {
    const date = format.format(simhatTorahAfter(parasha.value.weekKey, il.value));
    return t("chneiMikra.simhatTorahOn", { date });
  }
  return t("chneiMikra.shabbatOn", { date: format.format(shabbatOfWeek(parasha.value.weekKey)) });
});

/** Les parachiot voisines : une flèche sans destination est désactivée. */
const previous = computed(() =>
  parasha.value ? adjacentParasha(parasha.value.weekKey, -1, il.value) : null,
);
const next = computed(() =>
  parasha.value ? adjacentParasha(parasha.value.weekKey, 1, il.value) : null,
);

function goTo(target: WeeklyParasha | null, direction: "previous" | "next" | "current") {
  if (!target) return;
  analyticsService.capture("chnei_mikra_week_changed", {
    direction,
    parasha: target.names.join("-"),
  });
  // La semaine en cours est le défaut : elle n'a pas à encombrer l'URL.
  // Seule la query change, le chemin reste celui où l'on est.
  const query =
    target.weekKey === currentWeek.value?.weekKey ? {} : { [WEEK_PARAM]: target.weekKey };
  void router.push({ query });
}

/** The translation of the parasha and of Rashi: its setting in the reading menu. */
const translation = useEntriesTranslation(() => shownEntries.value.map((shown) => shown.entry));

/**
 * The aliyot shown, as landmarks of the reading menu: one goes to the 7th
 * without scrolling through the first six (feedback of November 2, 2026). A
 * double paracha names its own in front of each aliyah.
 */
const navSections = computed<ReadingNavSection[]>(() =>
  shownEntries.value.flatMap((shown) => {
    const from = shown.blocks?.from ?? 0;
    const to = shown.blocks?.to ?? ALIYOT_PER_PARASHA;
    const double = (parasha.value?.entries.length ?? 1) > 1;
    return Array.from({ length: to - from }, (_, k) => {
      const index = from + k;
      const aliya = shown.index * ALIYOT_PER_PARASHA + index;
      const name = aliyaName(index, t);
      return {
        anchor: aliyaAnchor(aliya),
        offset: aliya,
        label: double ? `${entryNames.value[shown.index]} · ${name}` : name,
      };
    });
  }),
);

/** Le nom sous lequel la page se partage (voir ReadingMenu). */
const shareTitle = computed(() => `${t("chneiMikra.title")} · ${title.value}`);

function applySeoMeta() {
  seoService.setMeta({
    title: pageTitle(`${t("chneiMikra.title")} · ${title.value}`),
    description: t("chneiMikra.pageDescription"),
    canonical: SITE_URL + "/bibliotheque/chnei-mikra",
  });
}

// Rejoué au changement de langue : les messages en et he arrivent par import
// dynamique, parfois après le montage.
watch([title, locale, localeMessagesReady], applySeoMeta, { immediate: true });
</script>

<template>
  <main class="mx-auto px-6 py-12">
    <div class="max-w-3xl mx-auto">
      <RouterLink to="/bibliotheque/tanakh" class="back-link mb-4">
        <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
        {{ t("study.types.tanakh") }}
      </RouterLink>

      <h1 class="text-3xl md:text-4xl font-bold text-text-primary tracking-tight pb-1">
        {{ t("chneiMikra.title") }}
      </h1>
      <p class="mt-2 text-text-secondary">{{ t("chneiMikra.hint") }}</p>

      <template v-if="parasha">
        <!-- Feuilleter les parachiot : les Chabbats de fête sont enjambés, sauf
             celui de Souccot, qui porte Vezot Haberakha. -->
        <div class="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            @click="goTo(previous, 'previous')"
            :disabled="!previous"
            class="icon-btn disabled:opacity-30"
            :aria-label="t('chneiMikra.previous')"
            :title="t('chneiMikra.previous')"
          >
            <AppIcon name="chevron-left" :size="20" class="rtl:rotate-180" />
          </button>

          <!-- The paracha's name opens the week's aliyot, to check off those
               read elsewhere (a printed book) without scrolling to their
               end; the dots under it say where the week stands. -->
          <button
            type="button"
            class="parasha-name min-w-0 text-center"
            aria-haspopup="dialog"
            @click="aliyotOpen = true"
          >
            <span class="block truncate text-xl font-bold text-text-primary">{{ title }}</span>
            <span class="aliya-dots" aria-hidden="true">
              <span
                v-for="dot in aliyaDots"
                :key="dot.aliya"
                class="aliya-dot"
                :class="{ 'is-done': dot.done, 'is-split': dot.split }"
              />
            </span>
            <span class="sr-only">
              {{ t("chneiMikra.progress", { done: aliyotDone, total: aliyotCount }) }}
            </span>
            <span class="block text-sm text-text-secondary">{{ shabbatLabel }}</span>
          </button>

          <button
            type="button"
            @click="goTo(next, 'next')"
            :disabled="!next"
            class="icon-btn disabled:opacity-30"
            :aria-label="t('chneiMikra.next')"
            :title="t('chneiMikra.next')"
          >
            <AppIcon name="chevron-right" :size="20" class="rtl:rotate-180" />
          </button>
        </div>

        <div class="mt-3 flex items-center justify-between gap-3">
          <!-- Parti feuilleter : de quoi revenir à la paracha qu'on lit cette semaine. -->
          <button
            v-if="!isCurrentWeek"
            type="button"
            @click="goTo(currentWeek, 'current')"
            class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <AppIcon name="history" :size="13" />
            {{ t("chneiMikra.backToThisWeek") }}
          </button>
          <span v-else></span>

          <!-- Taille du texte (même réglage que le lecteur de la bibliothèque) -->
          <ReadingSizeControl />
        </div>

        <!-- La paracha change : on remonte des composants neufs plutôt que de
             recycler ceux du texte précédent, marque-pages compris. -->
        <div :key="parasha.weekKey" class="mt-8 space-y-10">
          <!-- Une montée par jour : celles de la carte, et de quoi lire tout le reste. -->
          <div v-if="montees" class="card flex items-center justify-between gap-3 px-4 py-3">
            <p class="min-w-0">
              <span class="block text-[13px] font-semibold text-text-secondary">
                {{ t("chneiMikra.today") }}
              </span>
              <span class="block font-bold">{{ monteesLabel }}</span>
            </p>
            <button type="button" class="btn btn-soft min-h-10 flex-none px-4" @click="showWhole">
              {{ t("chneiMikra.whole") }}
            </button>
          </div>
          <DailyReadingItem
            v-for="shown in shownEntries"
            :key="shown.entry.id"
            :entry="shown.entry"
            :blocks="shown.blocks"
            :with-targoum="true"
            :double-verses="doubleVerses"
            :with-rashi="withRashi"
            :aliya-week="parasha.weekKey"
            :checked-aliyot="checkedIn(shown.index)"
            :hide-aliya-checks="hideAliyaChecks"
            :aliya-base="shown.index * ALIYOT_PER_PARASHA"
            source="library_chnei_mikra"
            @toggle-aliya="
              (index: number, done: boolean, label: string) =>
                toggleFromText(shown.index, index, done, label)
            "
            @legacy-aliyot="(indexes: number[]) => adoptLegacy(shown.index, indexes)"
          />
          <ReaderTaskCard v-if="objectiveId" :objective-id="objectiveId" />
        </div>

        <ChneiMikraAliyotSheet
          :open="aliyotOpen"
          :title="title"
          :names="entryNames"
          :checked="checkedAliyot"
          @close="aliyotOpen = false"
          @toggle="toggleFromSheet"
        />
      </template>

      <p v-else class="mt-10 text-text-secondary">{{ t("chneiMikra.unavailable") }}</p>
    </div>

    <!-- Comme les autres textes de la bibliothèque : le menu de lecture et la
         progression au bas de l'écran. -->
    <ReadingMenu
      :share-title="shareTitle"
      :sections="navSections"
      chnei-mikra
      :translation-langs="translation.langs.value"
      :translation-lang="translation.lang.value"
    />
    <ReadingProgressBar />
  </main>
</template>

<style scoped>
/* The paracha's name is a button: no frame, its title taking the theme color
   on hover, like a door of the home page. */
.parasha-name {
  border-radius: var(--radius-control);
  padding: 2px 8px;
}
.parasha-name:hover > span:first-child {
  color: var(--color-primary);
}
/* Seven dots, one per aliyah: solid in the theme color once read, a ring
   until then. */
.aliya-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin: 6px 0 4px;
}
.aliya-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
  box-shadow: inset 0 0 0 1.5px var(--color-line-strong);
  transition: background-color 0.2s;
}
.aliya-dot.is-done {
  background-color: var(--color-primary);
  box-shadow: none;
}
.aliya-dot.is-split {
  margin-inline-start: 8px;
}
@media (prefers-reduced-motion: reduce) {
  .aliya-dot {
    transition: none;
  }
}
</style>
