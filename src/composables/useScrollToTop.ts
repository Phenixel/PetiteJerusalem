import { computed, onScopeDispose, ref, watch } from "vue";

/**
 * The pages that want the back-to-top button only some of the time (the
 * library home page, while a search lists its results): beside the route's
 * `meta: { scrollToTop: true }`, they ask for it while a condition holds.
 * See ScrollToTop.vue and docs/design.md, "Back to top, only on long lists".
 *
 * A counter rather than a flag: the next page asks before the previous one
 * lets go.
 */
const requests = ref(0);

/** Some page currently asks for the button. */
export const scrollToTopRequested = computed(() => requests.value > 0);

/** Asks for the button while `when` holds; let go with the calling scope. */
export function requestScrollToTop(when: () => boolean): void {
  let held = false;
  const hold = (wanted: boolean) => {
    if (wanted === held) return;
    held = wanted;
    requests.value += wanted ? 1 : -1;
  };
  watch(when, hold, { immediate: true });
  onScopeDispose(() => hold(false));
}
