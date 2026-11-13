<script setup lang="ts">
/**
 * Choosing the books pinned to the home page (useHomePinned), in edit mode,
 * under their block: the pinned ones in a row, each with its cross; a field
 * where one types what one looks for (« Chaharit », « Berakhot »,
 * « Tehilim »), and the answers to pin, up to three; « Les trois offices »
 * pins Chaharit, Min'ha and Arvit at once, in place of the others.
 *
 * Loaded on demand (see HomeView): it reads the catalog.
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import CatalogSearchField from "./CatalogSearchField.vue";
import {
  MAX_PINNED,
  PRAYERS_PINNED,
  useHomePinned,
  type PinRef,
} from "../composables/useHomePinned";
import { resolvePin, searchPinnable, type PinnedBook } from "../content/pinnedBooks";

const emit = defineEmits<{
  (e: "pinned", book: PinnedBook | "prayers"): void;
  (e: "unpinned", book: PinnedBook): void;
}>();

const { t, locale } = useI18n();
const home = useHomePinned();

const pinnedBooks = computed(() =>
  home.pinned.value.flatMap((ref) => resolvePin(ref, t, locale.value) ?? []),
);
const full = computed(() => home.pinned.value.length >= MAX_PINNED);
const isPinned = (ref: PinRef): boolean => home.pinned.value.includes(ref);
const prayersPinned = computed(
  () =>
    home.pinned.value.length === PRAYERS_PINNED.length &&
    PRAYERS_PINNED.every((ref) => isPinned(ref)),
);

const term = ref("");
const results = computed(() => searchPinnable(term.value, t, locale.value));

function pin(book: PinnedBook): void {
  if (isPinned(book.ref) || full.value) return;
  home.pin(book.ref);
  term.value = "";
  emit("pinned", book);
}

function unpin(book: PinnedBook): void {
  home.unpin(book.ref);
  emit("unpinned", book);
}

function pinPrayers(): void {
  home.replace(PRAYERS_PINNED);
  emit("pinned", "prayers");
}
</script>

<template>
  <div>
    <!-- What is on the shelf, in its order: a cross takes a book off. -->
    <div v-if="pinnedBooks.length" class="flex flex-wrap gap-2">
      <button
        v-for="book in pinnedBooks"
        :key="book.ref"
        type="button"
        class="pinned-chip"
        :aria-label="t('home.edit.pinned.remove', { name: book.title })"
        @click="unpin(book)"
      >
        {{ book.title }}
        <AppIcon name="x" :size="12" />
      </button>
    </div>

    <button
      v-if="!prayersPinned"
      type="button"
      class="btn btn-soft prayers mt-3"
      @click="pinPrayers"
    >
      <AppIcon name="book-open" :size="16" />
      {{ t("home.edit.pinned.prayers") }}
    </button>

    <template v-if="!full">
      <CatalogSearchField
        v-model:term="term"
        class="mt-3"
        :placeholder="t('home.edit.pinned.search')"
      />
      <div v-if="results.length" class="card mt-3 divide-y divide-line overflow-hidden">
        <button
          v-for="book in results"
          :key="book.ref"
          type="button"
          class="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 text-start hover:bg-surface-soft disabled:opacity-60"
          :disabled="isPinned(book.ref)"
          @click="pin(book)"
        >
          <span class="min-w-0 truncate text-[15px] font-bold">{{ book.title }}</span>
          <span class="flex flex-none items-center gap-1 text-[13px] font-semibold text-primary">
            <AppIcon :name="isPinned(book.ref) ? 'check' : 'plus'" :size="14" />
            {{ isPinned(book.ref) ? t("home.edit.pinned.added") : t("home.edit.pinned.add") }}
          </span>
        </button>
      </div>
      <p v-else-if="term.trim().length >= 2" class="mt-3 text-sm text-text-secondary">
        {{ t("home.edit.pinned.noResult") }}
      </p>
    </template>
    <p v-else class="mt-3 text-sm text-text-secondary">{{ t("home.edit.pinned.full") }}</p>
  </div>
</template>

<style scoped>
.pinned-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: var(--radius-pill);
  background: var(--color-brand);
  color: var(--color-on-brand);
  font-size: 14px;
  font-weight: 700;
}
.prayers {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
}
</style>
