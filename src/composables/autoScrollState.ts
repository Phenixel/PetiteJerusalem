import { ref } from "vue";

/**
 * Is the automatic scrolling running? Written by useAutoScroll only.
 *
 * Kept apart so that App.vue can mount the auto-scroll pill the first time
 * scrolling starts without loading useAutoScroll (and the pill) for every
 * visitor: scrolling can only start on reading pages, which load the
 * composable themselves.
 */
export const autoScrollRunning = ref(false);
