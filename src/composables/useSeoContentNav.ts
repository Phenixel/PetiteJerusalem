import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { authService } from "../services/authService";

const NEW_SESSION_PATH = "/share-reading/new-session";

/**
 * Wires up the internal links inside the SEO pages' `v-html` content
 * (TehilimPage, ContentPage, EtudeReadingPage).
 *
 * The body markup has to stay crawlable plain `<a href>` HTML, so by default a
 * click triggers a full browser reload. Two problems follow:
 *
 *  1. White flash. On these prerendered pages the static body is injected inside
 *     `#app`, which Vue wipes and re-renders on mount. So every full reload
 *     flashes blank (content → blank → content), and because every in-content
 *     link is a plain anchor, browsing between SEO pages flashes on each click.
 *     Routing same-origin links through the router keeps navigation client-side.
 *
 *  2. Sign-in CTA. The "create a session" link must behave like the share home
 *     page (`handleCreateClick`): a signed-out visitor gets the sign-in prompt
 *     in place, instead of being navigated to the new-session page that would
 *     itself pop the very same prompt.
 *
 * Returns the prompt's `show` ref and the click handler to bind on the
 * `v-html` container. The caller renders `<SignupPromptModal>` with the ref.
 */
export function useSeoContentNav() {
  const router = useRouter();
  const showAuthPrompt = ref(false);
  const isAuthenticated = ref(false);
  let unsubscribe: (() => void) | null = null;

  onMounted(() => {
    unsubscribe = authService.onAuthChanged((user) => {
      isAuthenticated.value = !!user;
    });
  });
  onUnmounted(() => unsubscribe?.());

  function onContentClick(event: MouseEvent) {
    // Leave new-tab / modified / non-primary clicks to the browser.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const anchor = (event.target as HTMLElement | null)?.closest("a");
    if (!anchor) return;

    const target = anchor.getAttribute("target");
    if (target && target !== "_self") return; // e.g. target="_blank"

    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) return; // in-page anchors keep native behaviour

    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return; // external / mailto / tel → browser

    // Sign-in CTA: a signed-out visitor gets the prompt here, no navigation.
    if (url.pathname === NEW_SESSION_PATH && !isAuthenticated.value) {
      event.preventDefault();
      showAuthPrompt.value = true;
      return;
    }

    // Same-origin in-app link → client-side navigation (no full reload / flash).
    event.preventDefault();
    router.push(url.pathname + url.search + url.hash);
  }

  return { showAuthPrompt, onContentClick };
}
