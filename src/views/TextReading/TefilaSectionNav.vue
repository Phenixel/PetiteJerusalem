<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import { useMiniPlayerVisible } from "../../composables/useAudioPlayer";
import { isNativeApp } from "../../composables/useNativeApp";
import type { TefilaNavSection } from "../../composables/useTefilaNav";

/**
 * Le menu de navigation d'une tefila (Sidour, Sli'hot) : à la place du bouton
 * « remonter en haut », un bouton flottant qui se déplie sur place, comme s'il
 * prenait plus de place, en petit panneau listant les sections de l'office.
 * Un office se dit d'un trait mais se cherche par sections : Chéma, 'Amida,
 * ta'hanoun… le panneau y mène sans faire défiler trois écrans.
 */
const props = defineProps<{ sections: TefilaNavSection[] }>();

const { t } = useI18n();

const open = ref(false);
const isVisible = ref(false);
const isHovered = ref(false);
const isMiniPlayerVisible = useMiniPlayerVisible();

// Mêmes règles de placement que ScrollToTop, qu'il remplace : au-dessus du
// mini-lecteur et, dans l'app, de la bottom bar.
const bottomClass = computed(() => {
  if (isNativeApp) return isMiniPlayerVisible.value ? "bottom-44" : "bottom-28";
  return isMiniPlayerVisible.value ? "bottom-36" : "bottom-20";
});

// Même comportement d'apparition que ScrollToTop : pendant le défilement,
// puis effacé après un court repos, sauf panneau ouvert ou pointeur dessus.
const IDLE_HIDE_MS = 1600;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

const armHideTimer = () => {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (!isHovered.value && !open.value) isVisible.value = false;
  }, IDLE_HIDE_MS);
};

const checkScroll = () => {
  if (window.scrollY > 300) {
    isVisible.value = true;
    armHideTimer();
  } else if (!open.value) {
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

function close() {
  open.value = false;
  armHideTimer();
}

function goTop() {
  close();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goTo(offset: number) {
  close();
  const el = document.querySelector(`[data-block-anchor="${offset}"]`);
  if (!(el instanceof HTMLElement)) return;
  // Le titre de la section vient se poser sous l'en-tête, la lecture dessous.
  window.scrollTo({
    top: window.scrollY + el.getBoundingClientRect().top - 84,
    behavior: "smooth",
  });
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape" && open.value) close();
};

onMounted(() => {
  window.addEventListener("scroll", checkScroll, { passive: true });
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  window.removeEventListener("scroll", checkScroll);
  window.removeEventListener("keydown", onKeydown);
  if (hideTimer) clearTimeout(hideTimer);
});
</script>

<template>
  <!-- Un clic hors du panneau le referme, sans voile qui assombrit la page. -->
  <div v-if="open" class="fixed inset-0 z-40" @click="close" aria-hidden="true"></div>
  <transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="transform translate-y-10 opacity-0"
    enter-to-class="transform translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform translate-y-10 opacity-0"
  >
    <div
      v-if="isVisible || open"
      class="fixed right-6 z-50"
      :class="bottomClass"
      @pointerenter="onPointerEnter"
      @pointerleave="onPointerLeave"
    >
      <!-- Le même élément grandit et s'arrondit autrement : le bouton semble
           prendre plus de place plutôt qu'ouvrir un modal ailleurs. -->
      <div
        class="ms-auto overflow-hidden bg-surface shadow-pop transition-all duration-300 ease-out"
        :class="open ? 'w-64 max-h-[min(24rem,65vh)] rounded-2xl' : 'w-11 max-h-11 rounded-full'"
      >
        <button
          v-if="!open"
          @click="open = true"
          class="w-11 h-11 flex items-center justify-center text-text-primary hover:text-primary transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          :aria-label="t('textReading.navSections')"
          aria-haspopup="menu"
          :aria-expanded="false"
        >
          <AppIcon name="list" :size="18" />
        </button>
        <div v-else class="flex flex-col max-h-[min(24rem,65vh)]">
          <div class="flex items-center justify-between ps-4 pe-2 pt-2.5 pb-1 flex-shrink-0">
            <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {{ t("textReading.navSections") }}
            </p>
            <button @click="close" class="icon-btn" :aria-label="t('common.close')">
              <AppIcon name="x" :size="15" />
            </button>
          </div>
          <nav class="overflow-y-auto px-2 pb-2 min-h-0">
            <button @click="goTop" class="section-item">
              <AppIcon name="arrow-up" :size="13" class="flex-shrink-0 text-text-secondary" />
              {{ t("textReading.navTop") }}
            </button>
            <button
              v-for="section in props.sections"
              :key="section.offset"
              @click="goTo(section.offset)"
              class="section-item"
            >
              {{ section.label }}
            </button>
          </nav>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.section-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  text-align: start;
  padding: 0.45rem 0.5rem;
  border-radius: var(--radius-sm, 0.5rem);
  font-size: 0.875rem;
  color: var(--color-text-primary);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.section-item:hover {
  background-color: color-mix(in srgb, currentColor 8%, transparent);
  color: var(--color-primary);
}
</style>
