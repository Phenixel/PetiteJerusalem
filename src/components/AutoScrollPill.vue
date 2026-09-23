<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import { useBottomChromeHeight } from "../composables/useBottomChrome";
import {
  AUTO_SCROLL_SPEEDS,
  autoScrollSpeedId,
  isAutoScrolling,
  setAutoScrollSpeed,
  stopAutoScroll,
} from "../composables/useAutoScroll";

/**
 * La pastille du défilement automatique : le seul signe qu'il est en cours,
 * et de quoi le régler sans quitter le texte des yeux.
 *
 * Elle n'existe que pendant le défilement, lancé par un double appui sur le
 * texte (useAutoScroll) ; hors de là, rien ne s'affiche. Un appui dessus
 * ouvre l'allure, un second arrête.
 *
 * Posée une fois dans App.vue : le défilement ne peut démarrer que sur les
 * pages de lecture, et il s'arrête en les quittant.
 */

const { t } = useI18n();
const open = ref(false);

// Au-dessus des barres fixes du bas (barre de l'app native, mini-lecteur).
const bottom = useBottomChromeHeight("1rem");

// Le défilement s'arrête (fin du texte, ou arrêt demandé) : le réglage s'en va
// avec la pastille qui le portait.
watch(isAutoScrolling, (scrolling) => {
  if (!scrolling) open.value = false;
});

/**
 * L'allure se règle à un curseur, et non plus dans une liste de trois lignes.
 * Une liste demande de lire trois intitulés pour comprendre qu'ils forment une
 * échelle ; un curseur le montre, du plus lent à gauche au plus rapide à
 * droite, et se pousse d'un pouce sans viser une ligne. Les crans restent les
 * allures du tableau : c'est l'affichage qui change, pas le réglage.
 */
const speedIndex = computed(() => {
  const index = AUTO_SCROLL_SPEEDS.findIndex((speed) => speed.id === autoScrollSpeedId.value);
  return index === -1 ? 0 : index;
});

/** Le nom de l'allure, pour qui n'a que la voix de son appareil pour la lire. */
const speedLabel = computed(() => t(`textReading.autoScroll.speeds.${autoScrollSpeedId.value}`));

// Les deux bouts du rail portent le nom des allures extrêmes, parce que ce
// sont elles : un intitulé de plus, « le plus lent », en dirait moins.
const speedName = (index: number) =>
  t(`textReading.autoScroll.speeds.${AUTO_SCROLL_SPEEDS[index].id}`);
const slowestLabel = computed(() => speedName(0));
const fastestLabel = computed(() => speedName(AUTO_SCROLL_SPEEDS.length - 1));

// Au glissement et non au relâchement : on veut sentir l'allure changer sous
// le pouce pendant qu'on cherche la sienne.
function slide(event: Event) {
  const speed = AUTO_SCROLL_SPEEDS[Number((event.target as HTMLInputElement).value)];
  if (speed) setAutoScrollSpeed(speed.id);
}

function stop() {
  open.value = false;
  stopAutoScroll("user");
}

/**
 * Le premier appui ouvre l'allure, le second arrête la descente : la pastille
 * touchée pour ouvrir devient elle-même le bouton d'arrêt, comme le rond du
 * menu de lecture devient la croix qui referme (voir docs/design.md). L'arrêt
 * était une ligne de plus dans le panneau, sous les allures, là où l'on ne
 * revient pas le chercher. Un appui à côté referme sans rien arrêter.
 */
