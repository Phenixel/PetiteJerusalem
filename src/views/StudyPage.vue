<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { sessionService } from "../services/sessionService";
import { seoService } from "../services/seoService";
import { appendHebrewNumeral } from "../services/hebrewNumerals";
import { hubPath } from "../content/etudeTexts";
import { isNativeApp } from "../composables/useNativeApp";
import {
  bookForEntry,
  downloadBook,
  downloadingPaths,
  isBookDownloaded,
  offlineBooks,
  removeBook,
  removeBooks,
  totalDownloadedSize,
  type OfflineBook,
} from "../services/offlineLibraryService";
import { ensureManifestLoaded } from "../services/offlineTextStore";
import { readingProgressService, type ReadingPosition } from "../services/readingProgressService";
import { authService, type User } from "../services/authService";
import { countDailyProgress, userPreferencesService } from "../services/userPreferencesService";
import { useToast } from "../composables/useToast";
import { analyticsService } from "../services/analyticsService";
import AppIcon from "../components/icons/AppIcon.vue";
import AccountCta from "../components/AccountCta.vue";
import DailyReadingCard from "../components/DailyReadingCard.vue";
import LibraryShelf, { type ShelfBook } from "../components/LibraryShelf.vue";

const { t } = useI18n();
const toast = useToast();
const route = useRoute();

// App native : état de téléchargement affiché sur chaque carte de la bibliothèque.
type BookState = "none" | "downloading" | "downloaded" | "idle";
function bookState(text: TextStudyJsonEntry): BookState {
  if (!isNativeApp) return "none";
  const book = bookForEntry(text);
  if (!book) return "none";
  if (downloadingPaths.has(book.path)) return "downloading";
  return isBookDownloaded(book) ? "downloaded" : "idle";
}

async function toggleDownload(text: TextStudyJsonEntry) {
  const book = bookForEntry(text);
  if (!book) return;
  try {
    if (isBookDownloaded(book)) {
      await removeBook(book);
      analyticsService.capture("offline_download_deleted", { scope: "book", book: book.path });
    } else {
      await downloadBook(book);
      // Téléchargements déclenchés par l'utilisateur uniquement (la synchro en
      // arrière-plan de la lecture du jour n'est pas trackée).
      analyticsService.capture("offline_download_completed", { scope: "book", book: book.path });
    }
  } catch {
    toast.error(t("downloads.error"));
  }
}

// La bibliothèque est un tableau de bord : l'accueil ne montre que les grandes
// sections (corpus) ; la liste détaillée des textes vit sur /bibliotheque/:corpus.
const CORPUS_META: {
  corpus: string;
  typeKey: string;
  labelKey: string;
  descKey: string;
  searchKey: string;
}[] = [
  {
    corpus: "tehilim",
    typeKey: "Tehilim",
    labelKey: "study.types.tehilim",
    descKey: "study.corpus.tehilimDesc",
    searchKey: "study.corpus.tehilimSearch",
  },
  {
    corpus: "michna",
    typeKey: "Mishna",
    labelKey: "study.types.mishna",
    descKey: "study.corpus.michnaDesc",
    searchKey: "study.corpus.michnaSearch",
  },
  {
    corpus: "talmud",
    typeKey: "Talmud Bavli",
    labelKey: "study.types.talmud",
    descKey: "study.corpus.talmudDesc",
    searchKey: "study.corpus.talmudSearch",
  },
  {
    corpus: "tanakh",
    typeKey: "Tanakh",
    labelKey: "study.types.tanakh",
    descKey: "study.corpus.tanakhDesc",
    searchKey: "study.corpus.tanakhSearch",
  },
];

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;

// Corpus courant, piloté par la route (/bibliotheque = accueil, sans corpus).
const currentCorpus = computed(
  () => CORPUS_META.find((c) => c.corpus === String(route.params.corpus ?? "")) ?? null,
);

// Les livres de l'étagère : un par grande section, titre sur la couverture.
const shelfBooks = computed<ShelfBook[]>(() =>
  CORPUS_META.map((c) => ({
    corpus: c.corpus,
    to: `/bibliotheque/${c.corpus}`,
    label: t(c.labelKey),
  })),
);

// La recherche de l'accueil couvre toute la bibliothèque, celle d'une page
// corpus reste dans le corpus : le placeholder le dit explicitement.
const searchPlaceholder = computed(() =>
  currentCorpus.value ? t(currentCorpus.value.searchKey) : t("study.searchAllPlaceholder"),
);

