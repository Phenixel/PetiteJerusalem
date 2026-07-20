<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
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
  totalDownloadedSize,
  type OfflineBook,
} from "../services/offlineLibraryService";
import { ensureManifestLoaded } from "../services/offlineTextStore";
import { useToast } from "../composables/useToast";
import AppIcon from "../components/icons/AppIcon.vue";
import AccountCta from "../components/AccountCta.vue";

const { t } = useI18n();
const toast = useToast();

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
    } else {
      await downloadBook(book);
    }
  } catch {
    toast.error(t("downloads.error"));
  }
}

const ALL_TYPE = "Tout";

const TYPES = [
  { key: ALL_TYPE, labelKey: "study.types.all" },
  { key: "Tehilim", labelKey: "study.types.tehilim" },
  { key: "Mishna", labelKey: "study.types.mishna" },
  { key: "Talmud Bavli", labelKey: "study.types.talmud" },
  { key: "Tanakh", labelKey: "study.types.tanakh" },
];

// Type tabs that map to an actual corpus (everything except the "Tout" tab).
const CORPUS_TYPES = TYPES.filter((ty) => ty.key !== ALL_TYPE);

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;
const selectedType = ref(ALL_TYPE);
const searchTerm = ref("");

// "Tout" shows every corpus at once; any other tab stays scoped to itself.
const isAllSelected = computed(() => selectedType.value === ALL_TYPE);

const filtered = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();
  return allTexts.filter((txt) => {
    const matchesTerm = term === "" || txt.name.toLowerCase().includes(term);
    const matchesType = isAllSelected.value || String(txt.type) === selectedType.value;
    return matchesTerm && matchesType;
  });
});

// Group results by type (a type heading is only shown on the "Tout" tab), then
// by book/seder, so each section stays readable.
const groupedByType = computed(() => {
  return CORPUS_TYPES.map((ty) => {
    const texts = filtered.value.filter((txt) => String(txt.type) === ty.key);
    const groups: Record<string, TextStudyJsonEntry[]> = {};
    for (const txt of texts) {
      (groups[txt.livre] ??= []).push(txt);
    }
    return { key: ty.key, labelKey: ty.labelKey, groups, count: texts.length };
  }).filter((group) => group.count > 0);
});

const hasResults = computed(() => filtered.value.length > 0);

// App native : « Tout télécharger » sur l'onglet courant + espace utilisé
// (remplace l'ancienne page Hors ligne).
const tabBooks = computed<OfflineBook[]>(() => {
  if (!isNativeApp) return [];
  return isAllSelected.value
    ? offlineBooks
    : offlineBooks.filter((b) => b.corpus === selectedType.value);
});

const tabAllDownloaded = computed(
  () => tabBooks.value.length > 0 && tabBooks.value.every((b) => isBookDownloaded(b)),
);

async function downloadAllInTab() {
  for (const book of tabBooks.value) {
    if (isBookDownloaded(book)) continue;
    try {
      await downloadBook(book);
    } catch {
      toast.error(t("downloads.error"));
      return; // Probablement hors connexion : inutile d'enchaîner les échecs.
    }
  }
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

function formatBookName(livre: string): string {
  return sessionService.formatBookName(livre);
}

onMounted(() => {
  if (isNativeApp) {
    ensureManifestLoaded();
  }
  const url = window.location.origin + "/bibliotheque";
  seoService.setMeta({
    title: `${t("study.title")} | Petite Jérusalem`,
    description: t("study.subtitle"),
    canonical: url,
  });
});
</script>

<template>
  <main class="mx-auto px-6 py-12">
    <!-- Hero (le sous-titre explicatif ne sert que le site : SEO + découverte) -->
    <div class="text-center" :class="isNativeApp ? 'mb-6' : 'mb-10'">
      <h1 class="text-4xl md:text-5xl font-bold text-text-primary tracking-tight pb-1">
        {{ t("study.title") }}
      </h1>
      <p v-if="!isNativeApp" class="mt-4 text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
        {{ t("study.subtitle") }}
      </p>
    </div>

    <!-- Recherche : collante sur l'app pour rester accessible au scroll. -->
    <div :class="isNativeApp ? 'app-sticky-search' : ''" class="flex justify-center mb-4">
      <div class="relative w-full md:w-96">
        <AppIcon
          name="search"
          :size="16"
          class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/70 pointer-events-none"
        />
        <input
          v-model="searchTerm"
          type="text"
          :placeholder="t('study.searchPlaceholder')"
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

    <!-- Controls -->
    <div class="flex flex-col items-center gap-4 mb-10">
      <!-- Filtres volontairement imposants : ils servent de porte d'entrée
           principale vers chaque corpus. -->
      <div class="flex flex-wrap gap-2.5 md:gap-3 justify-center">
        <button
          v-for="ty in TYPES"
          :key="ty.key"
          @click="selectedType = ty.key"
          class="px-5 py-2.5 md:px-6 md:py-3 rounded-full text-sm md:text-base font-semibold transition-colors"
          :class="
            selectedType === ty.key
              ? 'bg-primary text-white'
              : 'bg-black/5 text-text-secondary hover:text-text-primary dark:bg-white/10'
          "
        >
          {{ t(ty.labelKey) }}
        </button>
      </div>

      <!-- App native : tout télécharger (onglet courant) + espace utilisé. -->
      <div
        v-if="isNativeApp && tabBooks.length > 0"
        class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
      >
        <button v-if="!tabAllDownloaded" class="btn btn-soft" @click="downloadAllInTab()">
          <AppIcon
            v-if="downloadingPaths.size > 0"
            name="spinner"
            :size="14"
            class="animate-spin"
          />
          <AppIcon v-else name="download" :size="14" />
          {{ t("downloads.downloadAll") }}
        </button>
        <p v-else class="flex items-center gap-1.5 text-sm text-primary">
          <AppIcon name="circle-check" :size="14" />
          {{ t("downloads.allDownloaded") }}
        </p>
        <p v-if="totalDownloadedSize > 0" class="text-sm text-text-secondary">
          {{ t("downloads.total", { size: formatSize(totalDownloadedSize) }) }}
        </p>
      </div>
    </div>

    <!-- Results -->
    <div v-if="hasResults" class="max-w-5xl mx-auto space-y-12">
      <div v-for="typeGroup in groupedByType" :key="typeGroup.key" class="space-y-10">
        <!-- Type heading: shown only on the "Tout" tab, where several corpora mix. -->
        <h2 v-if="isAllSelected" class="text-2xl font-bold text-text-primary">
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

    <AccountCta class="max-w-3xl mx-auto mt-12" />
  </main>
</template>
