<script setup lang="ts">
/**
 * La lecture du jour (`/bibliotheque/lecture-du-jour`) : tout ce qu'il y a à
 * lire aujourd'hui, à la suite, sur une seule page. C'était la page de la
 * lecture quotidienne d'avant Mon parcours ; elle revient, nourrie par lui,
 * sans rien perdre de ce qu'elle savait faire :
 *
 *  - les lectures du calendrier en tête (les Tehilim du jour ou de la
 *    semaine, la paracha montée par montée), puis les textes du jour dans
 *    l'ordre du catalogue ;
 *  - ce qui se dit avant et après (le Yehi ratson des Tehilim), une fois pour
 *    tout ce qu'on lit du même corpus (encadrementBounds) ;
 *  - un texte se coche, et se replie ; ses chapitres aussi, un à un, et le
 *    dernier coché coche le texte (les chapitres lus se gardent sur
 *    l'appareil, le temps de la journée) ;
 *  - la paracha de la semaine à part, dans « Cette semaine », avec le
 *    verset écrit deux fois et Rachi ;
 *  - le menu de lecture, la taille du texte, le défilement tout seul,
 *    l'écran qui reste allumé, les textes à télécharger, le rappel du soir.
 *
 * Ce qui se coche ici est ce que coche la pile de l'accueil : une seule
 * journée. La carte « Lecture du jour » de la pile y mène.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import textStudiesJson from "../../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../../models/models";
import { useParcours } from "../../composables/useParcours";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { useReadingPinch } from "../../composables/useReadingPinch";
import { useAutoScroll } from "../../composables/useAutoScroll";
import { useKeepAwake } from "../../composables/useKeepAwake";
import { useChneiMikraOptions } from "../../composables/useChneiMikraOptions";
import { anchorToElement } from "../../composables/scrollAnchor";
import { psalmsLabel } from "../../composables/useTehilimDay";
import { getWeeklyParasha, tehilimOfCycle } from "../../services/dailyCycles";
import { localDayFrom } from "../../services/dateService";
import { devicePreference } from "../../services/devicePreference";
import {
  encadrementBounds,
  encadrementOf,
  type Encadrement,
} from "../../services/encadrementService";
import { appendHebrewNumeral } from "../../services/hebrewNumerals";
import { ALIYOT_PER_PARASHA } from "../../services/parcours/aliyot";
import { taskEntries } from "../../services/parcours/entries";
import { trackDayViewed } from "../../services/parcours/tracking";
import type { DayKey, Objective } from "../../services/parcours/model";
import type { Task } from "../../services/parcours/schedule";
import { SearchService } from "../../services/searchService";
import { pageTitle, seoService } from "../../services/seoService";
import { isIsraelPlace } from "../../services/zmanimService";
import { SITE_URL } from "../../config/site";
import AppIcon from "../../components/icons/AppIcon.vue";
import ChneiMikraOptions from "../../components/ChneiMikraOptions.vue";
import CollapseTransition from "../../components/CollapseTransition.vue";
import ProgressBar from "../../components/ProgressBar.vue";
import ReadingEncadrement from "../../components/ReadingEncadrement.vue";
import ReadingMenu from "../../components/ReadingMenu.vue";
import ReadingProgressBar from "../../components/ReadingProgressBar.vue";
import ReadingSizeControl from "../../components/ReadingSizeControl.vue";
import DailyReminderButton from "../../components/parcours/DailyReminderButton.vue";
import OfflineTextsNotice from "../../components/parcours/OfflineTextsNotice.vue";
import DailyReadingItem from "../Library/DailyReadingItem.vue";

const { t } = useI18n();
const store = useParcours();
const views = useParcoursViews();
const { place } = useZmanimLocation();
// App native : pincer dans la page agrandit le texte lu, pas la page.
useReadingPinch();
// Verset écrit deux fois, Rachi : le réglage de la page du chnei mikra.
const { doubleVerses, withRashi } = useChneiMikraOptions();

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;
/** L'ordre du catalogue : Tehilim 1, 4, 8, puis Michna, Talmud, Tanakh. */
const catalogRank = new Map<number, number>(allTexts.map((entry, i) => [Number(entry.id), i]));

