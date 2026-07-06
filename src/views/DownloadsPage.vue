<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import {
  bookDownloadedSize,
  downloadBook,
  downloadingPaths,
  isBookDownloaded,
  offlineBooks,
  removeBook,
  totalDownloadedSize,
  type OfflineBook,
} from "../services/offlineLibraryService";
import { ensureManifestLoaded } from "../services/offlineTextStore";
import { isNativeApp } from "../composables/useNativeApp";
import { useToast } from "../composables/useToast";
import { seoService } from "../services/seoService";
import AppIcon from "../components/icons/AppIcon.vue";

const { t } = useI18n();
const toast = useToast();

// Mêmes libellés d'onglets que la bibliothèque.
const CORPUS = [
  { key: "Tehilim", labelKey: "study.types.tehilim" },
  { key: "Mishna", labelKey: "study.types.mishna" },
  { key: "Talmud Bavli", labelKey: "study.types.talmud" },
  { key: "Tanakh", labelKey: "study.types.tanakh" },
];

const groups = computed(() =>
  CORPUS.map((c) => {
    const books = offlineBooks.filter((b) => b.corpus === c.key);
    return {
      ...c,
      books,
      downloadedCount: books.filter((b) => isBookDownloaded(b)).length,
    };
  }).filter((g) => g.books.length > 0),
);

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

async function onDownload(book: OfflineBook) {
  try {
    await downloadBook(book);
  } catch {
    toast.error(t("downloads.error"));
  }
}

async function onRemove(book: OfflineBook) {
  await removeBook(book);
}

async function onDownloadAll(books: OfflineBook[]) {
  for (const book of books) {
    if (isBookDownloaded(book)) continue;
    try {
      await downloadBook(book);
    } catch {
      toast.error(t("downloads.error"));
      return; // Probablement hors connexion : inutile d'enchaîner les échecs.
    }
  }
}

onMounted(async () => {
  await ensureManifestLoaded();
  seoService.setMeta({
    title: `${t("downloads.title")} | Petite Jérusalem`,
    description: t("downloads.subtitle"),
    canonical: window.location.origin + "/telechargements",
  });
});
</script>

<template>
  <main class="mx-auto max-w-4xl px-6 py-12">
    <div class="text-center mb-10">
      <h1 class="text-4xl font-bold text-text-primary mb-4 tracking-tight pb-1">
        {{ t("downloads.title") }}
      </h1>
      <p class="text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
        {{ t("downloads.subtitle") }}
      </p>
      <p class="mt-4 text-sm text-text-secondary">
        {{ t("downloads.total", { size: formatSize(totalDownloadedSize) }) }}
      </p>
      <p
        v-if="!isNativeApp"
        class="mt-2 text-sm text-text-secondary/80 max-w-xl mx-auto flex items-center justify-center gap-2"
      >
        <AppIcon name="info" :size="14" class="shrink-0" />
        {{ t("downloads.webNotice") }}
      </p>
    </div>

    <section v-for="group in groups" :key="group.key" class="mb-10">
      <div class="flex items-center justify-between gap-4 mb-4">
        <h2 class="text-2xl font-bold text-text-primary">
          {{ t(group.labelKey) }}
          <span class="text-sm font-medium text-text-secondary ml-2">
            {{ group.downloadedCount }}/{{ group.books.length }}
          </span>
        </h2>
        <button
          v-if="group.downloadedCount < group.books.length"
          class="btn btn-soft"
          @click="onDownloadAll(group.books)"
        >
          <AppIcon name="download" :size="14" />
          {{ t("downloads.downloadAll") }}
        </button>
      </div>

      <ul class="grid gap-2 sm:grid-cols-2">
        <li
          v-for="book in group.books"
          :key="book.path"
          class="card p-4 flex items-center justify-between gap-3"
        >
          <div class="min-w-0">
            <p class="font-semibold text-text-primary truncate">{{ book.name }}</p>
            <p class="text-xs text-text-secondary">
              <template v-if="isBookDownloaded(book)">
                {{ t("downloads.downloaded") }} ·
                {{ formatSize(bookDownloadedSize(book) ?? 0) }}
              </template>
              <template v-else-if="downloadingPaths.has(book.path)">
                {{ t("downloads.downloading") }}
              </template>
            </p>
          </div>

          <div class="shrink-0 flex items-center gap-2">
            <AppIcon
              v-if="downloadingPaths.has(book.path)"
              name="spinner"
              :size="16"
              class="animate-spin text-primary"
            />
            <template v-else-if="isBookDownloaded(book)">
              <AppIcon name="circle-check" :size="16" class="text-primary" />
              <button
                class="text-text-secondary/60 hover:text-red-500 transition-colors"
                :aria-label="t('downloads.delete')"
                :title="t('downloads.delete')"
                @click="onRemove(book)"
              >
                <AppIcon name="trash" :size="15" />
              </button>
            </template>
            <button
              v-else
              class="btn btn-soft !px-3 !py-1.5"
              :aria-label="t('downloads.download')"
              @click="onDownload(book)"
            >
              <AppIcon name="download" :size="14" />
              {{ t("downloads.download") }}
            </button>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>