function press() {
  if (open.value) stop();
  else open.value = true;
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && open.value) open.value = false;
};

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <!-- Un appui hors du réglage le referme, sans voile sur le texte. -->
  <div v-if="open" class="fixed inset-0 z-40" aria-hidden="true" @click="open = false"></div>

  <Transition name="pill">
    <div
      v-if="isAutoScrolling"
      class="fixed left-1/2 z-50 -translate-x-1/2"
      :style="{ bottom }"
      role="status"
    >
      <!-- Le réglage surgit au-dessus de la pastille, ancré sur elle. -->
      <Transition name="pill-panel">
        <div
          v-if="open"
          class="pill-panel speed absolute bottom-full left-1/2 mb-2 w-52 -translate-x-1/2 rounded-xl bg-surface px-3 pt-2 pb-3 shadow-pop"
        >
          <p class="speed-heading">{{ t("textReading.autoScroll.speed") }}</p>
          <input
            class="speed-range"
            type="range"
            min="0"
            :max="AUTO_SCROLL_SPEEDS.length - 1"
            step="1"
            :value="speedIndex"
            :aria-label="t('textReading.autoScroll.speed')"
            :aria-valuetext="speedLabel"
            @input="slide"
          />
          <!-- Les crans, sous le rail, à l'aplomb des positions du curseur. -->
          <div class="speed-notches" aria-hidden="true">
            <span v-for="speed in AUTO_SCROLL_SPEEDS" :key="speed.id"></span>
          </div>
          <p class="speed-ends">
            <span>{{ slowestLabel }}</span>
            <span>{{ fastestLabel }}</span>
          </p>
        </div>
      </Transition>

      <button
        type="button"
        class="flex items-center gap-2 whitespace-nowrap rounded-full bg-surface py-2 ps-3 pe-3.5 text-sm font-semibold text-text-primary shadow-pop transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :aria-label="open ? undefined : t('textReading.autoScroll.openMenu')"
        :aria-expanded="open"
        @click="press"
      >
        <AppIcon
          :name="open ? 'x' : 'chevron-down'"
          :size="15"
          class="flex-shrink-0"
          :class="open ? 'text-text-secondary' : 'drift text-primary'"
        />
        {{ open ? t("textReading.autoScroll.stop") : t("textReading.autoScroll.pill") }}
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.speed-heading {
  padding-bottom: 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

/* La largeur du curseur, connue des crans et des deux bouts : c'est d'elle
   que se déduit la course réelle du pouce, d'un demi-curseur du bord à
   l'autre, et c'est sur cette course que les crans doivent tomber. */
.speed {
  --thumb: 1.15rem;
}

.speed-range {
  appearance: none;
  -webkit-appearance: none;
  display: block;
  width: 100%;
  height: var(--thumb);
  background: transparent;
  cursor: pointer;
}

.speed-range:focus {
  outline: none;
}

.speed-range:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
  border-radius: var(--radius-pill);
}

.speed-range::-webkit-slider-runnable-track {
  height: 0.3rem;
  border-radius: var(--radius-pill);
  background-color: color-mix(in srgb, var(--color-text-primary) 14%, transparent);
}

.speed-range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: var(--thumb);
  height: var(--thumb);
  margin-top: calc((0.3rem - var(--thumb)) / 2);
  border-radius: var(--radius-pill);
  background-color: var(--color-primary);
}

.speed-range::-moz-range-track {
  height: 0.3rem;
  border-radius: var(--radius-pill);
  background-color: color-mix(in srgb, var(--color-text-primary) 14%, transparent);
}

.speed-range::-moz-range-thumb {
  width: var(--thumb);
  height: var(--thumb);
  border: none;
  border-radius: var(--radius-pill);
  background-color: var(--color-primary);
}

/* Un demi-curseur de retrait de chaque côté, moins la moitié d'un cran : les
   points tombent alors sous le centre du curseur à chacune de ses positions. */
.speed-notches {
  display: flex;
  justify-content: space-between;
  padding-inline: calc(var(--thumb) / 2 - 0.09375rem);
  margin-top: 0.15rem;
}

.speed-notches span {
  width: 0.1875rem;
  height: 0.1875rem;
  border-radius: var(--radius-pill);
  background-color: color-mix(in srgb, var(--color-text-primary) 30%, transparent);
}

.speed-ends {
  display: flex;
  justify-content: space-between;
  margin-top: 0.3rem;
  font-size: 0.7rem;
  color: var(--color-text-secondary);
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
