<script setup lang="ts">
/**
 * « Mes Téhilim » ("My Tehilim", `/share-reading/session/:slug/lecture`):
 * every psalm the reader took in a Tehilim chain, one after the other, on a
 * single page. It reads like the daily reading of Mon parcours
 * (LectureDuJourPage): the Yehi ratson once before, the three verses once
 * after, the reading menu, the text size, automatic scrolling.
 *
 * Each psalm is marked read right where it is read, and the list on the side
 * (at the top on a phone) checks them off without scrolling: what is checked
 * is the reservation itself, as with the switch of the chain's list. Nothing
 * goes to Mon parcours. See services/sessionBatchReading.ts.
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import type { Session } from "../../models/models";
import { sessionService } from "../../services/sessionService";
import { reservationService, ReservationGoneError } from "../../services/reservationService";
import { authService, type User } from "../../services/authService";
import {
  batchReadings,
  supportsBatchReading,
  type BatchReading,
} from "../../services/sessionBatchReading";
import { encadrementBounds } from "../../services/encadrementService";
import { appendHebrewNumeral } from "../../services/hebrewNumerals";
import { SearchService } from "../../services/searchService";
import { analyticsService } from "../../services/analyticsService";
import { haptic } from "../../services/haptics";
import { pageTitle, seoService } from "../../services/seoService";
import { SITE_URL } from "../../config/site";
import { useToast } from "../../composables/useToast";
import { useReadingPinch } from "../../composables/useReadingPinch";
import { useAutoScroll } from "../../composables/useAutoScroll";
import { useKeepAwake } from "../../composables/useKeepAwake";
import { anchorToElement } from "../../composables/scrollAnchor";
import AppIcon from "../../components/icons/AppIcon.vue";
import CollapseTransition from "../../components/CollapseTransition.vue";
import ProgressBar from "../../components/ProgressBar.vue";
import ReadingEncadrement from "../../components/ReadingEncadrement.vue";
import ReadingMenu from "../../components/ReadingMenu.vue";
import ReadingProgressBar from "../../components/ReadingProgressBar.vue";
import ReadingSizeControl from "../../components/ReadingSizeControl.vue";
import DailyReadingItem from "../Library/DailyReadingItem.vue";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const toast = useToast();
// Native app: pinching the page enlarges the text, not the page.
useReadingPinch();

const session = ref<Session | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);
const currentUser = ref<User | null>(null);
let unsubscribeAuth: (() => void) | null = null;

const sessionPath = computed(
  () => `/share-reading/session/${session.value?.slug ?? (route.params.slug as string)}`,
);

/** The reader's psalms, in the order of the book. */
const readings = computed(() => batchReadings(session.value, currentUser.value));

const keyOf = (reading: BatchReading) => reading.reservation.id;
const titleOf = (reading: BatchReading) => appendHebrewNumeral(reading.entry.name);
const kickerOf = (reading: BatchReading) => SearchService.formatBookName(reading.entry.livre);

// The Yehi ratson and the closing verses: once for all the psalms read.
const textBounds = computed(() => encadrementBounds(readings.value.map((r) => r.entry)));

const doneCount = computed(() => readings.value.filter((r) => r.reservation.isCompleted).length);
const allDone = computed(
  () => readings.value.length > 0 && doneCount.value === readings.value.length,
);
const percent = computed(() =>
  readings.value.length === 0 ? 0 : Math.round((doneCount.value / readings.value.length) * 100),
);

const hasReading = computed(() => readings.value.length > 0);
// Double tap on the text: the page scrolls by itself; the screen stays on.
useAutoScroll(() => hasReading.value);
useKeepAwake(() => hasReading.value);

// --- Folding a psalm: its title tapped, or the psalm marked read. ---
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