const searchTerm = ref("");

// Chaque frappe re-filtre et re-groupe les 328 entrées du catalogue : sur un
// appareil lent, taper devient poussif. On ne recalcule que 150 ms après la
// dernière frappe — l'input, lui, reste réactif (v-model sur searchTerm).
const debouncedTerm = ref("");
let searchDebounce: ReturnType<typeof setTimeout> | undefined;
watch(searchTerm, (value) => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    debouncedTerm.value = value;
  }, 150);
});

// La recherche de l'accueil couvre toute la bibliothèque ; celle d'un corpus
// reste dans le corpus. Changer de page remet la recherche à zéro.
watch(currentCorpus, () => {
  searchTerm.value = "";
  debouncedTerm.value = "";
  applySeoMeta();
});

const hasSearch = computed(() => debouncedTerm.value.trim() !== "");

const filtered = computed(() => {
  const term = debouncedTerm.value.trim().toLowerCase();
  return allTexts.filter((txt) => {
    const matchesTerm = term === "" || txt.name.toLowerCase().includes(term);
    const matchesType =
      currentCorpus.value === null || String(txt.type) === currentCorpus.value.typeKey;
    return matchesTerm && matchesType;
  });
});

// Group results by type (a type heading is only shown when several corpora can
// mix, i.e. searching from the dashboard), then by book/seder, so each section
// stays readable.
const groupedByType = computed(() => {
  return CORPUS_META.map((ty) => {
    const texts = filtered.value.filter((txt) => String(txt.type) === ty.typeKey);
    const groups: Record<string, TextStudyJsonEntry[]> = {};
    for (const txt of texts) {
      (groups[txt.livre] ??= []).push(txt);
    }
    return { key: ty.typeKey, labelKey: ty.labelKey, groups, count: texts.length };
  }).filter((group) => group.count > 0);
});

const hasResults = computed(() => filtered.value.length > 0);

// La liste détaillée s'affiche sur une page corpus, ou dès qu'on cherche
// depuis l'accueil (la recherche reste la porte d'entrée la plus rapide).
const showList = computed(() => currentCorpus.value !== null || hasSearch.value);

// --- Connecté : lecture du jour et reprise de lecture, en tête de la
// bibliothèque (ces fonctionnalités vivaient dans le profil). ---
const user = ref<User | null>(null);
let unsubscribeAuth: (() => void) | null = null;
const dailyLoading = ref(false);
const readingTotal = ref(0);
const readingDone = ref(0);

// Dernière position de lecture : le vrai « Reprendre ma lecture ».
const lastReading = ref<ReadingPosition | null>(null);
const resumeLink = computed(() =>
  lastReading.value
    ? { path: lastReading.value.path, query: { verset: String(lastReading.value.line) } }
    : null,
);

function trackResume() {
  if (!lastReading.value) return;
  analyticsService.capture("reading_resumed", {
    text_id: lastReading.value.textId,
    source: "library",
  });
}

// Lecture terminée (ou abandonnée) : la croix retire la position pour ne plus
// la proposer. S'il reste une lecture récente, elle prend le relais.
function dismissResume() {
  const current = lastReading.value;
  if (!current) return;
  readingProgressService.clearPosition(current.textId);
  lastReading.value = readingProgressService.getLastPosition();
  analyticsService.capture("reading_resume_dismissed", {
    text_id: current.textId,
    source: "library",
  });
}

