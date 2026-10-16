<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import { useBottomChromeHeight } from "../composables/useBottomChrome";
import {
  AUTO_SCROLL_MAX_LEVEL,
  AUTO_SCROLL_MIN_LEVEL,
  AUTO_SCROLL_SPEEDS,
  autoScrollLevel,
  isAutoScrolling,
  setAutoScrollLevel,
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
 * droite, et se pousse d'un pouce sans viser une ligne.
 *
 * Il avait quatre crans, un par allure nommée ; il en a vingt, et le cran
 * choisi s'affiche en chiffre à côté de l'intitulé, pour qu'on retrouve le
 * sien d'une lecture à l'autre (voir AUTO_SCROLL_SPEEDS). Les quatre allures
 * restent sous le rail comme repères : un point à l'aplomb de chacune.
 */
const speedName = (id: string) => t(`textReading.autoScroll.speeds.${id}`);

/** Le cran, et le nom de l'allure quand il en est une, pour qui écoute son appareil. */
const speedLabel = computed(() => {
  const landmark = AUTO_SCROLL_SPEEDS.find((speed) => speed.level === autoScrollLevel.value);
  const values = { level: autoScrollLevel.value, max: AUTO_SCROLL_MAX_LEVEL };
  return landmark
    ? t("textReading.autoScroll.speedValueNamed", { ...values, name: speedName(landmark.id) })
    : t("textReading.autoScroll.speedValue", values);
});

// Les deux bouts du rail portent le nom des allures extrêmes, parce que ce
// sont elles : un intitulé de plus, « le plus lent », en dirait moins.
const slowestLabel = computed(() => speedName(AUTO_SCROLL_SPEEDS[0].id));
const fastestLabel = computed(() =>
  speedName(AUTO_SCROLL_SPEEDS[AUTO_SCROLL_SPEEDS.length - 1].id),
);

/** Où tombe un repère sur la course du pouce, de 0 à 100 %. */
const landmarkPosition = (level: number) =>
  `${((level - AUTO_SCROLL_MIN_LEVEL) / (AUTO_SCROLL_MAX_LEVEL - AUTO_SCROLL_MIN_LEVEL)) * 100}%`;

// Au glissement et non au relâchement : on veut sentir l'allure changer sous
// le pouce pendant qu'on cherche la sienne.
function slide(event: Event) {
  setAutoScrollLevel(Number((event.target as HTMLInputElement).value));
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

  <Transition name="pill" appear>
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
          <p class="speed-heading">
            <span>{{ t("textReading.autoScroll.speed") }}</span>
            <!-- Le cran en chiffre ; le curseur le dit déjà à qui l'écoute. -->
            <span class="speed-value" aria-hidden="true">{{ autoScrollLevel }}</span>
          </p>
          <input
            class="speed-range"
            type="range"
            :min="AUTO_SCROLL_MIN_LEVEL"
            :max="AUTO_SCROLL_MAX_LEVEL"
            step="1"
            :value="autoScrollLevel"
            :aria-label="t('textReading.autoScroll.speed')"
            :aria-valuetext="speedLabel"
            @input="slide"
          />
          <!-- Les allures nommées, sous le rail, à l'aplomb de leur cran. -->
          <div class="speed-notches" aria-hidden="true">
            <span
              v-for="speed in AUTO_SCROLL_SPEEDS"
              :key="speed.id"
              :style="{ insetInlineStart: landmarkPosition(speed.level) }"
            ></span>
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
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

/* Le chiffre change sous le pouce : des chiffres de même largeur l'empêchent
   de danser d'un cran à l'autre. */
.speed-value {
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
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

/* Un demi-curseur de retrait de chaque côté : la boîte des points est alors
   la course réelle du centre du pouce, et chaque point, centré sur sa
   position (voir landmarkPosition), tombe sous le curseur posé à son cran. */
.speed-notches {
  position: relative;
  height: 0.1875rem;
  margin-inline: calc(var(--thumb) / 2);
  margin-top: 0.15rem;
}

.speed-notches span {
  position: absolute;
  top: 0;
  translate: -50% 0;
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
