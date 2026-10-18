<script setup lang="ts">
import { computed, ref, onUnmounted, watch } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "./icons/AppIcon.vue";
import { useMiniPlayerVisible } from "../composables/useAudioPlayer";
import { isNativeApp } from "../composables/useNativeApp";
import { readingNavActive } from "../composables/useReadingNav";
import { useScrollFrame } from "../composables/useScrollFrame";
import { TABLE_BAR_REM } from "../composables/useBottomChrome";
import { tableBarVisible } from "../composables/useReadingTable";

const isVisible = ref(false);

/**
 * Where the button has nothing to do:
 * - a route that opts out with `meta: { scrollToTop: false }` (home page,
 *   sign-in, forms, profile and settings, a message thread; see routes.ts);
 * - a page with less than `MIN_SCROLL_SCREENS` screens to scroll back: a
 *   flick of the thumb brings its top back, and the button would only cover
 *   the content.
 * Held by `src/__tests__/scrollToTop.test.ts`.
 */
const MIN_SCROLL_SCREENS = 2;
const route = useRoute();
const routeAllows = computed(() => route.meta.scrollToTop !== false);
// Le pointeur survole le bouton : on ne le masque pas sous la main de
// l'utilisateur qui s'apprête à cliquer.
const isHovered = ref(false);
const isMiniPlayerVisible = useMiniPlayerVisible();

// Reste au-dessus du mini-lecteur et, dans l'app, de la bottom bar ; la
// barre de la table d'étude, quand un texte y est posé, s'ajoute dessous.
const bottomClass = computed(() => {
  if (isNativeApp) return isMiniPlayerVisible.value ? "bottom-44" : "bottom-28";
  return isMiniPlayerVisible.value ? "bottom-36" : "bottom-20";
});
// Une marge, et non une translation : celle de la transition d'apparition
// l'écraserait.
const tableLift = computed(() =>
  tableBarVisible.value ? { marginBottom: `${TABLE_BAR_REM}rem` } : undefined,
);

// Le bouton n'apparaît que pendant le défilement et s'efface après un court
// temps d'inactivité : au repos (ex. en bas de l'accueil, sur la dédicace
// « À la mémoire de »), il ne recouvre plus le contenu.
const IDLE_HIDE_MS = 1600;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

const armHideTimer = () => {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (!isHovered.value) isVisible.value = false;
  }, IDLE_HIDE_MS);
};

// La position vient de l'image partagée (useScrollFrame) : un seul écouteur
// de défilement pour toute l'app, et rien à mesurer ici.
const scrollFrame = useScrollFrame();

const checkScroll = () => {
  const { scrollY, viewport, docHeight } = scrollFrame.value;
  const longPage = docHeight - viewport >= MIN_SCROLL_SCREENS * viewport;
  if (routeAllows.value && longPage && scrollY > 300) {
    isVisible.value = true;
    armHideTimer();
  } else {
    if (hideTimer) clearTimeout(hideTimer);
    isVisible.value = false;
  }
};

const onPointerEnter = () => {
  isHovered.value = true;
  if (hideTimer) clearTimeout(hideTimer);
};

const onPointerLeave = () => {
  isHovered.value = false;
  armHideTimer();
};

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};

watch(() => scrollFrame.value.scrollY, checkScroll);
// A new page starts without the button, whatever the previous one showed.
watch(() => route.path, checkScroll);

onUnmounted(() => {
  if (hideTimer) clearTimeout(hideTimer);
});
</script>

<template>
  <transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="transform translate-y-10 opacity-0"
    enter-to-class="transform translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform translate-y-10 opacity-0"
  >
    <!-- Sur un texte de la bibliothèque, le menu de lecture (ReadingMenu) prend sa place. -->
    <button
      v-if="isVisible && !readingNavActive"
      @click="scrollToTop"
      @pointerenter="onPointerEnter"
      @pointerleave="onPointerLeave"
      class="fixed right-6 w-11 h-11 flex items-center justify-center rounded-full bg-surface text-text-primary shadow-pop hover:text-primary transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary z-50"
      :class="bottomClass"
      :style="tableLift"
      :aria-label="$t('textReading.navTop')"
    >
      <AppIcon name="arrow-up" :size="18" />
    </button>
  </transition>
</template>