/** The list on the side: a name tapped goes to its psalm, unfolded. */
function goTo(reading: BatchReading): void {
  const key = keyOf(reading);
  setCollapsed(key, false);
  articles.get(key)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Marks a psalm read, or not read anymore. Optimistic, as on the chain's
 * page: the check shows at once and goes back if the write fails. Read, the
 * psalm folds; unchecked, it opens again.
 */
async function toggleDone(reading: BatchReading, source: "text" | "list"): Promise<void> {
  const current = session.value;
  if (!current) return;
  const { reservation } = reading;
  const key = keyOf(reading);
  const previous = reservation.isCompleted;
  const done = !previous;
  reservation.isCompleted = done;
  haptic(done ? "done" : "undo");
  setCollapsed(key, done);
  if (done && source === "text") anchorToElement(articles.get(key) ?? null);
  const finished = done && allDone.value;

  try {
    await reservationService.markReservationAsCompleted(current.id, reservation.id, done);
    analyticsService.capture("section_marked_read", {
      session_id: current.id,
      marked: done,
      is_guest: currentUser.value == null,
      source: "batch_reading",
    });
    if (finished) {
      analyticsService.capture("session_batch_reading_completed", {
        session_id: current.id,
        texts_count: readings.value.length,
        is_guest: currentUser.value == null,
      });
    }
  } catch (err) {
    console.error("Error while marking a psalm read:", err);
    reservation.isCompleted = previous;
    setCollapsed(key, previous);
    analyticsService.capture("section_mark_read_failed", {
      session_id: current.id,
      is_guest: currentUser.value == null,
      error_message: err instanceof Error ? err.message : String(err),
      source: "batch_reading",
    });
    // The slot was taken back (expired draw, the creator's cleanup): it
    // leaves the list, and the message says so (errors.reservationGone).
    if (err instanceof ReservationGoneError) {
      const index = current.reservations.findIndex((r) => r.id === reservation.id);
      if (index > -1) current.reservations.splice(index, 1);
    }
    toast.errorFromException(err, t("detailSession.updateError"));
  }
}

const loadSession = async () => {
  try {
    isLoading.value = true;
    error.value = null;
    const slugOrId = route.params.slug as string;
    const data = slugOrId ? await sessionService.resolveSession(slugOrId) : null;
    if (!data) {
      error.value = t("detailSession.notFound");
      return;
    }
    // Only Tehilim chains read at once: any other goes back to its page.
    if (!supportsBatchReading(data)) {
      void router.replace(`/share-reading/session/${data.slug ?? data.id}`);
      return;
    }
    if (!Array.isArray(data.reservations)) data.reservations = [];
    session.value = data;
    seoService.setMeta({
      title: pageTitle(`${t("sessionReading.title")} · ${data.name}`),
      description: t("sessionReading.intro"),
      // The reader's own list: the chain's page is the one to index.
      canonical: `${SITE_URL}/share-reading/session/${data.slug ?? data.id}`,
      robots: "noindex",
    });
  } catch (err) {
    console.error("Error while loading the chain:", err);
    error.value = t("detailSession.loadError");
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  unsubscribeAuth = authService.onAuthChanged((user) => {
    currentUser.value = user;
  });
  void loadSession();
});

onUnmounted(() => unsubscribeAuth?.());
</script>

<template>
  <main class="mx-auto w-full max-w-5xl px-6 pb-16 pt-[18px] md:py-12">
    <RouterLink :to="sessionPath" class="back-link mb-5">
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ session?.name ?? t("sessionReading.backToSession") }}
    </RouterLink>

    <div
      v-if="isLoading && !session"
      class="flex flex-col items-center justify-center py-16 text-text-secondary"
    >
      <div
        class="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary"
      ></div>
      <p class="animate-pulse font-medium">{{ t("detailSession.loadingSession") }}</p>
    </div>

    <div v-else-if="error" class="flex flex-col items-center justify-center py-16 text-center">
      <AppIcon name="alert-triangle" :size="32" class="mb-4 text-red-500" />
      <p class="mb-6 font-medium text-text-primary">{{ error }}</p>
      <button type="button" class="btn btn-soft" @click="loadSession">
        {{ t("common.retry") }}
      </button>
    </div>

    <template v-else-if="session">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="min-w-0">
          <h1 class="font-display text-3xl font-bold md:text-4xl">
            {{ t("sessionReading.title") }}
          </h1>
          <p class="mt-2 max-w-xl text-text-secondary">{{ t("sessionReading.intro") }}</p>
        </div>
        <ReadingSizeControl v-if="hasReading" />
      </div>

      <!-- Nothing taken in this chain (or no longer): back to it. -->
      <div v-if="!hasReading" class="flex flex-col items-center py-16 text-center">
        <AppIcon name="book" :size="32" class="mb-4 text-primary/50" />
        <p class="text-xl font-semibold">{{ t("sessionReading.emptyTitle") }}</p>
        <p class="mt-2 max-w-sm text-text-secondary">{{ t("sessionReading.emptyText") }}</p>
        <RouterLink :to="sessionPath" class="btn btn-primary mt-6">
          {{ t("sessionReading.backToSession") }}
        </RouterLink>
      </div>

      <div v-else class="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-10">
        <!-- The list: where one stands, and each psalm checked in one tap.
             On the side on a wide screen, at the top on a phone. -->
        <aside class="lg:order-2">
          <div class="card p-5 lg:sticky lg:top-24">
            <div v-if="allDone" class="flex items-start gap-3">
              <AppIcon name="circle-check" :size="20" class="mt-0.5 shrink-0 text-primary" />
              <p class="font-semibold">{{ t("sessionReading.allDone") }}</p>
            </div>
            <template v-else>
              <div class="mb-2 flex items-center justify-between">
                <span class="text-sm font-medium">
                  {{ t("sessionReading.progress", { done: doneCount, total: readings.length }) }}
                </span>
                <span class="text-sm font-semibold text-primary">{{ percent }} %</span>
              </div>
              <ProgressBar :value="percent" :label="t('sessionReading.title')" />
            </template>

            <ul class="mt-4 divide-y divide-line">
              <li v-for="reading in readings" :key="keyOf(reading)" class="flex items-center gap-2">
                <button
                  type="button"
                  class="check-btn"
                  :class="{ 'is-done': reading.reservation.isCompleted }"
                  :aria-pressed="reading.reservation.isCompleted"
                  :aria-label="t('sessionReading.markReadNamed', { name: titleOf(reading) })"
                  @click="toggleDone(reading, 'list')"
                >
                  <AppIcon v-if="reading.reservation.isCompleted" name="circle-check" :size="20" />
                  <span v-else class="check-ring" />
                </button>
                <button
                  type="button"
                  class="min-h-11 min-w-0 flex-1 truncate text-start text-[15px] font-semibold hover:text-primary"
                  :class="{ 'text-text-secondary': reading.reservation.isCompleted }"
                  @click="goTo(reading)"
                >
                  {{ titleOf(reading) }}
                </button>
              </li>
            </ul>

            <RouterLink v-if="allDone" :to="sessionPath" class="btn btn-soft mt-4 w-full">
              {{ t("sessionReading.backToSession") }}
            </RouterLink>
          </div>
        </aside>

        <div class="mt-10 space-y-12 lg:order-1 lg:mt-0">
          <template v-for="reading in readings" :key="keyOf(reading)">
            <!-- What is said before: once, at the first psalm. -->
            <ReadingEncadrement
              v-if="textBounds.get(String(reading.entry.id))?.before"
              :blocks="textBounds.get(String(reading.entry.id))!.before!"
              :title="t('encadrement.before')"
            />

            <article
              :ref="(el) => setArticle(keyOf(reading), el)"
              class="scroll-mt-24"
              :class="{ 'opacity-60': reading.reservation.isCompleted }"
            >
              <header class="mb-4">
                <button
                  type="button"
                  class="group flex w-full items-start gap-3 text-start"
                  :aria-expanded="!collapsed.has(keyOf(reading))"
                  @click="toggleCollapse(keyOf(reading))"
                >
                  <AppIcon
                    name="chevron-down"
                    :size="13"
                    class="mt-1.5 text-text-secondary/60 transition-transform duration-200"
                    :class="{ '-rotate-90': collapsed.has(keyOf(reading)) }"
                  />
                  <span class="min-w-0">
                    <span class="block text-xs font-semibold text-primary">
                      {{ kickerOf(reading) }}
                    </span>
                    <span
                      class="flex items-center gap-2 text-lg font-bold group-hover:text-primary"
                    >
                      {{ titleOf(reading) }}
                      <AppIcon
                        v-if="reading.reservation.isCompleted"
                        name="circle-check"
                        :size="15"
                        class="text-primary"
                      />
                    </span>
                  </span>
                </button>
              </header>

              <CollapseTransition>
                <div v-show="!collapsed.has(keyOf(reading))">
                  <DailyReadingItem :entry="reading.entry" source="session_batch_reading" />
                  <button
                    type="button"
                    class="mark-btn mt-4"
                    :class="{ 'is-done': reading.reservation.isCompleted }"
                    @click="toggleDone(reading, 'text')"
                  >
                    <AppIcon
                      v-if="reading.reservation.isCompleted"
                      name="circle-check"
                      :size="15"
                    />
                    <span v-else class="mark-ring" />
                    {{
                      reading.reservation.isCompleted
                        ? t("sessionReading.read")
                        : t("sessionReading.markRead")
                    }}
                  </button>
                </div>
              </CollapseTransition>
            </article>

            <!-- What is said after: once, at the last psalm. -->
            <ReadingEncadrement
              v-if="textBounds.get(String(reading.entry.id))?.after"
              :blocks="textBounds.get(String(reading.entry.id))!.after!"
              :title="t('encadrement.after')"
            />
          </template>
        </div>
      </div>
    </template>

    <!-- Like the other texts: the reading menu and the progress at the bottom of the screen. -->
    <template v-if="hasReading">
      <ReadingMenu :share-title="t('sessionReading.title')" />
      <ReadingProgressBar />
    </template>
  </main>
</template>

<style scoped>
.check-btn {
  display: grid;
  flex: none;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: var(--radius-pill);
  color: var(--color-text-secondary);
}
.check-btn:hover,
.check-btn.is-done {
  color: var(--color-primary);
}
.check-ring {
  width: 18px;
  height: 18px;
  border: 2px solid currentColor;
  border-radius: var(--radius-pill);
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
</style>
