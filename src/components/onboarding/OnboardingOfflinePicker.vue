<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  downloadBook,
  formatDownloadSize,
  missingBooksOfCorpus,
  offlineCorpora,
  type OfflineCorpus,
} from "../../services/offlineLibraryService";
import { ensureManifestLoaded } from "../../services/offlineTextStore";
import { useToast } from "../../composables/useToast";
import { analyticsService } from "../../services/analyticsService";
import AppIcon from "../icons/AppIcon.vue";

/**
 * La page de téléchargement simplifiée de l'introduction (app native).
 *
 * Un corpus par ligne, son poids, une case : de quoi emporter l'essentiel en
 * un geste sans passer par la bibliothèque, qui garde le réglage fin, texte
 * par texte.
 *
 * Composant à part, chargé à la demande : sur le web il n'y a rien à
 * télécharger, et le catalogue des textes n'a alors aucune raison d'arriver
 * avec l'introduction.
 */

const { t } = useI18n();
const toast = useToast();

/**
 * Cochés d'entrée : les corpus légers, c'est-à-dire la liturgie du quotidien,
 * quelques centaines de kilo-octets qu'on ne sent pas passer et qu'on ouvre
 * tous les jours. Les gros corpus (Talmud, Tanakh, Michna) restent un choix
 * délibéré : ils pèsent plusieurs mégaoctets, parfois sur un forfait mobile.
 */
const LIGHT_CORPUS_BYTES = 1024 * 1024;

const manifestReady = ref(false);
const selected = ref<Set<string>>(new Set());
const downloading = ref(false);
const done = ref(0);
const total = ref(0);

onMounted(async () => {
  // Sans l'index des téléchargements, tout paraîtrait absent de l'appareil.
  await ensureManifestLoaded();
  manifestReady.value = true;
  const light = offlineCorpora.filter(
    (corpus) => remainingBytes(corpus) > 0 && corpus.approxBytes <= LIGHT_CORPUS_BYTES,
  );
  selected.value = new Set(light.map((corpus) => corpus.key));
});

/** Poids approximatif de ce qui reste à télécharger dans un corpus. */
function remainingBytes(corpus: OfflineCorpus): number {
  if (corpus.bundled || corpus.books.length === 0) return 0;
  const missing = missingBooksOfCorpus(corpus).length;
  return Math.round((corpus.approxBytes * missing) / corpus.books.length);
}

const rows = computed(() =>
  offlineCorpora.map((corpus) => ({
    corpus,
    missing: corpus.bundled ? 0 : missingBooksOfCorpus(corpus).length,
    bytes: remainingBytes(corpus),
  })),
);

const selectionBytes = computed(() =>
  rows.value
    .filter((row) => selected.value.has(row.corpus.key))
    .reduce((sum, row) => sum + row.bytes, 0),
);

const selectionBooks = computed(() =>
  rows.value
    .filter((row) => selected.value.has(row.corpus.key))
    .flatMap((row) => missingBooksOfCorpus(row.corpus)),
);

function toggle(key: string): void {
  const next = new Set(selected.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  selected.value = next;
}

/**
 * Télécharge la sélection, livre par livre pour que l'avancement se voie.
 * Un échec n'arrête pas le reste : ce qui manque restera proposé dans la
 * bibliothèque, et l'utilisateur est prévenu à la fin.
 */
async function downloadSelection(): Promise<void> {
  const books = selectionBooks.value;
  if (books.length === 0 || downloading.value) return;
  analyticsService.capture("onboarding_offline_download_started", {
    corpora: [...selected.value],
    books_count: books.length,
    bytes: selectionBytes.value,
  });
  downloading.value = true;
  done.value = 0;
  total.value = books.length;
  let failed = 0;
  for (const book of books) {
    try {
      await downloadBook(book);
    } catch {
      failed++;
    }
    done.value++;
  }
  downloading.value = false;
  analyticsService.capture("onboarding_offline_download_finished", {
    books_count: books.length,
    books_failed: failed,
  });
  if (failed > 0) toast.error(t("downloads.error"));
  else toast.success(t("onboarding.library.downloadDone"));
}
</script>

<template>
  <div>
    <h2 class="text-xl font-bold text-text-primary mb-2">
      {{ t("onboarding.library.offlineTitle") }}
    </h2>
    <p class="text-text-secondary mb-5">
      {{ t("onboarding.library.offlineIntro") }}
    </p>

    <ul v-if="manifestReady" class="space-y-2 mb-5">
      <li v-for="row in rows" :key="row.corpus.key">
        <button
          type="button"
          class="w-full card p-4 flex items-center gap-4 text-left transition-all duration-300"
          :class="[
            selected.has(row.corpus.key) ? 'ring-2 ring-primary' : 'card-hover',
            row.missing === 0 ? 'opacity-70' : '',
          ]"
          :disabled="row.missing === 0 || downloading"
          :aria-pressed="selected.has(row.corpus.key)"
          @click="toggle(row.corpus.key)"
        >
          <span
            class="w-6 h-6 shrink-0 rounded-md flex items-center justify-center"
            :class="
              row.missing === 0
                ? 'bg-green-600/10 text-green-600 dark:text-green-400'
                : selected.has(row.corpus.key)
                  ? 'bg-primary text-white'
                  : 'bg-black/5 dark:bg-white/10 text-transparent'
            "
          >
            <AppIcon name="check" :size="14" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block font-semibold text-text-primary">
              {{ t(row.corpus.labelKey) }}
            </span>
            <span class="block text-sm text-text-secondary">
              <template v-if="row.corpus.bundled">
                {{ t("onboarding.library.bundled") }}
              </template>
              <template v-else-if="row.missing === 0">
                {{ t("onboarding.library.alreadyDownloaded") }}
              </template>
              <template v-else>
                {{ t("onboarding.library.booksCount", row.missing) }} ·
                {{ formatDownloadSize(row.bytes) }}
              </template>
            </span>
          </span>
        </button>
      </li>
    </ul>

    <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
      <button
        type="button"
        class="btn btn-primary"
        :disabled="selectionBooks.length === 0 || downloading"
        @click="downloadSelection()"
      >
        <AppIcon v-if="downloading" name="spinner" :size="16" class="animate-spin" />
        <AppIcon v-else name="download" :size="16" />
        {{
          downloading
            ? t("onboarding.library.downloading", { done, total })
            : t("onboarding.library.download")
        }}
      </button>
      <p v-if="!downloading && selectionBooks.length > 0" class="text-sm text-text-secondary">
        {{ t("onboarding.library.selection", { size: formatDownloadSize(selectionBytes) }) }}
      </p>
    </div>

    <p class="text-sm text-text-secondary flex items-start gap-1.5">
      <AppIcon name="info" :size="14" class="mt-0.5" />
      {{ t("onboarding.library.changeHint") }}
    </p>
  </div>
</template>