const today = computed(() => store.today.value);
const il = computed(() => isIsraelPlace(place.value));

/** Une lecture de la page : une tâche du jour, et ses textes. */
interface Reading {
  key: string;
  task: Task;
  objective: Objective;
  /** Au-dessus du nom, en petit : « Tehilim du jour », le livre d'un texte. */
  kicker: string;
  title: string;
  entries: TextStudyJsonEntry[];
  /** La paracha montée par montée : les montées de chaque parasha, à afficher. */
  blocks?: ({ from: number; to: number } | undefined)[];
  encadrement: Encadrement | null;
  done: boolean;
}

const dateOf = (day: DayKey): Date => {
  const date = localDayFrom(day) ?? new Date();
  date.setHours(12);
  return date;
};

function readingOf(task: Task): Reading | null {
  const objective = store.data.value.objectives[task.objectiveId];
  if (!objective) return null;
  const view = views.taskView(task, today.value);
  const base = { key: task.id, task, objective, done: view.progress === "done" };
  if (objective.kind === "text") {
    const entry = taskEntries(task, objective, today.value, il.value)[0];
    if (!entry) return null;
    return {
      ...base,
      kicker: SearchService.formatBookName(entry.livre),
      title: appendHebrewNumeral(entry.name),
      entries: [entry],
      encadrement: null,
    };
  }
  if (objective.kind !== "cycle") return null;
  if (objective.cycle === "parasha") {
    const parasha = getWeeklyParasha(dateOf(today.value), il.value);
    if (!parasha) return null;
    const aliyot = task.aliyot;
    return {
      ...base,
      kicker: views.objectiveTitle(objective),
      title: view.meta,
      entries: parasha.entries,
      blocks: aliyot
        ? parasha.entries.map((_, index) => {
            const start = index * ALIYOT_PER_PARASHA;
            const from = Math.max(aliyot.from, start) - start;
            const to = Math.min(aliyot.to, start + ALIYOT_PER_PARASHA) - start;
            return to > from ? { from, to } : { from: 0, to: 0 };
          })
        : undefined,
      encadrement: null,
    };
  }
  const cycle = tehilimOfCycle(objective.cycle, dateOf(today.value));
  return {
    ...base,
    kicker: views.objectiveTitle(objective),
    title: psalmsLabel(cycle.psalms, t),
    entries: cycle.entries,
    encadrement: encadrementOf(cycle.entries[0]),
  };
}

const readings = computed(() =>
  store.todayTasks.value
    .filter((task) => task.kind === "text" || task.kind === "cycle")
    .map(readingOf)
    .filter((reading): reading is Reading => reading !== null),
);

/** La paracha de la semaine, à lire avant Chabbat : « Cette semaine ». */
const weekly = computed(() => readings.value.find((reading) => reading.task.weekly) ?? null);

/** Le jour : les lectures du calendrier en tête, puis les textes, dans l'ordre du catalogue. */
const daily = computed(() => {
  const list = readings.value.filter((reading) => !reading.task.weekly);
  const cycles = list.filter((reading) => reading.objective.kind === "cycle");
  const texts = list
    .filter((reading) => reading.objective.kind === "text")
    .sort(
      (a, b) =>
        (catalogRank.get(Number(a.entries[0].id)) ?? Infinity) -
        (catalogRank.get(Number(b.entries[0].id)) ?? Infinity),
    );
  return [...cycles, ...texts];
});

// Le Yehi ratson et ses pareils : une fois pour tout ce qu'on lit du même
// corpus, la liste étant rangée dans l'ordre du catalogue, qui les tient groupés.
const textBounds = computed(() =>
  encadrementBounds(
    daily.value.filter((r) => r.objective.kind === "text").map((r) => r.entries[0]),
  ),
);

