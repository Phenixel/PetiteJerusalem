<script setup lang="ts">
/**
 * The daily book (`/bibliotheque/lecture-du-jour`): everything read again
 * every day, one after the other, on a single page. It is the « Lecture du
 * jour » volume of the shelf, and the card of the same name in the stack. It
 * holds the daily texts (a psalm, a page one loves) and the Tehilim of the
 * day of the month or of the week (services/parcours/dailyBook.ts):
 *
 *  - one list, in the order of the catalog: the psalms of the Tehilim of the
 *    day come among the psalms taken one by one, and a psalm given twice is
 *    read once;
 *  - what is said before and after (the Yehi ratson of the Tehilim), once for
 *    everything read from the same corpus (encadrementBounds);
 *  - each text is marked read, and folds away; its chapters too, one by one,
 *    and the last one ticked ticks the text (the chapters read stay on the
 *    device for the day). The last psalm of a Tehilim cycle marks its task;
 *  - the reading menu, the text size, the auto-scroll, the screen kept on,
 *    the texts to download, the reminders (in the app: the line of the day's
 *    reminders, which opens « Les heures de ma journée »);
 *  - the list is composed right here: « Modifier ma liste » shows what the
 *    book holds, each removed with a tap; the Tehilim of the day and the
 *    search add several in a row.
 *
 * What is marked here is what the home stack marks: a single day.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { TextStudyJsonEntry } from "../../models/models";
import { useDailyBook, type DailyReadingState } from "../../composables/useDailyBook";
import { useParcours } from "../../composables/useParcours";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { useReadingPinch } from "../../composables/useReadingPinch";
import { useAutoScroll } from "../../composables/useAutoScroll";
import { useKeepAwake } from "../../composables/useKeepAwake";
import { useEntriesTranslation } from "../../composables/useEntriesTranslation";
import { anchorToElement } from "../../composables/scrollAnchor";
import { devicePreference } from "../../services/devicePreference";
import { encadrementBounds } from "../../services/encadrementService";
import { appendHebrewNumeral } from "../../services/hebrewNumerals";
import { trackDayViewed } from "../../services/parcours/tracking";
import { createCycle, createText } from "../../services/parcours/create";
import type { DailyObjective } from "../../services/parcours/dailyBook";
import type { DayKey, TehilimCycleId } from "../../services/parcours/model";
import { analyticsService } from "../../services/analyticsService";
import { haptic } from "../../services/haptics";
import { SearchService } from "../../services/searchService";
import { pageTitle, seoService } from "../../services/seoService";
import { SITE_URL } from "../../config/site";
import AppIcon from "../../components/icons/AppIcon.vue";
import CollapseTransition from "../../components/CollapseTransition.vue";
import ProgressBar from "../../components/ProgressBar.vue";
import ReadingEncadrement from "../../components/ReadingEncadrement.vue";
import ReadingMenu from "../../components/ReadingMenu.vue";
import ReadingProgressBar from "../../components/ReadingProgressBar.vue";
import ReadingSizeControl from "../../components/ReadingSizeControl.vue";
import ReminderSlotsSheet from "../../components/parcours/ReminderSlotsSheet.vue";
import RemindersLine from "../../components/parcours/RemindersLine.vue";
import { isNativeApp } from "../../composables/useNativeApp";
import OfflineTextsNotice from "../../components/parcours/OfflineTextsNotice.vue";
import StepText from "../../components/parcours/create/StepText.vue";
import DailyReadingItem from "../Library/DailyReadingItem.vue";

const { t } = useI18n();
const store = useParcours();
const views = useParcoursViews();
const book = useDailyBook();
// In the app, pinching the page enlarges the text read, not the page.
useReadingPinch();

const today = computed(() => store.today.value);

/** A reading of the day, on the page. */
interface Reading extends DailyReadingState {
  /** Above the name, small: the book (« Tehilim », « Pirké Avot »). */
  kicker: string;
  title: string;
}

/** The day's readings, in the order of the catalog. */
const daily = computed<Reading[]>(() =>
  book.readings.value.map((reading) => ({
    ...reading,
    kicker: SearchService.formatBookName(reading.entry.livre),
    title: appendHebrewNumeral(reading.entry.name),
  })),
);
/** The texts' translation: its setting in the reading menu. */
const translation = useEntriesTranslation(() => daily.value.map((reading) => reading.entry));

