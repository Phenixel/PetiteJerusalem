<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { localeMessagesReady } from "../../i18n";
import { appendHebrewNumeral } from "../../services/hebrewNumerals";
import { pageTitle, seoService } from "../../services/seoService";
import { psalmsLabel, useTehilimDay } from "../../composables/useTehilimDay";
import { analyticsService } from "../../services/analyticsService";
import { useReadingPinch } from "../../composables/useReadingPinch";
import { useAutoScroll } from "../../composables/useAutoScroll";
import { useKeepAwake } from "../../composables/useKeepAwake";
import { useEntriesTranslation } from "../../composables/useEntriesTranslation";
import { useTehilimCycleTask } from "../../composables/useTehilimCycleTask";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { anchorToElement } from "../../composables/scrollAnchor";
import { localDayFrom } from "../../services/dateService";
import AppIcon from "../../components/icons/AppIcon.vue";
import BookEncadrement from "../../components/BookEncadrement.vue";
import CollapseTransition from "../../components/CollapseTransition.vue";
import ProgressBar from "../../components/ProgressBar.vue";
import ReadingMenu from "../../components/ReadingMenu.vue";
import ReadingProgressBar from "../../components/ReadingProgressBar.vue";
import ReadingSizeControl from "../../components/ReadingSizeControl.vue";
import DailyReadingItem from "./DailyReadingItem.vue";
import { SITE_URL } from "../../config/site";

/**
 * Les Tehilim du jour : les psaumes du cycle mensuel, les uns sous les autres.
 *
 * La bibliothèque les annonçait par une rangée de numéros, chacun menant à sa
 * page : lire les quinze psaumes d'un 5 du mois demandait quinze allers-retours.
 * Ils se lisent d'une traite, comme le chnei mikra, et cette page les donne
 * d'une traite. La bibliothèque, elle, garde son catalogue.
 *
 * Le jour est celui du mois hébraïque, calculé sur l'appareil : la page n'a
 * rien à charger pour savoir quoi montrer.
 *
 * Opened from a Tehilim cycle of Mon parcours (`?objectif=`, the card of the
 * home stack or the volume of the shelf), the page reads that cycle's psalms
 * for the day of Mon parcours (the month's or the week's), and each psalm is
 * marked read on its own: a marked psalm folds away, and the last one marks
 * the day's task (useTehilimCycleTask). Without it, the page stays the
 * library's reading, with nothing to mark.
 */

const { t, locale } = useI18n();
// App native : pincer dans la page agrandit le texte lu, pas la page.
useReadingPinch();

/**
 * Le jour hébraïque (il bascule à la chkia du lieu des horaires), relu quand
 * la page revient à l'écran : une app qu'on laisse ouverte et qu'on rouvre le
 * lendemain proposerait sinon les psaumes de la veille. Pendant la lecture,
 * en revanche, rien ne change sous les yeux (`live: false`) : le jour ne
 * bascule qu'entre deux passages.
 */
const { cycle: libraryCycle } = useTehilimDay({ live: false });

const route = useRoute();
const views = useParcoursViews();
const tracked = useTehilimCycleTask(() =>
  typeof route.query.objectif === "string" ? route.query.objectif : null,
);
/** The cycle of Mon parcours the page was opened from, if any. */
const objective = tracked.objective;
/** The psalms on the page: the objective's, or the library's day of the month. */
const cycle = computed(() => tracked.cycle.value ?? libraryCycle.value);
/** Each psalm marked on its own: only for a cycle with a task today. */
const marking = computed(() => tracked.task.value !== null);

/** The psalms' translation: its setting in the reading menu. */
const translation = useEntriesTranslation(() => cycle.value.entries);

// Double appui sur le texte : la page descend toute seule, à l'allure choisie
// dans la pastille du bas (AutoScrollPill).
useAutoScroll(() => cycle.value.entries.length > 0);

