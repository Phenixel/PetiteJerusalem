<script setup lang="ts">
/**
 * La lecture du jour (`/bibliotheque/lecture-du-jour`) : les textes qu'on lit
 * chaque jour (un psaume, une page qu'on aime), à la suite, sur une seule
 * page. C'est le volume « Lecture du jour » de l'étagère, et la carte du
 * même nom dans la pile. Elle tient ce que savait faire la lecture
 * quotidienne d'avant Mon parcours :
 *
 *  - les textes dans l'ordre du catalogue ;
 *  - ce qui se dit avant et après (le Yehi ratson des Tehilim), une fois pour
 *    tout ce qu'on lit du même corpus (encadrementBounds) ;
 *  - un texte se coche, et se replie ; ses chapitres aussi, un à un, et le
 *    dernier coché coche le texte (les chapitres lus se gardent sur
 *    l'appareil, le temps de la journée) ;
 *  - le menu de lecture, la taille du texte, le défilement tout seul,
 *    l'écran qui reste allumé, les textes à télécharger, les rappels (dans
 *    l'app : la ligne des rappels du jour, qui ouvre « Les heures de ma
 *    journée ») ;
 *  - la liste se compose ici même : « Modifier ma liste » montre les textes
 *    du jour, chacun se retire d'un toucher, et la recherche en ajoute
 *    plusieurs d'affilée.
 *
 * Les lectures du calendrier n'y sont plus : les Tehilim du mois ou de la
 * semaine, la paracha ont chacun leur volume, leur carte et leur page. La
 * lecture quotidienne d'avant les mêlait faute de mieux.
 *
 * Ce qui se coche ici est ce que coche la pile de l'accueil : une seule
 * journée.
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
import { useEntriesTranslation } from "../../composables/useEntriesTranslation";
import { anchorToElement } from "../../composables/scrollAnchor";
import { devicePreference } from "../../services/devicePreference";
import { encadrementBounds } from "../../services/encadrementService";
import { appendHebrewNumeral } from "../../services/hebrewNumerals";
import { taskEntries } from "../../services/parcours/entries";
import { trackDayViewed } from "../../services/parcours/tracking";
import { createText } from "../../services/parcours/create";
import type { DayKey, TextObjective } from "../../services/parcours/model";
import { liveObjectives, type Task } from "../../services/parcours/schedule";
import { analyticsService } from "../../services/analyticsService";
import { haptic } from "../../services/haptics";
import { SearchService } from "../../services/searchService";
import { pageTitle, seoService } from "../../services/seoService";
import { isIsraelPlace } from "../../services/zmanimService";
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
const { place } = useZmanimLocation();
// App native : pincer dans la page agrandit le texte lu, pas la page.
useReadingPinch();

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;
/** L'ordre du catalogue : Tehilim 1, 4, 8, puis Michna, Talmud, Tanakh. */
const catalogRank = new Map<number, number>(allTexts.map((entry, i) => [Number(entry.id), i]));

const today = computed(() => store.today.value);
const il = computed(() => isIsraelPlace(place.value));

/** Un texte du jour, sur la page. */
interface Reading {
  key: string;
  task: Task;
  /** Au-dessus du nom, en petit : le livre (« Tehilim », « Pirké Avot »). */
  kicker: string;
  title: string;
  entry: TextStudyJsonEntry;
  done: boolean;
}

function readingOf(task: Task): Reading | null {
  const objective = store.data.value.objectives[task.objectiveId];
  if (objective?.kind !== "text") return null;
  const entry = taskEntries(task, objective, today.value, il.value)[0];
  if (!entry) return null;
  return {
    key: task.id,
    task,
    kicker: SearchService.formatBookName(entry.livre),
    title: appendHebrewNumeral(entry.name),
    entry,
    done: views.taskView(task, today.value).progress === "done",
  };
}

/** Les textes du jour, dans l'ordre du catalogue. */
const daily = computed(() =>
  store.todayTasks.value
    .filter((task) => task.kind === "text")
    .map(readingOf)
    .filter((reading): reading is Reading => reading !== null)
    .sort(
      (a, b) =>
        (catalogRank.get(Number(a.entry.id)) ?? Infinity) -
        (catalogRank.get(Number(b.entry.id)) ?? Infinity),
    ),
);
/** The texts' translation: its setting in the reading menu. */
const translation = useEntriesTranslation(() => daily.value.map((reading) => reading.entry));

// Le Yehi ratson et ses pareils : une fois pour tout ce qu'on lit du même
// corpus, la liste étant rangée dans l'ordre du catalogue, qui les tient groupés.
const textBounds = computed(() => encadrementBounds(daily.value.map((r) => r.entry)));

const doneCount = computed(() => daily.value.filter((reading) => reading.done).length);
const allDone = computed(() => daily.value.length > 0 && doneCount.value === daily.value.length);
const percent = computed(() =>
  daily.value.length === 0 ? 0 : Math.round((doneCount.value / daily.value.length) * 100),
);

// --- La liste : les textes du jour, à retirer ou à ajouter, sur la page même. ---

/** Les textes du jour pris, dans l'ordre du catalogue. */
const textObjectives = computed(() =>
  liveObjectives(store.data.value)
    .filter((objective): objective is TextObjective => objective.kind === "text")
    .sort(
      (a, b) => (catalogRank.get(a.textId) ?? Infinity) - (catalogRank.get(b.textId) ?? Infinity),
    ),
);
const takenTexts = computed(() => textObjectives.value.map((objective) => objective.textId));
/** « Mes Tehilim journaliers » quand ce ne sont que des psaumes, sinon « Lecture du jour ». */
const name = computed(() => views.dailyName(takenTexts.value));

/** La liste ouverte : d'office quand il n'y a encore rien à lire. */
const editing = ref(false);
/** The reminders of the day, opened from the line at the bottom (in the app). */
const remindersOpen = ref(false);
watch(
  () => textObjectives.value.length === 0,
  (empty) => {
    if (empty) editing.value = true;
  },
  { immediate: true },
);

function removeText(objective: TextObjective): void {
  store.removeObjective(objective.id);
  analyticsService.capture("parcours_objective_removed", { kind: "text", source: "daily_page" });
}

/** La recherche repart vide une fois ses textes ajoutés. */
const searchKey = ref(0);
function addTexts(entries: TextStudyJsonEntry[]): void {
  const now = Date.now();
  entries.forEach((entry, i) => {
    const objective = createText(Number(entry.id), today.value, now + i);
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
// Double appui sur le texte : la page descend toute seule ; l'écran reste allumé.
useAutoScroll(() => hasReading.value);
useKeepAwake(() => hasReading.value);

/** Ce qu'il faut sur l'appareil pour lire tout cela sans connexion. */
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

    <h1 class="font-display text-3xl font-bold md:text-4xl">{{ name.title }}</h1>
    <!-- Composer sa liste, et la taille du texte comme dans le lecteur. -->
    <div class="mt-3 flex min-h-11 flex-wrap items-center justify-between gap-3">
      <button
        v-if="textObjectives.length"
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
      <ul v-if="textObjectives.length" class="card divide-y divide-line overflow-hidden">
        <li
          v-for="objective in textObjectives"
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
            @click="removeText(objective)"
          >
            <AppIcon name="x" :size="16" />
          </button>
        </li>
      </ul>
      <p class="mt-5 text-[15px] font-bold">{{ t("parcours.daily.addTitle") }}</p>
      <StepText :key="searchKey" class="mt-2" :taken="takenTexts" @pick="addTexts" />
    </section>

    <!-- Rien aujourd'hui : de quoi composer sa lecture. -->
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