// The Yehi ratson and the like: once for everything read from the same
// corpus, the list being in the order of the catalog, which keeps them together.
const textBounds = computed(() => encadrementBounds(daily.value.map((r) => r.entry)));

const doneCount = computed(() => book.doneCount.value);
const allDone = computed(() => daily.value.length > 0 && doneCount.value === daily.value.length);
const percent = computed(() =>
  daily.value.length === 0 ? 0 : Math.round((doneCount.value / daily.value.length) * 100),
);

// --- The list: what the book holds, to remove or to add, on the page itself. ---

/** What the book holds: the daily texts in the order of the catalog, then the Tehilim cycles. */
const listed = computed(() => book.objectives.value);
const takenTexts = computed(() =>
  listed.value.flatMap((objective) => (objective.kind === "text" ? [objective.textId] : [])),
);
const takenCycles = computed(() =>
  listed.value.flatMap((objective) => (objective.kind === "cycle" ? [objective.cycle] : [])),
);
/** « Mes Tehilim journaliers » when it holds only psalms, otherwise « Lecture du jour ». */
const name = computed(() => views.dailyName(listed.value));

/** The list opened: at once when there is nothing to read yet. */
const editing = ref(false);
/** The reminders of the day, opened from the line at the bottom (in the app). */
const remindersOpen = ref(false);
watch(
  () => listed.value.length === 0,
  (empty) => {
    if (empty) editing.value = true;
  },
  { immediate: true },
);

function removeObjective(objective: DailyObjective): void {
  store.removeObjective(objective.id);
  analyticsService.capture("parcours_objective_removed", {
    kind: objective.kind,
    source: "daily_page",
  });
}

/** The search starts again empty once its texts are added. */
const searchKey = ref(0);
/** What was ticked in the search and the Tehilim of the day, taken at once. */
function add(entries: TextStudyJsonEntry[], cycles: TehilimCycleId[]): void {
  const now = Date.now();
  cycles.forEach((cycle, i) => {
    if (takenCycles.value.includes(cycle)) return;
    store.saveObjective(createCycle(cycle, today.value, now + i));
    analyticsService.capture("parcours_objective_created", {
      kind: "cycle",
      cycle,
      source: "daily_page",
    });
  });
  entries.forEach((entry, i) => {
    const objective = createText(Number(entry.id), today.value, now + cycles.length + i);
    store.saveObjective(objective);
    analyticsService.capture("parcours_objective_created", {
      kind: "text",
      text_id: objective.textId,
      texts_count: entries.length,
      source: "daily_page",
    });
  });
  haptic("done");
  searchKey.value++;
}

const hasReading = computed(() => daily.value.length > 0);
// A double tap on the text: the page scrolls by itself; the screen stays on.
useAutoScroll(() => hasReading.value);
useKeepAwake(() => hasReading.value);

/** What the device needs to read all of it offline. */
const offlineEntries = computed(() => daily.value.map((reading) => reading.entry));

// --- Replier un texte : un titre touché, ou une lecture cochée. ---
const collapsed = ref<Set<string>>(new Set());
const articles = new Map<string, HTMLElement>();
function setArticle(key: string, el: unknown): void {
  if (el instanceof HTMLElement) articles.set(key, el);
  else articles.delete(key);
}
function setCollapsed(key: string, value: boolean): void {
  const next = new Set(collapsed.value);
  if (value) next.add(key);
  else next.delete(key);
  collapsed.value = next;
}
const toggleCollapse = (key: string) => setCollapsed(key, !collapsed.value.has(key));

/** Marks a reading read or not: read, it folds away; unmarked, it opens again. */
function toggleDone(reading: Reading): void {
  const done = !reading.done;
  book.setRead(reading, done, "daily_page");
  setCollapsed(reading.key, done);
  if (done) anchorToElement(articles.get(reading.key) ?? null);
}

// --- Les chapitres d'un texte, cochés un à un, le temps de la journée, sur l'appareil. ---
interface SectionsRead {
  day: DayKey;
  read: Record<string, number[]>;
}
const sectionsStore = devicePreference<SectionsRead>(
  "pj_daily_sections",
  (raw) => {
    try {
      const value = raw ? (JSON.parse(raw) as SectionsRead) : null;
      return value && typeof value.day === "string" && value.read ? value : null;
    } catch {
      return null;
    }
  },
  JSON.stringify,
);
const sections = ref<SectionsRead>(sectionsStore.read() ?? { day: "", read: {} });
const sectionsToday = computed(() =>
  sections.value.day === today.value ? sections.value.read : {},
);
const sectionIndexes = new Map<string, number[]>();