// L'écran ne s'éteint pas tant que les Tehilim du jour sont à l'écran.
useKeepAwake(() => cycle.value.entries.length > 0);

const rangeLabel = computed(() => psalmsLabel(cycle.value.psalms, t));

const title = computed(() =>
  objective.value ? views.objectiveTitle(objective.value) : t("tehilimDay.title"),
);
const hint = computed(() =>
  objective.value?.cycle === "tehilim-week" ? t("tehilimDay.weekHint") : t("tehilimDay.hint"),
);
/** Under the psalms' range: the day of the month, or the day of the week. */
const dayLabel = computed(() => {
  if (objective.value?.cycle !== "tehilim-week") {
    return t("tehilimDay.dayOfMonth", { day: cycle.value.day });
  }
  const date = localDayFrom(tracked.today.value) ?? new Date();
  const weekday = new Intl.DateTimeFormat(locale.value, { weekday: "long" }).format(date);
  return weekday.charAt(0).toLocaleUpperCase(locale.value) + weekday.slice(1);
});

// --- Marking each psalm, when the page carries a cycle of Mon parcours. ---
const total = computed(() => cycle.value.entries.length);
const allRead = computed(() => total.value > 0 && tracked.readCount.value === total.value);
const percent = computed(() =>
  total.value === 0 ? 0 : Math.round((tracked.readCount.value / total.value) * 100),
);

const collapsed = ref<Set<string>>(new Set());
const sections = new Map<string, HTMLElement>();
function setSection(key: string, el: unknown): void {
  if (el instanceof HTMLElement) sections.set(key, el);
  else sections.delete(key);
}
function setCollapsed(key: string, value: boolean): void {
  const next = new Set(collapsed.value);
  if (value) next.add(key);
  else next.delete(key);
  collapsed.value = next;
}

/** Marks or unmarks a psalm: marked, it folds away; unmarked, it opens again. */
function togglePsalm(id: string): void {
  const read = tracked.toggle(Number(id));
  setCollapsed(id, read);
  if (read) anchorToElement(sections.get(id) ?? null);
}

function applySeoMeta() {
  seoService.setMeta({
    title: pageTitle(`${title.value} · ${rangeLabel.value}`),
    description: t("tehilimDay.pageDescription"),
    canonical: SITE_URL + "/bibliotheque/tehilim-du-jour",
  });
}

// Rejoué au changement de langue : les messages en et he arrivent par import
// dynamique, parfois après le montage.
watch([title, rangeLabel, locale, localeMessagesReady], applySeoMeta, { immediate: true });

onMounted(() => {
  analyticsService.capture("tehilim_day_page_viewed", {
    day: cycle.value.day,
    psalms_count: cycle.value.psalms.length,
    cycle: objective.value?.cycle ?? null,
  });
});
</script>

