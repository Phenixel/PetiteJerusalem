<script setup lang="ts">
/**
 * « Hors ligne », en bas de l'étude (app native) : tout télécharger d'un
 * geste, savoir avant combien il reste, et pendant, où l'on en est.
 *
 * Le bouton vivait en tête de la bibliothèque, entre la recherche et
 * l'étagère : il prenait la place de ce qu'on vient chercher pour une action
 * qu'on fait une fois. Il devient une ligne, comme celles d'« Aujourd'hui »,
 * en bas de page ; les livres de l'étagère, eux, disent dans leur angle s'ils
 * sont sur le téléphone (LibraryShelf).
 *
 * Avant : la taille à télécharger (une estimation, les livres n'ayant pas
 * encore de taille sur l'appareil). Pendant : le pourcentage en grand au bout
 * de la ligne, et le temps restant, déduit de la vitesse depuis le début.
 * Après : ce que tout cela occupe, et la corbeille.
 *
 * Seule l'étude se télécharge ici : le Sidour et les brahot sont dans l'app,
 * et les textes des fêtes se téléchargent d'eux-mêmes le temps de la fête.
 */
import { computed, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import { bulkDownload, useBookDownload } from "../composables/useBookDownload";
import { useConfirm } from "../composables/useConfirm";
import { useToast } from "../composables/useToast";
import { prefersLessMotion } from "../composables/useMotion";
import {
  approxBytesOfBooks,
  downloadedBytesOf,
  isBookDownloaded,
  removeBooks,
  type OfflineBook,
} from "../services/offlineLibraryService";
import { analyticsService } from "../services/analyticsService";

const props = defineProps<{
  /** Les livres de l'étude qui se téléchargent (embarqués exclus). */
  books: OfflineBook[];
  /**
   * Ce qui est sur le téléphone sans être de l'étude : les textes du Sidour
   * téléchargés à part (ceux d'une fête, d'anciennes copies des brahot). Ils
   * n'ont plus d'autre endroit où se supprimer : la corbeille les libère
   * avec le reste, et leur poids compte dans la place prise.
   */
  alsoRemovable?: OfflineBook[];
}>();

const { t, locale } = useI18n();
const { confirm } = useConfirm();
const toast = useToast();
const { downloadAll } = useBookDownload();

const missing = computed(() => props.books.filter((book) => !isBookDownloaded(book)));
const removable = computed(() => [...props.books, ...(props.alsoRemovable ?? [])]);
const usedBytes = computed(() => downloadedBytesOf(removable.value));
const remainingBytes = computed(() => approxBytesOfBooks(missing.value));

const running = computed(() => bulkDownload.active);
const allDone = computed(() => !running.value && missing.value.length === 0);

/** « 12,3 Mo » dans la langue de l'app, l'unité collée au nombre. */
function size(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  const format = (n: number, digits: number) =>
    new Intl.NumberFormat(locale.value, { maximumFractionDigits: digits }).format(n);
  if (mb >= 1) return t("study.offline.mb", { n: format(mb, mb < 10 ? 1 : 0) });
  return t("study.offline.kb", { n: format(Math.max(1, bytes / 1024), 0) });
}

const idleLine = computed(() =>
  usedBytes.value > 0
    ? t("study.offline.remainingWithUsed", {
        size: size(remainingBytes.value),
        used: size(usedBytes.value),
      })
    : t("study.offline.remaining", { size: size(remainingBytes.value) }),
);

// --- Pendant le téléchargement ---
// Une horloge à la seconde, le temps du lot seulement.
const tick = ref(Date.now());
let clock: ReturnType<typeof setInterval> | null = null;
watch(
  running,
  (active) => {
    if (active && !clock) clock = setInterval(() => (tick.value = Date.now()), 1000);
    if (!active && clock) {
      clearInterval(clock);
      clock = null;
    }
  },
  { immediate: true },
);
onUnmounted(() => clock && clearInterval(clock));

const progress = computed(() =>
  bulkDownload.bytesTotal > 0 ? Math.min(1, bulkDownload.bytesDone / bulkDownload.bytesTotal) : 0,
);
const percent = computed(() => Math.round(progress.value * 100));

/**
 * Le temps restant, à la vitesse tenue depuis le début du lot. Rien tant
 * qu'aucun livre n'est arrivé (pas de vitesse à mesurer), puis arrondi à cinq
 * secondes, ou à la minute au-delà d'une minute et demie, pour ne pas danser
 * à chaque seconde.
 */
const etaLine = computed(() => {
  const elapsed = (tick.value - bulkDownload.startedAt) / 1000;
  if (bulkDownload.bytesDone <= 0 || elapsed < 1) return t("study.offline.estimating");
  const rate = bulkDownload.bytesDone / elapsed;
  const seconds = (bulkDownload.bytesTotal - bulkDownload.bytesDone) / rate;
  if (seconds < 5) return t("study.offline.etaFew");
  if (seconds < 90) return t("study.offline.etaSeconds", { n: Math.round(seconds / 5) * 5 });
  return t("study.offline.etaMinutes", { n: Math.round(seconds / 60) });
});
const progressLine = computed(() =>
  t("study.offline.progress", {
    done: size(bulkDownload.bytesDone),
    total: size(bulkDownload.bytesTotal),
  }),
);

// --- Le geste, et sa réponse ---
// La flèche plonge vers son plateau au toucher ; à la fin d'un lot lancé
// d'ici, la coche se trace. Rien ne bouge à l'arrivée sur la page.
const pressed = ref(false);
const justFinished = ref(false);
watch(running, (active, was) => {
  if (was && !active && missing.value.length === 0 && !prefersLessMotion()) {
    justFinished.value = true;
    setTimeout(() => (justFinished.value = false), 900);
  }
});

function start() {
  if (running.value) return;
  if (!prefersLessMotion()) {
    pressed.value = true;
    setTimeout(() => (pressed.value = false), 450);
  }
  void downloadAll(missing.value, "Tout");
}

const removing = ref(false);
async function removeAll() {
  if (removing.value) return;
  const books = removable.value.filter((book) => isBookDownloaded(book));
  if (books.length === 0) return;
  // La corbeille est discrète : c'est la fenêtre qui dit ce qui va partir, et
  // ce qui reste accessible ensuite.
  const confirmed = await confirm({
    title: t("downloads.deleteAllTitle"),
    message: t("downloads.deleteAllExplain", books.length),
    confirmLabel: t("common.delete"),
    danger: true,
  });
  if (!confirmed) return;
  removing.value = true;
  try {
    await removeBooks(books);
    analyticsService.capture("offline_download_deleted", {
      scope: "all",
      tab: "Tout",
      books_count: books.length,
    });
    toast.success(t("downloads.deleteAllDone"));
  } catch (e) {
    analyticsService.capture("offline_download_delete_failed", {
      scope: "all",
      tab: "Tout",
      books_count: books.length,
      error_message: e instanceof Error ? e.message : String(e),
    });
    toast.error(t("downloads.deleteError"));
  } finally {
    removing.value = false;
  }
}
</script>

<template>
  <section v-if="books.length > 0">
    <h2 class="mb-2 ms-1 text-sm font-semibold text-text-secondary">
      {{ t("study.offline.title") }}
    </h2>
    <div class="card overflow-hidden">
      <Transition name="offline-swap" mode="out-in">
        <!-- Pendant : le pourcentage en grand, au bout de la ligne. -->
        <div v-if="running" key="running" class="offline-row" role="status">
          <AppIcon name="spinner" :size="21" class="shrink-0 text-primary animate-spin" />
          <span class="flex flex-1 flex-col gap-0.5 min-w-0">
            <span class="font-semibold text-text-primary">
              {{ t("study.offline.downloading") }}
            </span>
            <span class="text-sm text-text-secondary">{{ etaLine }} · {{ progressLine }}</span>
          </span>
          <span class="shrink-0 text-2xl font-bold leading-none tabular-nums text-primary">
            {{ percent }}<span class="text-base">%</span>
          </span>
        </div>

        <!-- Après : ce que tout occupe, et la corbeille. -->
        <div v-else-if="allDone" key="done" class="flex items-center">
          <div class="offline-row flex-1">
            <svg
              class="offline-check shrink-0 text-primary"
              :class="{ 'offline-check-draw': justFinished }"
              width="21"
              height="21"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path class="offline-check-tick" d="m9 12 2 2 4-4" />
            </svg>
            <span class="flex flex-col gap-0.5 min-w-0">
              <span class="font-semibold text-text-primary">
                {{ t("downloads.allDownloaded") }}
              </span>
              <span class="text-sm text-text-secondary">
                {{ t("study.offline.used", { size: size(usedBytes) }) }}
              </span>
            </span>
          </div>
          <button
            type="button"
            class="icon-btn me-2 hover:text-red-600 dark:hover:text-red-400"
            :disabled="removing"
            :title="t('downloads.deleteAll')"
            :aria-label="t('downloads.deleteAll')"
            @click="removeAll"
          >
            <AppIcon v-if="removing" name="spinner" :size="16" class="animate-spin" />
            <AppIcon v-else name="trash" :size="16" />
          </button>
        </div>

        <!-- Avant : la ligne entière lance le téléchargement. -->
        <div v-else key="idle" class="flex items-center">
          <button type="button" class="offline-row press-feedback flex-1 text-start" @click="start">
            <span
              class="offline-arrow shrink-0 text-primary"
              :class="{ 'offline-arrow-drop': pressed }"
            >
              <AppIcon name="download" :size="21" />
            </span>
            <span class="flex flex-col gap-0.5 min-w-0">
              <span class="font-semibold text-text-primary">{{ t("downloads.downloadAll") }}</span>
              <span class="text-sm text-text-secondary">{{ idleLine }}</span>
            </span>
          </button>
          <button
            v-if="usedBytes > 0"
            type="button"
            class="icon-btn me-2 hover:text-red-600 dark:hover:text-red-400"
            :disabled="removing"
            :title="t('downloads.deleteAll')"
            :aria-label="t('downloads.deleteAll')"
            @click="removeAll"
          >
            <AppIcon v-if="removing" name="spinner" :size="16" class="animate-spin" />
            <AppIcon v-else name="trash" :size="16" />
          </button>
        </div>
      </Transition>
      <!-- La barre fine du lot, au pied de la carte. -->
      <div v-if="running" class="h-[3px] bg-black/5 dark:bg-white/10">
        <div class="offline-bar h-full bg-primary" :style="{ width: `${percent}%` }"></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.offline-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-height: 3.875rem;
  padding: 0.625rem 1rem;
}
.offline-bar {
  transition: width 0.4s ease;
}

