<script setup lang="ts">
/**
 * Dans l'app : des textes de la journée ne sont pas sur l'appareil, et ne se
 * liront pas sans connexion. On le dit, et l'on propose de les télécharger ;
 * rien ne part sans cet accord, la place occupée reste le choix de chacun.
 * Sur le site, rien : tout se lit en ligne.
 */
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { downloadErrorKey } from "../../composables/useBookDownload";
import { isNativeApp } from "../../composables/useNativeApp";
import { useOnline } from "../../composables/useOnline";
import { useToast } from "../../composables/useToast";
import type { TextStudyJsonEntry } from "../../models/models";
import { analyticsService } from "../../services/analyticsService";
import { downloadBooks, missingBooksForEntries } from "../../services/offlineLibraryService";
import { ensureManifestLoaded } from "../../services/offlineTextStore";
import AppIcon from "../icons/AppIcon.vue";

const props = defineProps<{ entries: TextStudyJsonEntry[] }>();

const { t } = useI18n();
const toast = useToast();
const online = useOnline();

// Le registre des téléchargements se lit avant de savoir ce qui manque.
const ready = ref(false);
onMounted(async () => {
  if (!isNativeApp) return;
  await ensureManifestLoaded();
  ready.value = true;
});

const missing = computed(() => (ready.value ? missingBooksForEntries(props.entries) : []));
const downloading = ref(false);

async function download(): Promise<void> {
  const books = missing.value;
  if (books.length === 0 || downloading.value) return;
  downloading.value = true;
  analyticsService.capture("offline_download_started", {
    scope: "parcours",
    books_count: books.length,
  });
  try {
    let cause: unknown = null;
    const failed = await downloadBooks(books, (e) => (cause = e));
    if (failed.length > 0) toast.error(t(downloadErrorKey(cause)));
    else toast.success(t("parcours.offline.done"));
    const succeeded = books.length - failed.length;
    analyticsService.capture(
      succeeded > 0 ? "offline_download_completed" : "offline_download_failed",
      {
        scope: "parcours",
        books_count: succeeded,
        failed_count: failed.length,
        is_online: navigator.onLine,
      },
    );
  } finally {
    downloading.value = false;
  }
}
</script>

<template>
  <div v-if="missing.length > 0" class="card flex flex-wrap items-center justify-between gap-3 p-4">
    <p class="flex min-w-0 items-start gap-2 text-sm leading-relaxed text-text-secondary">
      {{ t("parcours.offline.missing", missing.length) }}
    </p>
    <button
      type="button"
      class="btn btn-soft shrink-0"
      :disabled="downloading || !online"
      @click="download"
    >
      <AppIcon v-if="downloading" name="spinner" :size="14" class="animate-spin" />
      <AppIcon v-else name="download" :size="14" />
      {{ t("downloads.download") }}
    </button>
  </div>
</template>