<template>
  <main class="mx-auto px-6 py-12">
    <div class="max-w-3xl mx-auto">
      <!-- From Mon parcours, back home, where the card came from. -->
      <RouterLink v-if="objective" to="/" class="back-link mb-4">
        <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
        {{ t("common.home") }}
      </RouterLink>
      <RouterLink v-else to="/bibliotheque/tehilim" class="back-link mb-4">
        <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
        {{ t("study.types.tehilim") }}
      </RouterLink>

      <h1 class="text-3xl md:text-4xl font-bold text-text-primary tracking-tight pb-1">
        {{ title }}
      </h1>
      <p class="mt-2 text-text-secondary">{{ hint }}</p>

      <template v-if="cycle.entries.length">
        <div class="mt-8 flex items-end justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-xl font-bold text-text-primary">{{ rangeLabel }}</p>
            <p class="text-sm text-text-secondary">{{ dayLabel }}</p>
          </div>

          <!-- Taille du texte (même réglage que le lecteur de la bibliothèque) -->
          <ReadingSizeControl />
        </div>

        <!-- Ce qu'on dit avant de lire des Tehilim : une fois, en tête des
             psaumes du jour (voir EncadrementPlace). Ce qui se dit après les
             attend en bas de page, là où la lecture se termine. -->
        <!-- From Mon parcours: where the day stands, psalm by psalm. -->
        <div v-if="marking" class="card mt-6 p-5">
          <p v-if="allRead" class="font-semibold">{{ t("parcours.daily.allDone") }}</p>
          <template v-else>
            <div class="mb-2 flex items-center justify-between">
              <span class="text-sm font-medium">
                {{ t("parcours.daily.progress", { done: tracked.readCount.value, total }) }}
              </span>
              <span class="text-sm font-semibold text-primary">{{ percent }} %</span>
            </div>
            <ProgressBar :value="percent" :label="title" />
          </template>
        </div>

        <BookEncadrement corpus="tehilim" part="before" class="mt-6" />

        <!-- Le jour a basculé pendant que la page était de côté : on remonte
             des composants neufs plutôt que de recycler ceux de la veille,
             marque-pages compris. -->
        <div :key="cycle.day" class="mt-8 space-y-10">
          <section
            v-for="entry in cycle.entries"
            :key="entry.id"
            :ref="(el) => setSection(String(entry.id), el)"
            :class="{ 'opacity-60': marking && tracked.isRead(Number(entry.id)) }"
          >
            <!-- A psalm to mark: its title folds it, like the daily reading. -->
            <button
              v-if="marking"
              type="button"
              class="group mb-4 flex w-full items-center gap-3 text-start"
              :aria-expanded="!collapsed.has(String(entry.id))"
              @click="setCollapsed(String(entry.id), !collapsed.has(String(entry.id)))"
            >
              <AppIcon
                name="chevron-down"
                :size="13"
                class="text-text-secondary/60 transition-transform duration-200"
                :class="{ '-rotate-90': collapsed.has(String(entry.id)) }"
              />
              <span
                class="flex items-center gap-2 text-lg font-bold text-text-primary group-hover:text-primary"
              >
                {{ appendHebrewNumeral(entry.name) }}
                <AppIcon
                  v-if="tracked.isRead(Number(entry.id))"
                  name="circle-check"
                  :size="15"
                  class="text-primary"
                />
              </span>
            </button>
            <h2 v-else class="mb-4 text-lg font-bold text-text-primary">
              {{ appendHebrewNumeral(entry.name) }}
            </h2>
            <CollapseTransition>
              <div v-show="!collapsed.has(String(entry.id))">
                <DailyReadingItem :entry="entry" source="library_tehilim_day" />
                <button
                  v-if="marking"
                  type="button"
                  class="mark-btn mt-4"
                  :class="{ 'is-done': tracked.isRead(Number(entry.id)) }"
                  @click="togglePsalm(String(entry.id))"
                >
                  <AppIcon v-if="tracked.isRead(Number(entry.id))" name="circle-check" :size="15" />
                  <span v-else class="mark-ring" />
                  {{
                    tracked.isRead(Number(entry.id))
                      ? t("parcours.daily.readToday")
                      : t("parcours.daily.markRead")
                  }}
                </button>
              </div>
            </CollapseTransition>
          </section>
        </div>

        <!-- Le dernier psaume dit, ce qui se dit après la lecture. -->
        <BookEncadrement corpus="tehilim" part="after" class="mt-10" />
      </template>

      <p v-else class="mt-10 text-text-secondary">{{ t("tehilimDay.unavailable") }}</p>
    </div>

    <!-- Comme les autres textes de la bibliothèque : le menu de lecture et la
         progression au bas de l'écran. -->
    <ReadingMenu
      :translation-langs="translation.langs.value"
      :translation-lang="translation.lang.value"
    />
    <ReadingProgressBar />
  </main>
</template>

<style scoped>
/* Marking a psalm read: the same button as the daily reading (LectureDuJourPage). */
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
</style>