function toggleSection(reading: Reading, index: number): void {
  const current = new Set(sectionsToday.value[reading.key] ?? []);
  if (current.has(index)) current.delete(index);
  else current.add(index);
  sections.value = {
    day: today.value,
    read: { ...sectionsToday.value, [reading.key]: [...current] },
  };
  sectionsStore.write(sections.value);
  // Le dernier chapitre coché coche le texte, comme « Marquer comme lu ».
  const all = sectionIndexes.get(reading.key) ?? [];
  if (!reading.done && all.length > 0 && all.every((i) => current.has(i))) toggleDone(reading);
}

const sectionsRead = (reading: Reading): number => sectionsToday.value[reading.key]?.length ?? 0;

// L'arrivée sur la lecture du jour, comme le portefeuille déplié de l'accueil.
trackDayViewed(store.data.value, store.context.value, today.value, "page");

seoService.setMeta({
  title: pageTitle(t("parcours.daily.title")),
  description: t("parcours.daily.seoDescription"),
  canonical: SITE_URL + "/bibliotheque/lecture-du-jour",
});
</script>

<template>
  <main class="mx-auto w-full max-w-3xl px-6 pb-16 pt-[18px] md:py-12">
    <RouterLink to="/" class="back-link mb-5">
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ t("common.home") }}
    </RouterLink>

    <h1 class="font-display text-3xl font-bold md:text-4xl">{{ name.title }}</h1>
    <!-- Composer sa liste, et la taille du texte comme dans le lecteur. -->
    <div class="mt-3 flex min-h-11 flex-wrap items-center justify-between gap-3">
      <button
        v-if="listed.length"
        type="button"
        class="add-link"
        :aria-expanded="editing"
        @click="editing = !editing"
      >
        <AppIcon :name="editing ? 'check' : 'pencil'" :size="14" />
        {{ editing ? t("parcours.daily.editDone") : t("parcours.daily.edit") }}
      </button>
      <ReadingSizeControl v-if="hasReading" class="ms-auto" />
    </div>

    <!-- Ma liste : les textes du jour, chacun retirable d'un toucher, et la
         recherche pour en ajouter plusieurs d'affilée. -->
    <section v-if="editing" class="mt-4">
      <ul v-if="listed.length" class="card divide-y divide-line overflow-hidden">
        <li
          v-for="objective in listed"
          :key="objective.id"
          class="flex min-h-14 items-center gap-3 px-4"
        >
          <RouterLink
            :to="`/parcours/objectif/${objective.id}`"
            class="min-w-0 flex-1 py-2.5 text-[15px] font-bold"
          >
            {{ views.objectiveTitle(objective) }}
          </RouterLink>
          <button
            type="button"
            class="remove-btn"
            :aria-label="t('parcours.daily.remove', { name: views.objectiveTitle(objective) })"
            @click="removeObjective(objective)"
          >
            <AppIcon name="x" :size="16" />
          </button>
        </li>
      </ul>
      <p class="mt-5 text-[15px] font-bold">{{ t("parcours.daily.addTitle") }}</p>
      <StepText
        :key="searchKey"
        class="mt-2"
        :taken="takenTexts"
        :taken-cycles="takenCycles"
        @pick="add"
      />
    </section>

    <!-- Nothing today: what to compose one's reading with. -->
    <div v-if="!hasReading" class="flex flex-col items-center py-16 text-center">
      <AppIcon name="book" :size="32" class="mb-4 text-primary/50" />
      <p class="text-xl font-semibold">{{ t("parcours.daily.emptyTitle") }}</p>
      <p class="mt-2 max-w-sm text-text-secondary">{{ t("parcours.daily.emptyText") }}</p>
    </div>

    <template v-else>
      <OfflineTextsNotice class="mt-6" :entries="offlineEntries" />

      <!-- La journée : où l'on en est. -->
      <div v-if="daily.length" class="card mt-6 p-5">
        <div v-if="allDone" class="flex items-start gap-3">
          <p class="font-semibold">{{ t("parcours.daily.allDone") }}</p>
        </div>
        <template v-else>
          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm font-medium">
              {{ t("parcours.daily.progress", { done: doneCount, total: daily.length }) }}
            </span>
            <span class="text-sm font-semibold text-primary">{{ percent }} %</span>
          </div>
          <ProgressBar :value="percent" :label="name.title" />
        </template>
      </div>

      <div class="mt-10 space-y-12">
        <template v-for="reading in daily" :key="reading.key">
          <!-- Ce qui se dit avant : une fois, au premier texte du corpus. -->
          <ReadingEncadrement
            v-if="textBounds.get(String(reading.entry.id))?.before"
            :blocks="textBounds.get(String(reading.entry.id))!.before!"
            :title="t('encadrement.before')"
          />

          <article
            :ref="(el) => setArticle(reading.key, el)"
            :class="{ 'opacity-60': reading.done }"
          >
            <header class="mb-4">
              <button
                type="button"
                class="group flex w-full items-start gap-3 text-start"
                :aria-expanded="!collapsed.has(reading.key)"
                @click="toggleCollapse(reading.key)"
              >
                <AppIcon
                  name="chevron-down"
                  :size="13"
                  class="mt-1.5 text-text-secondary/60 transition-transform duration-200"
                  :class="{ '-rotate-90': collapsed.has(reading.key) }"
                />
                <span class="min-w-0">
                  <span class="block text-xs font-semibold text-primary">{{ reading.kicker }}</span>
                  <span class="flex items-center gap-2 text-lg font-bold group-hover:text-primary">
                    {{ reading.title }}
                    <AppIcon
                      v-if="reading.done"
                      name="circle-check"
                      :size="15"
                      class="text-primary"
                    />
                    <!-- Lecture par chapitres entamée : où l'on en est. -->
                    <span
                      v-else-if="
                        (reading.entry.totalSections ?? 1) > 1 && sectionsRead(reading) > 0
                      "
                      class="sections-chip"
                    >
                      {{ sectionsRead(reading) }}/{{ reading.entry.totalSections }}
                    </span>
                  </span>
                </span>
              </button>
            </header>

            <CollapseTransition>
              <div v-show="!collapsed.has(reading.key)">
                <DailyReadingItem
                  :entry="reading.entry"
                  :read-sections="sectionsToday[reading.key] ?? []"
                  @toggle-section="(i) => toggleSection(reading, i)"
                  @sections-loaded="(indexes) => sectionIndexes.set(reading.key, indexes)"
                />
                <button
                  type="button"
                  class="mark-btn mt-4"
                  :class="{ 'is-done': reading.done }"
                  @click="toggleDone(reading)"
                >
                  <AppIcon v-if="reading.done" name="circle-check" :size="15" />
                  <span v-else class="mark-ring" />
                  {{ reading.done ? t("parcours.daily.readToday") : t("parcours.daily.markRead") }}
                </button>
              </div>
            </CollapseTransition>
          </article>

          <!-- Ce qui se dit après : une fois, au dernier texte du corpus. -->
          <ReadingEncadrement
            v-if="textBounds.get(String(reading.entry.id))?.after"
            :blocks="textBounds.get(String(reading.entry.id))!.after!"
            :title="t('encadrement.after')"
          />
        </template>
      </div>

      <template v-if="isNativeApp">
        <div class="mt-12 text-center">
          <RemindersLine @open="remindersOpen = true" />
        </div>
        <ReminderSlotsSheet
          :open="remindersOpen"
          source="daily_page"
          @close="remindersOpen = false"
        />
      </template>
    </template>

    <!-- Comme les autres textes : le menu de lecture et la progression au bas de l'écran. -->
    <template v-if="hasReading">
      <ReadingMenu
        :share-title="name.title"
        :translation-langs="translation.langs.value"
        :translation-lang="translation.lang.value"
      />
      <ReadingProgressBar />
    </template>
  </main>
</template>

<style scoped>
.add-link {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  gap: 6px;
  color: var(--color-primary);
  font-size: 15px;
  font-weight: 700;
}
.remove-btn {
  display: grid;
  flex: none;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: var(--radius-pill);
  color: var(--color-text-secondary);
}
.remove-btn:hover {
  background: color-mix(in srgb, var(--color-text-primary) 8%, transparent);
  color: var(--color-text-primary);
}
.mark-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.mark-btn:hover,
.mark-btn.is-done {
  color: var(--color-primary);
}
.mark-ring {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-radius: var(--radius-pill);
}
.sections-chip {
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
}
</style>