/** Local calendar day (YYYY-MM-DD) — même convention que DailyReading. */
function todayKey(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

async function loadDailySummary(u: User) {
  dailyLoading.value = true;
  try {
    const prefs = await userPreferencesService.getPreferences(u.id);
    // Même règle de comptage que la page Lecture du jour (chnei mikra
    // hebdomadaire exclu, complétions intersectées avec les listes actives).
    const progress = prefs.dailyReadingProgress;
    const isToday = progress?.date === todayKey();
    const counts = countDailyProgress({
      textIds: prefs.dailyReadingIds ?? [],
      options: prefs.dailyReadingOptions ?? [],
      completedTextIds: isToday ? (progress.completedIds ?? []) : [],
      completedOptions: isToday ? (progress.completedOptions ?? []) : [],
    });
    readingTotal.value = counts.total;
    readingDone.value = counts.done;
  } catch (error) {
    console.error("Erreur lors du chargement de la lecture du jour:", error);
  } finally {
    dailyLoading.value = false;
  }
}

function trackCorpusOpened(corpus: string) {
  analyticsService.capture("library_corpus_opened", { corpus });
}

// App native : « Tout télécharger » (toute la bibliothèque sur l'accueil, le
// corpus courant sur sa page) + espace utilisé.
const tabBooks = computed<OfflineBook[]>(() => {
  if (!isNativeApp) return [];
  return currentCorpus.value === null
    ? offlineBooks
    : offlineBooks.filter((b) => b.corpus === currentCorpus.value?.typeKey);
});

const tabAllDownloaded = computed(
  () => tabBooks.value.length > 0 && tabBooks.value.every((b) => isBookDownloaded(b)),
);

async function downloadAllInTab() {
  analyticsService.capture("offline_download_started", {
    scope: "all",
    tab: currentCorpus.value?.typeKey ?? "Tout",
    books_count: tabBooks.value.filter((b) => !isBookDownloaded(b)).length,
  });
  for (const book of tabBooks.value) {
    if (isBookDownloaded(book)) continue;
    try {
      await downloadBook(book);
    } catch {
      toast.error(t("downloads.error"));
      return; // Probablement hors connexion : inutile d'enchaîner les échecs.
    }
  }
  analyticsService.capture("offline_download_completed", {
    scope: "all",
    tab: currentCorpus.value?.typeKey ?? "Tout",
  });
}

// Libérer de la place : symétrique de « Tout télécharger », donc au même
// endroit et avec la même portée — toute la bibliothèque depuis l'accueil, le
// corpus courant depuis sa page.
const tabDownloadedBooks = computed(() => tabBooks.value.filter((b) => isBookDownloaded(b)));

const removingAll = ref(false);

async function removeAllInTab() {
  if (removingAll.value) return;
  const books = tabDownloadedBooks.value;
  if (books.length === 0) return;
  const corpus = currentCorpus.value;
  const confirmed = window.confirm(
    corpus
      ? t("downloads.deleteAllCorpusConfirm", { count: books.length, corpus: t(corpus.labelKey) })
      : t("downloads.deleteAllConfirm", { count: books.length }),
  );
  if (!confirmed) return;
  removingAll.value = true;
  try {
    await removeBooks(books);
    analyticsService.capture("offline_download_deleted", {
      scope: "all",
      tab: corpus?.typeKey ?? "Tout",
      books_count: books.length,
    });
    toast.success(t("downloads.deleteAllDone"));
  } catch {
    toast.error(t("downloads.deleteError"));
  } finally {
    removingAll.value = false;
  }
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

function formatBookName(livre: string): string {
  return sessionService.formatBookName(livre);
}

// Badge marque-pages sur les cartes : lecture locale immédiate, affinée quand
// la synchro du compte aboutit.
const bookmarkCounts = ref<Record<string, number>>({});

function applySeoMeta() {
  const corpus = currentCorpus.value;
  if (corpus) {
    const url = window.location.origin + `/bibliotheque/${corpus.corpus}`;
    seoService.setMeta({
      title: `${t(corpus.labelKey)} | ${t("study.title")} | Petite Jérusalem`,
      description: t(corpus.descKey),
      canonical: url,
    });
  } else {
    const url = window.location.origin + "/bibliotheque";
    seoService.setMeta({
      title: `${t("study.title")} | Petite Jérusalem`,
      description: t("study.subtitle"),
      canonical: url,
    });
  }
}

onMounted(() => {
  bookmarkCounts.value = readingProgressService.getBookmarkCounts();
  // Position locale tout de suite, affinée quand la synchro du compte aboutit.
  lastReading.value = readingProgressService.getLastPosition();
  void readingProgressService.ensureSynced().then(() => {
    bookmarkCounts.value = readingProgressService.getBookmarkCounts();
    lastReading.value = readingProgressService.getLastPosition();
  });
  unsubscribeAuth = authService.onAuthChanged((u) => {
    user.value = u;
    if (u) {
      loadDailySummary(u);
    } else {
      readingTotal.value = 0;
      readingDone.value = 0;
    }
  });
  if (isNativeApp) {
    ensureManifestLoaded();
  }
  applySeoMeta();
});

onUnmounted(() => {
  unsubscribeAuth?.();
});
</script>

<template>
  <main class="mx-auto px-6 py-12">
    <!-- ===== Page corpus : liste détaillée d'une grande section ===== -->
    <template v-if="currentCorpus">
      <div
        class="max-w-5xl mx-auto animate-[fadeIn_0.4s_ease]"
        :class="isNativeApp ? 'mb-4' : 'mb-8'"
      >
        <RouterLink to="/bibliotheque" class="back-link mb-4">
          <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
          {{ t("study.title") }}
        </RouterLink>
        <h1 class="text-3xl md:text-4xl font-bold text-text-primary tracking-tight pb-1">
          {{ t(currentCorpus.labelKey) }}
        </h1>
        <p v-if="!isNativeApp" class="mt-2 text-lg text-text-secondary max-w-2xl leading-relaxed">
          {{ t(currentCorpus.descKey) }}
        </p>
      </div>
    </template>

    <!-- ===== Accueil de la bibliothèque : hero ===== -->
    <!-- Hero resserré sur téléphone : chaque ligne gagnée remonte les livres
         au-dessus de la pliure. -->
    <div
      v-else
      class="text-center animate-[fadeIn_0.5s_ease]"
      :class="isNativeApp ? 'mb-6' : 'mb-6 md:mb-10'"
    >
      <h1 class="text-3xl md:text-5xl font-bold text-text-primary tracking-tight pb-1">
        {{ t("study.title") }}
      </h1>
      <p
        v-if="!isNativeApp"
        class="mt-2 md:mt-4 text-sm md:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed"
      >
        {{ t("study.subtitle") }}
      </p>
    </div>

    <!-- Recherche : collante sur l'app pour rester accessible au scroll.
         Depuis l'accueil elle cherche dans toute la bibliothèque. -->
    <div
      :class="isNativeApp ? 'app-sticky-search' : ''"
      class="flex justify-center mb-6 animate-[fadeIn_0.5s_ease]"
    >
      <div class="relative w-full md:w-96">
        <AppIcon
          name="search"
          :size="16"
          class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/70 pointer-events-none"
        />
        <input
          v-model="searchTerm"
          type="text"
          :placeholder="searchPlaceholder"
          class="field !pl-11"
        />
        <button
          v-if="searchTerm"
          @click="searchTerm = ''"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/70 hover:text-text-primary transition-colors"
        >
          <AppIcon name="x" :size="14" />
        </button>
      </div>
    </div>

    <!-- App native : tout télécharger (bibliothèque entière ou corpus courant)
         + espace utilisé. -->
    <div
      v-if="isNativeApp && tabBooks.length > 0"
      class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-8 animate-[fadeIn_0.5s_ease]"
    >
      <button v-if="!tabAllDownloaded" class="btn btn-soft" @click="downloadAllInTab()">
        <AppIcon v-if="downloadingPaths.size > 0" name="spinner" :size="14" class="animate-spin" />
        <AppIcon v-else name="download" :size="14" />
        {{ t("downloads.downloadAll") }}
      </button>
      <p v-else class="flex items-center gap-1.5 text-sm text-primary">
        <AppIcon name="circle-check" :size="14" />
        {{ t("downloads.allDownloaded") }}
      </p>
      <!-- Faire de la place : proposé dès qu'il y a quelque chose à supprimer
           dans la portée courante (bibliothèque entière ou corpus affiché). -->
      <button
        v-if="tabDownloadedBooks.length > 0"
        class="btn btn-danger"
        :disabled="removingAll"
        @click="removeAllInTab()"
      >
        <AppIcon v-if="removingAll" name="spinner" :size="14" class="animate-spin" />
        <AppIcon v-else name="trash" :size="14" />
        {{ currentCorpus ? t("downloads.deleteAllCorpus") : t("downloads.deleteAll") }}
      </button>
      <p v-if="totalDownloadedSize > 0" class="text-sm text-text-secondary">
        {{ t("downloads.total", { size: formatSize(totalDownloadedSize) }) }}
      </p>
    </div>

    <!-- ===== Accueil sans recherche : le tableau de bord ===== -->
    <template v-if="!showList">
      <!-- Reprendre la dernière lecture, au verset près : une simple ligne
           discrète juste sous la recherche. -->
      <div
        v-if="lastReading && resumeLink"
        class="flex items-center justify-center gap-1 -mt-2 mb-6 animate-[fadeIn_0.5s_ease]"
      >
        <RouterLink
          :to="resumeLink"
          class="group inline-flex items-center gap-1.5 min-w-0 text-sm text-text-secondary hover:text-primary transition-colors"
          @click="trackResume()"
        >
          <AppIcon name="bookmark" :size="13" class="shrink-0 text-primary/70" />
          <span class="truncate">
            {{ t("home.dashboard.resumeCta", { label: lastReading.label }) }}
          </span>
        </RouterLink>
        <button
          @click="dismissResume"
          class="shrink-0 p-1 rounded-full text-text-secondary/50 hover:text-red-600 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          :title="t('home.dashboard.resumeDismiss')"
          :aria-label="t('home.dashboard.resumeDismiss')"
        >
          <AppIcon name="x" :size="12" />
        </button>
      </div>

      <!-- Les grandes sections : on est dans la bibliothèque, les livres sont
           la porte d'entrée principale — visibles sans scroller, même sur
           téléphone. -->
      <div class="mt-2 md:mt-6">
        <LibraryShelf :books="shelfBooks" @open="trackCorpusOpened" />
      </div>

      <!-- Connecté : la lecture du jour en bas de page — même carte que le
           tableau de bord de l'accueil (un seul design pour la même chose). -->
      <div v-if="user" class="max-w-3xl mx-auto mt-14 animate-[fadeIn_0.5s_ease]">
        <div v-if="dailyLoading" class="card p-6 h-36 animate-pulse"></div>
        <DailyReadingCard v-else :done="readingDone" :total="readingTotal" />
      </div>
    </template>

    <!-- ===== Liste détaillée : page corpus, ou recherche depuis l'accueil ===== -->
    <template v-else>
      <div v-if="hasResults" class="max-w-5xl mx-auto space-y-12 animate-[fadeIn_0.5s_ease]">
        <div v-for="typeGroup in groupedByType" :key="typeGroup.key" class="space-y-10">
          <!-- Type heading: shown only when searching across the whole library. -->
          <h2 v-if="!currentCorpus" class="text-2xl font-bold text-text-primary">
            {{ t(typeGroup.labelKey) }}
          </h2>
          <section v-for="(texts, livre) in typeGroup.groups" :key="livre">
            <h3 class="text-xl font-bold text-text-primary mb-4">
              {{ formatBookName(String(livre)) }}
            </h3>
            <!-- Une seule colonne sur téléphone : les noms restent lisibles en entier. -->
            <div class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <router-link
                v-for="text in texts"
                :key="text.id"
                :to="hubPath(text)"
                class="card card-hover p-4 flex items-center justify-between gap-2 group"
              >
                <span class="min-w-0">
                  <span class="block font-medium text-text-primary truncate">
                    {{ appendHebrewNumeral(text.name) }}
                  </span>
                  <span v-if="text.totalSections > 1" class="text-xs text-text-secondary">
                    {{ t("study.sections", { count: text.totalSections }) }}
                  </span>
                </span>
                <!-- Un marque-page attend dans ce texte -->
                <span
                  v-if="bookmarkCounts[String(text.id)]"
                  class="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary"
                  :title="t('textReading.bookmarks')"
                >
                  <AppIcon name="bookmark" :size="13" />
                  {{ bookmarkCounts[String(text.id)] }}
                </span>
                <!-- App native : télécharger/supprimer le livre sans quitter la bibliothèque. -->
                <button
                  v-if="bookState(text) !== 'none'"
                  @click.prevent.stop="toggleDownload(text)"
                  class="shrink-0 p-1.5 -m-1.5 transition-colors"
                  :class="
                    bookState(text) === 'downloaded'
                      ? 'text-primary'
                      : 'text-text-secondary/50 hover:text-primary'
                  "
                  :aria-label="
                    bookState(text) === 'downloaded'
                      ? t('downloads.delete')
                      : t('downloads.download')
                  "
                  :title="
                    bookState(text) === 'downloaded'
                      ? t('downloads.delete')
                      : t('downloads.download')
                  "
                >
                  <AppIcon
                    v-if="bookState(text) === 'downloading'"
                    name="spinner"
                    :size="19"
                    class="animate-spin text-primary"
                  />
                  <AppIcon
                    v-else-if="bookState(text) === 'downloaded'"
                    name="circle-check"
                    :size="19"
                  />
                  <AppIcon v-else name="download" :size="19" />
                </button>
              </router-link>
            </div>
          </section>
        </div>
      </div>

      <!-- Empty -->
      <div v-else class="flex flex-col items-center justify-center py-16 text-center">
        <AppIcon name="search" :size="32" class="text-text-secondary/40 mb-4" />
        <p class="text-text-secondary">{{ t("study.noResults") }}</p>
      </div>
    </template>

    <AccountCta class="max-w-3xl mx-auto mt-12" />
  </main>
</template>
