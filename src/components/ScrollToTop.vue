<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import AppIcon from "./icons/AppIcon.vue";
import { useMiniPlayerVisible } from "../composables/useAudioPlayer";
import { isNativeApp } from "../composables/useNativeApp";

const isVisible = ref(false);
// Le pointeur survole le bouton : on ne le masque pas sous la main de
// l'utilisateur qui s'apprête à cliquer.
const isHovered = ref(false);
const isMiniPlayerVisible = useMiniPlayerVisible();

// Reste au-dessus du mini-lecteur et, dans l'app, de la bottom bar.
const bottomClass = computed(() => {
  if (isNativeApp) return isMiniPlayerVisible.value ? "bottom-44" : "bottom-28";
  return isMiniPlayerVisible.value ? "bottom-36" : "bottom-20";
});

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

const checkScroll = () => {
  if (window.scrollY > 300) {
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

onMounted(() => {
  window.addEventListener("scroll", checkScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("scroll", checkScroll);
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
    <button
      v-if="isVisible"
      @click="scrollToTop"
      @pointerenter="onPointerEnter"
      @pointerleave="onPointerLeave"
      class="fixed right-6 w-11 h-11 flex items-center justify-center rounded-full bg-surface text-text-primary shadow-pop hover:text-primary transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary z-50"
      :class="bottomClass"
      aria-label="Retour en haut"
    >
      <AppIcon name="arrow-up" :size="18" />
    </button>
  </transition>
</template>