/* Un état cède la place au suivant en fondu : on voit que le geste a pris. */
.offline-swap-enter-active,
.offline-swap-leave-active {
  transition: opacity 0.15s ease;
}
.offline-swap-enter-from,
.offline-swap-leave-to {
  opacity: 0;
}

/* La flèche plonge dans son plateau, puis remonte. */
.offline-arrow {
  display: inline-flex;
}
.offline-arrow-drop {
  animation: offline-arrow-drop 0.45s ease-in-out;
}
@keyframes offline-arrow-drop {
  0%,
  100% {
    transform: translateY(0);
  }
  45% {
    transform: translateY(4px);
  }
}

/* La coche de la fin se trace, quand le lot vient de finir sous nos yeux. */
.offline-check {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.offline-check-tick {
  stroke-dasharray: 9;
  stroke-dashoffset: 0;
}
.offline-check-draw .offline-check-tick {
  animation: offline-check-draw 0.45s ease-out 0.15s both;
}
@keyframes offline-check-draw {
  from {
    stroke-dashoffset: 9;
  }
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .offline-arrow-drop,
  .offline-check-draw .offline-check-tick {
    animation: none;
  }
  .offline-swap-enter-active,
  .offline-swap-leave-active,
  .offline-bar {
    transition: none;
  }
}
</style>
