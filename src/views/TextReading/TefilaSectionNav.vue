<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import { useMiniPlayerVisible } from "../../composables/useAudioPlayer";
import { isNativeApp } from "../../composables/useNativeApp";
import type { TefilaNavSection } from "../../composables/useTefilaNav";

/**
 * Le menu de navigation d'une tefila (Sidour, Sli'hot) : à la place du bouton
 * « remonter en haut », un bouton flottant d'où surgit un petit panneau
 * listant les sections de l'office. Un office se dit d'un trait mais se
 * cherche par sections : Chéma, 'Amida, ta'hanoun… le panneau y mène sans
 * faire défiler trois écrans.
 *
 * Contrairement au bouton de remontée, le menu reste affiché tout au long de
 * la lecture : c'est un repère permanent, pas un raccourci de passage. Il ne
 * s'efface qu'une fois tout en bas de la page, où la fin de l'office porte
 * ses propres boutons.
 */
const props = defineProps<{ sections: TefilaNavSection[] }>();

const { t } = useI18n();

const open = ref(false);
const isMiniPlayerVisible = useMiniPlayerVisible();

// Mêmes règles de placement que ScrollToTop, qu'il remplace : au-dessus du
// mini-lecteur et, dans l'app, de la bottom bar.
const bottomClass = computed(() => {
  if (isNativeApp) return isMiniPlayerVisible.value ? "bottom-44" : "bottom-28";
  return isMiniPlayerVisible.value ? "bottom-36" : "bottom-20";
});

// Tout en bas de l'office : le menu s'efface (panneau ouvert excepté).
const BOTTOM_GAP = 24;
const atBottom = ref(false);

const checkScroll = () => {
  const doc = document.documentElement;
  atBottom.value = window.innerHeight + window.scrollY >= doc.scrollHeight - BOTTOM_GAP;
};

function close() {
  open.value = false;
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
  checkScroll();
  window.addEventListener("scroll", checkScroll, { passive: true });
  window.addEventListener("resize", checkScroll, { passive: true });
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  window.removeEventListener("scroll", checkScroll);
  window.removeEventListener("resize", checkScroll);
  window.removeEventListener("keydown", onKeydown);
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
      v-show="!atBottom || open"
      class="fixed right-6 z-50 h-11 w-11"
      :class="bottomClass"
    >
      <!-- Le panneau surgit du coin du bouton, ancré à sa place : il grandit
           sur place plutôt que d'ouvrir un modal ailleurs. -->
      <transition name="nav-panel">
        <div
          v-if="open"
          class="nav-panel absolute bottom-0 right-0 flex w-64 max-h-[min(24rem,65vh)] flex-col overflow-hidden rounded-2xl bg-surface shadow-pop"
        >
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
      </transition>
      <transition name="nav-fab">
        <button
          v-if="!open"
          @click="open = true"
          class="absolute inset-0 flex items-center justify-center rounded-full bg-surface shadow-pop text-text-primary hover:text-primary transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          :aria-label="t('textReading.navSections')"
          aria-haspopup="menu"
          :aria-expanded="false"
        >
          <AppIcon name="list" :size="18" />
        </button>
      </transition>
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

/* Le panneau surgit du coin du bouton : un léger ressort à l'ouverture, une
   sortie brève et discrète. */
.nav-panel {
  transform-origin: bottom right;
}

.nav-panel-enter-active {
  transition: opacity 0.15s ease-out, transform 0.3s cubic-bezier(0.3, 1.3, 0.55, 1);
}

.nav-panel-leave-active {
  transition: opacity 0.12s ease-in, transform 0.12s ease-in;
}

.nav-panel-enter-from,
.nav-panel-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.85);
}

/* Le contenu suit d'un souffle : le panneau arrive, la liste se révèle. */
.nav-panel-enter-active nav {
  transition: opacity 0.18s ease-out 0.08s;
}

.nav-panel-enter-from nav {
  opacity: 0;
}

/* Le bouton s'efface pendant que le panneau le remplace, et revient d'un
   petit rebond quand celui-ci se referme. */
.nav-fab-enter-active {
  transition: opacity 0.15s ease-out 0.08s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) 0.08s;
}

.nav-fab-leave-active {
  transition: opacity 0.1s ease-in, transform 0.1s ease-in;
}

.nav-fab-enter-from,
.nav-fab-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

/* Mouvement réduit : les fondus suffisent. */
@media (prefers-reduced-motion: reduce) {
  .nav-panel-enter-active,
  .nav-panel-leave-active,
  .nav-fab-enter-active,
  .nav-fab-leave-active {
    transition: opacity 0.15s ease;
  }

  .nav-panel-enter-from,
  .nav-panel-leave-to,
  .nav-fab-enter-from,
  .nav-fab-leave-to {
    transform: none;
  }
}
</style>
