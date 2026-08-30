<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import { useBottomChromeHeight } from "../composables/useBottomChrome";
import {
  AUTO_SCROLL_SPEEDS,
  autoScrollSpeedId,
  isAutoScrolling,
  setAutoScrollSpeed,
  stopAutoScroll,
  type AutoScrollSpeedId,
} from "../composables/useAutoScroll";

/**
 * La pastille du défilement automatique : le seul signe qu'il est en cours,
 * et de quoi le régler sans quitter le texte des yeux.
 *
 * Elle n'existe que pendant le défilement, lancé par un double appui sur le
 * texte (useAutoScroll) ; hors de là, rien ne s'affiche. Un appui dessus
 * ouvre les trois allures et l'arrêt.
 *
 * Posée une fois dans App.vue : le défilement ne peut démarrer que sur les
 * pages de lecture, et il s'arrête en les quittant.
 */

const { t } = useI18n();
const open = ref(false);

// Au-dessus des barres fixes du bas (barre de l'app native, mini-lecteur).
const bottom = useBottomChromeHeight("1rem");

// Le défilement s'arrête (fin du texte, ou arrêt demandé) : le menu s'en va
// avec la pastille qui le portait.
watch(isAutoScrolling, (scrolling) => {
  if (!scrolling) open.value = false;
});

function choose(id: AutoScrollSpeedId) {
  setAutoScrollSpeed(id);
  open.value = false;
}

function stop() {
  open.value = false;
  stopAutoScroll("user");
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && open.value) open.value = false;
};

window.addEventListener("keydown", onKeydown);
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <!-- Un appui hors du menu le referme, sans voile sur le texte. -->
  <div v-if="open" class="fixed inset-0 z-40" aria-hidden="true" @click="open = false"></div>

  <Transition name="pill">
    <div
      v-if="isAutoScrolling"
      class="fixed left-1/2 z-50 -translate-x-1/2"
      :style="{ bottom }"
      role="status"
    >
      <!-- Le menu surgit au-dessus de la pastille, ancré sur elle. -->
      <Transition name="pill-panel">
        <div
          v-if="open"
          class="pill-panel absolute bottom-full left-1/2 mb-2 w-52 -translate-x-1/2 overflow-hidden rounded-2xl bg-surface p-2 shadow-pop"
        >
          <p class="speed-heading">{{ t("textReading.autoScroll.speed") }}</p>
          <button
            v-for="speed in AUTO_SCROLL_SPEEDS"
            :key="speed.id"
            type="button"
            class="speed-item"
            :aria-pressed="autoScrollSpeedId === speed.id"
            @click="choose(speed.id)"
          >
            <AppIcon
              name="check"
              :size="13"
              class="flex-shrink-0"
              :class="autoScrollSpeedId === speed.id ? 'text-primary' : 'text-transparent'"
            />
            {{ t(`textReading.autoScroll.speeds.${speed.id}`) }}
          </button>
          <button type="button" class="speed-item mt-1 border-t border-line pt-2" @click="stop()">
            <AppIcon name="x" :size="13" class="flex-shrink-0 text-text-secondary" />
            {{ t("textReading.autoScroll.stop") }}
          </button>
        </div>
      </Transition>

      <button
        type="button"
        class="flex items-center gap-2 rounded-full bg-surface py-2 ps-3 pe-3.5 text-sm font-semibold text-text-primary shadow-pop transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :aria-label="t('textReading.autoScroll.openMenu')"
        aria-haspopup="menu"
        :aria-expanded="open"
        @click="open = !open"
      >
        <AppIcon name="chevron-down" :size="15" class="drift text-primary" />
        {{ t("textReading.autoScroll.pill") }}
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.speed-heading {
  padding: 0.35rem 0.5rem 0.15rem;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
}

.speed-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  text-align: start;
  padding: 0.45rem 0.5rem;
  border-radius: var(--radius-sm, 0.5rem);
  font-size: 0.875rem;
  color: var(--color-text-primary);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.speed-item:hover {
  background-color: color-mix(in srgb, currentColor 8%, transparent);
  color: var(--color-primary);
}

/* Le chevron descend sans fin : la pastille dit d'un coup d'oeil que la page
   avance toute seule. */
.drift {
  animation: drift 1.6s ease-in-out infinite;
}

@keyframes drift {
  0%,
  100% {
    transform: translateY(-2px);
    opacity: 0.55;
  }
  50% {
    transform: translateY(2px);
    opacity: 1;
  }
}

.pill-enter-active,
.pill-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.pill-enter-from,
.pill-leave-to {
  opacity: 0;
  transform: translate(-50%, 0.75rem);
}

.pill-panel {
  transform-origin: bottom center;
}

.pill-panel-enter-active {
  transition:
    opacity 0.15s ease-out,
    transform 0.3s cubic-bezier(0.3, 1.3, 0.55, 1);
}

.pill-panel-leave-active {
  transition:
    opacity 0.12s ease-in,
    transform 0.12s ease-in;
}

.pill-panel-enter-from,
.pill-panel-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px) scale(0.9);
}

/* Mouvement réduit : la pastille reste immobile, le fondu suffit. */
@media (prefers-reduced-motion: reduce) {
  .drift {
    animation: none;
  }

  .pill-enter-active,
  .pill-leave-active,
  .pill-panel-enter-active,
  .pill-panel-leave-active {
    transition: opacity 0.15s ease;
  }

  .pill-enter-from,
  .pill-leave-to {
    transform: translate(-50%, 0);
  }

  .pill-panel-enter-from,
  .pill-panel-leave-to {
    transform: translate(-50%, 0);
  }
}
</style>