const doneCount = computed(() => daily.value.filter((reading) => reading.done).length);
const allDone = computed(() => daily.value.length > 0 && doneCount.value === daily.value.length);
const percent = computed(() =>
  daily.value.length === 0 ? 0 : Math.round((doneCount.value / daily.value.length) * 100),
);

const tab = ref<"today" | "week">("today");
watch(weekly, (reading) => {
  if (!reading) tab.value = "today";
});

const hasReading = computed(() => readings.value.length > 0);
// Double appui sur le texte : la page descend toute seule ; l'écran reste allumé.
useAutoScroll(() => hasReading.value);
useKeepAwake(() => hasReading.value);

/** Ce qu'il faut sur l'appareil pour lire tout cela sans connexion. */
const offlineEntries = computed(() => readings.value.flatMap((reading) => reading.entries));

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

/** Coche ou décoche une lecture : cochée, elle se replie ; décochée, elle se rouvre. */
function toggleDone(reading: Reading): void {
  const done = !reading.done;
  store.setDone(reading.task, today.value, done, "daily_page");
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

    <h1 class="font-display text-3xl font-bold md:text-4xl">{{ t("parcours.daily.title") }}</h1>
    <RouterLink
      :to="{ path: '/parcours/nouveau', query: { etape: 'texte' } }"
      class="add-link mt-2"
    >
      <AppIcon name="plus" :size="14" />
      {{ t("parcours.daily.add") }}
    </RouterLink>

    <!-- Rien aujourd'hui : de quoi composer sa lecture. -->
    <div v-if="!hasReading" class="flex flex-col items-center py-16 text-center">
      <AppIcon name="book" :size="32" class="mb-4 text-primary/50" />
      <p class="text-xl font-semibold">{{ t("parcours.daily.emptyTitle") }}</p>
      <p class="mt-2 max-w-sm text-text-secondary">{{ t("parcours.daily.emptyText") }}</p>
    </div>

    <template v-else>
      <OfflineTextsNotice class="mt-6" :entries="offlineEntries" />

      <!-- Aujourd'hui, et la paracha de la semaine à part ; la taille du texte. -->
      <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div v-if="weekly" class="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            :aria-selected="tab === 'today'"
            :class="{ 'is-on': tab === 'today' }"
            @click="tab = 'today'"
          >
            {{ t("parcours.daily.today") }}
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="tab === 'week'"
            :class="{ 'is-on': tab === 'week' }"
            @click="tab = 'week'"
          >
            {{ t("parcours.daily.week") }}
            <AppIcon v-if="weekly.done" name="circle-check" :size="13" />
            <span v-else class="tab-dot" />
          </button>
        </div>
        <ReadingSizeControl class="ms-auto" />
      </div>

      <!-- Cette semaine : le chnei mikra, à finir avant Chabbat. -->
      <section v-if="weekly && tab === 'week'" class="mt-8">
        <p class="text-[13px] font-semibold text-primary">{{ weekly.kicker }}</p>
        <p class="text-lg font-bold">{{ weekly.title }}</p>
        <p class="mt-1 text-xs text-text-secondary">{{ t("parcours.daily.beforeChabbat") }}</p>
        <ChneiMikraOptions class="mt-4" source="daily_reading" />
        <div class="mt-6 space-y-8">
          <DailyReadingItem
            v-for="entry in weekly.entries"
            :key="entry.id"
            :entry="entry"
            :with-targoum="true"
            :double-verses="doubleVerses"
            :with-rashi="withRashi"
          />
        </div>
        <button
          type="button"
          class="mark-btn mt-5"
          :class="{ 'is-done': weekly.done }"
          @click="toggleDone(weekly)"
        >
          <AppIcon v-if="weekly.done" name="circle-check" :size="15" />
          <span v-else class="mark-ring" />
          {{ weekly.done ? t("parcours.daily.readThisWeek") : t("parcours.daily.markRead") }}
        </button>
      </section>

      <template v-else>
        <!-- La journée : où l'on en est. -->
        <div v-if="daily.length" class="card mt-6 p-5">
          <div v-if="allDone" class="flex items-start gap-3">
            <AppIcon name="circle-check" :size="20" class="mt-0.5 text-primary" />
            <p class="font-semibold">{{ t("parcours.daily.allDone") }}</p>
          </div>
          <template v-else>
            <div class="mb-2 flex items-center justify-between">
              <span class="text-sm font-medium">
                {{ t("parcours.daily.progress", { done: doneCount, total: daily.length }) }}
              </span>
              <span class="text-sm font-semibold text-primary">{{ percent }} %</span>
            </div>
            <ProgressBar :value="percent" :label="t('parcours.daily.title')" />
          </template>
        </div>

        <div class="mt-10 space-y-12">
          <template v-for="reading in daily" :key="reading.key">
            <!-- Ce qui se dit avant : une fois, au premier texte du corpus. -->
            <ReadingEncadrement
              v-if="textBounds.get(String(reading.entries[0].id))?.before"
              :blocks="textBounds.get(String(reading.entries[0].id))!.before!"
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
                    <span class="block text-xs font-semibold text-primary">{{
                      reading.kicker
                    }}</span>
                    <span
                      class="flex items-center gap-2 text-lg font-bold group-hover:text-primary"
                    >
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
                          (reading.entries[0].totalSections ?? 1) > 1 && sectionsRead(reading) > 0
                        "
                        class="sections-chip"
                      >
                        {{ sectionsRead(reading) }}/{{ reading.entries[0].totalSections }}
                      </span>
                    </span>
                  </span>
                </button>
              </header>

              <CollapseTransition>
                <div v-show="!collapsed.has(reading.key)">
                  <ReadingEncadrement
                    v-if="reading.encadrement"
                    :blocks="reading.encadrement.before"
                    :title="t('encadrement.before')"
                  />
                  <ChneiMikraOptions v-if="reading.blocks" class="mb-5" source="daily_reading" />
                  <div class="space-y-8">
                    <template v-for="(entry, index) in reading.entries" :key="entry.id">
                      <DailyReadingItem
                        v-if="!reading.blocks || (reading.blocks[index]?.to ?? 0) > 0"
                        :entry="entry"
                        :blocks="reading.blocks?.[index]"
                        :with-targoum="reading.blocks !== undefined"
                        :double-verses="reading.blocks ? doubleVerses : false"
                        :with-rashi="reading.blocks ? withRashi : false"
                        :read-sections="sectionsToday[reading.key] ?? []"
                        @toggle-section="(i) => toggleSection(reading, i)"
                        @sections-loaded="(indexes) => sectionIndexes.set(reading.key, indexes)"
                      />
                    </template>
                  </div>
                  <ReadingEncadrement
                    v-if="reading.encadrement"
                    :blocks="reading.encadrement.after"
                    :title="t('encadrement.after')"
                  />
                  <button
                    type="button"
                    class="mark-btn mt-4"
                    :class="{ 'is-done': reading.done }"
                    @click="toggleDone(reading)"
                  >
                    <AppIcon v-if="reading.done" name="circle-check" :size="15" />
                    <span v-else class="mark-ring" />
                    {{
                      reading.done ? t("parcours.daily.readToday") : t("parcours.daily.markRead")
                    }}
                  </button>
                </div>
              </CollapseTransition>
            </article>

            <!-- Ce qui se dit après : une fois, au dernier texte du corpus. -->
            <ReadingEncadrement
              v-if="textBounds.get(String(reading.entries[0].id))?.after"
              :blocks="textBounds.get(String(reading.entries[0].id))!.after!"
              :title="t('encadrement.after')"
            />
          </template>
        </div>
      </template>

      <DailyReminderButton class="mt-12" />
    </template>

    <!-- Comme les autres textes : le menu de lecture et la progression au bas de l'écran. -->
    <template v-if="hasReading">
      <ReadingMenu :share-title="t('parcours.daily.title')" />
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
.tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
}
.tabs button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.tabs button.is-on {
  background: var(--color-brand);
  color: var(--color-on-brand);
}
.tab-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: currentColor;
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
