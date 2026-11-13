<script setup lang="ts">
/**
 * The books pinned to the home page (useHomePinned): up to three volumes on a
 * shelf, drawn like the library's (LibraryShelf), each a touch away from its
 * page: a whole section or one text (Chaharit, Berakhot). A home page block
 * one shows, moves or hides (useHomeLayout); with no book pinned, it
 * disappears.
 *
 * Loaded on demand (see HomeView): it reads the catalog.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import LibraryShelf, { type ShelfBook } from "./LibraryShelf.vue";
import { useHomePinned } from "../composables/useHomePinned";
import { resolvePin } from "../content/pinnedBooks";

const emit = defineEmits<{ (e: "open", corpus: string): void }>();

const { t, locale } = useI18n();
const { pinned } = useHomePinned();

const books = computed<ShelfBook[]>(() =>
  pinned.value.flatMap((ref) => {
    const book = resolvePin(ref, t, locale.value);
    return book
      ? [{ id: ref, corpus: book.corpus, to: book.to, label: book.cover, ariaLabel: book.title }]
      : [];
  }),
);
</script>

<template>
  <LibraryShelf v-if="books.length" :books="books" @open="(corpus) => emit('open', corpus)" />
</template>
