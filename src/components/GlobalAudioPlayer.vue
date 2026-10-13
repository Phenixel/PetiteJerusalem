<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import ChiourCover from "./chiourim/ChiourCover.vue";
import PlayerSeek from "./chiourim/PlayerSeek.vue";
import PlayerSpeed from "./chiourim/PlayerSpeed.vue";
import { COVER_INK, playerTone } from "./chiourim/cover";
import { useAudioPlayer, useMiniPlayerVisible } from "../composables/useAudioPlayer";
import { isNativeApp } from "../composables/useNativeApp";
import { rememberBar } from "./chiourim/sheetMotion";

/**
 * La barre du lecteur : le cours qui joue reste sous la main d'une page à
 * l'autre, comme dans une application d'écoute. Elle prend la reliure de sa
 * série, assombrie (playerTone). Un appui n'importe où sur elle (hors de ses
 * boutons), ou sur un téléphone un glissement vers le haut, ouvre le lecteur
 * plein écran (NowPlayingSheet) : la barre s'agrandit jusqu'à couvrir
 * l'écran, et le plein écran se réduit jusqu'à redevenir la barre (voir
 * sheetMotion).
 *
 * Sur un téléphone, une barre posée au-dessus de la barre de l'app : la
 * pochette, le titre et le rav, lecture, puis le cours suivant pendant
 * l'écoute (fermer, en pause). Sur un écran large, toute la largeur : les
 * commandes et la barre de lecture au milieu, la vitesse et fermer à droite.
 *
 * Montée sur toutes les pages : rien ici ne tire Firestore ni le catalogue
 * (voir initialBundle.test.ts). Le morceau porte de quoi dessiner sa pochette
 * et sa ligne ; le lecteur plein écran, qui lit le catalogue, se charge à la
 * demande.
 */
const loadSheet = () => import("./chiourim/NowPlayingSheet.vue");
const NowPlayingSheet = defineAsyncComponent(loadSheet);

const { t } = useI18n();

const player = useAudioPlayer();
const isVisible = useMiniPlayerVisible();

const tone = computed(() =>
  playerTone(player.track.value?.cover?.seed ?? player.track.value?.slug ?? ""),
);

const playLabel = computed(() =>
  player.isPlaying.value ? t("audioPlayer.pause") : t("audioPlayer.play"),
);

// --- Ouvrir le plein écran ---
const bar = ref<HTMLElement | null>(null);

function openSheet() {
  rememberBar(bar.value);
  player.openSheet();
}

/** Toute la barre ouvre le plein écran ; ses boutons gardent leur rôle. */
function onBarClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.closest("button, a, input, [role='slider'], [role='menu']")) return;
  openSheet();
}

// Téléphone : un glissement vers le haut sur la barre l'ouvre aussi.
const SWIPE_OPEN = 24;
let swipeStart: { x: number; y: number } | null = null;
function onTouchStart(event: TouchEvent) {
  const touch = event.touches[0];
  swipeStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
}
function onTouchMove(event: TouchEvent) {
  const touch = event.touches[0];
  if (!swipeStart || !touch) return;
  const dy = swipeStart.y - touch.clientY;
  if (dy > SWIPE_OPEN && dy > Math.abs(touch.clientX - swipeStart.x)) {
    swipeStart = null;
    openSheet();
  }
}

// Le plein écran reste monté le temps de se réduire en barre, la barre
// cachée dessous : elle réapparaît à l'instant où il la rejoint.
const sheetMounted = ref(false);
watch(
  () => player.sheetOpen.value,
  (open) => {
    if (open) sheetMounted.value = true;
  },
);
watch(
  () => player.track.value,
  (current, before) => {
    if (!current) sheetMounted.value = false;
    // Le premier cours lancé : le plein écran se charge en avance, il
    // s'ouvrira sans attente au premier appui.
    else if (!before) void loadSheet().catch(() => undefined);
  },
);
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="player.track.value"
      class="fixed inset-x-0 z-40"
      :class="[
        isNativeApp
          ? 'bottom-[calc(3.5rem+var(--safe-bottom))] px-2 pb-2'
          : 'bottom-0 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:p-0',
        { invisible: !isVisible || sheetMounted },
      ]"
      role="region"
      :aria-label="t('audioPlayer.nowPlaying')"
    >
      <div
        ref="bar"
        class="mx-auto cursor-pointer rounded-control shadow-pop"
        :class="isNativeApp ? '' : 'max-w-3xl md:max-w-none md:rounded-none'"
        :style="{ backgroundColor: tone, color: COVER_INK }"
        @click="onBarClick"
        @touchstart.passive="onTouchStart"
        @touchmove.passive="onTouchMove"
      >
        <div
          class="flex items-center gap-3 px-2 py-2"
          :class="
            isNativeApp
              ? ''
              : 'md:grid md:grid-cols-[1fr_minmax(0,36rem)_1fr] md:gap-6 md:px-4 md:py-3'
          "
        >
          <!-- La pochette et le titre : le lecteur plein écran -->
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-3 text-start"
            data-player-open
            :aria-label="t('chiourim.player.openTrack', { title: player.track.value.title })"
            @click="openSheet"
          >
            <ChiourCover
              v-if="player.track.value.cover"
              :seed="player.track.value.cover.seed"
              :label="player.track.value.cover.label"
              size="xs"
            />
            <span class="min-w-0">
              <span dir="auto" class="block truncate text-sm font-semibold">{{
                player.track.value.title
              }}</span>
              <span
                v-if="player.track.value.subtitle"
                dir="auto"
                class="block truncate text-xs opacity-75"
                >{{ player.track.value.subtitle }}</span
              >
            </span>
          </button>

          <!-- Écran large : les commandes et la barre de lecture -->
          <div v-if="!isNativeApp" class="hidden flex-col items-center gap-1 md:flex">
            <div class="flex items-center gap-2">
              <button
                class="bar-icon"
                :aria-label="t('audioPlayer.rewind')"
                :title="t('audioPlayer.rewind')"
                @click="player.skip(-15)"
              >
                <AppIcon name="rotate-ccw" :size="20" />
                <span class="bar-skip-n">15</span>
              </button>
              <button
                class="bar-icon"
                :aria-label="t('audioPlayer.previous')"
                :title="t('audioPlayer.previous')"
                @click="player.previous()"
              >
                <AppIcon name="skip-back" :size="18" class="rtl:rotate-180" />
              </button>
              <button
                class="flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-95"
                :style="{ backgroundColor: COVER_INK, color: tone }"
                :aria-label="playLabel"
                :title="playLabel"
                @click="player.toggle()"
              >
                <AppIcon
                  :name="player.isPlaying.value ? 'pause-solid' : 'play-solid'"
                  :size="16"
                  :class="{ 'ml-0.5': !player.isPlaying.value }"
                />
              </button>
              <button
                class="bar-icon"
                :disabled="!player.hasNext.value"
                :aria-label="t('audioPlayer.next')"
                :title="t('audioPlayer.next')"
                @click="player.next()"
              >
                <AppIcon name="skip-forward" :size="18" class="rtl:rotate-180" />
              </button>
              <button
                class="bar-icon"
                :aria-label="t('audioPlayer.forward')"
                :title="t('audioPlayer.forward')"
                @click="player.skip(30)"
              >
                <AppIcon name="rotate-cw" :size="20" />
                <span class="bar-skip-n">30</span>
              </button>
            </div>
            <PlayerSeek inline class="w-full" />
          </div>

          <!-- Les commandes de droite -->
          <div class="flex shrink-0 items-center justify-end gap-1">
            <!-- La vitesse : son menu s'ouvre vers le haut, au-dessus de la barre -->
            <PlayerSpeed
              v-if="!isNativeApp"
              placement="above"
              class="hidden bg-white/10 hover:bg-white/20 md:inline-block"
            />
            <button
              v-if="!isNativeApp"
              class="bar-icon hidden md:flex"
              :aria-label="t('chiourim.player.open')"
              :title="t('chiourim.player.open')"
              @click="openSheet"
            >
              <AppIcon name="chevron-up" :size="20" />
            </button>
            <!-- Téléphone : lecture, et le suivant pendant l'écoute -->
            <button
              class="flex h-11 w-11 items-center justify-center rounded-full"
              :class="isNativeApp ? '' : 'md:hidden'"
              :aria-label="playLabel"
              :title="playLabel"
              @click="player.toggle()"
            >
              <AppIcon
                :name="player.isPlaying.value ? 'pause-solid' : 'play-solid'"
                :size="22"
                :class="{ 'ml-0.5': !player.isPlaying.value }"
              />
            </button>
            <button
              v-if="player.isPlaying.value && player.hasNext.value"
              class="flex h-11 w-11 items-center justify-center rounded-full"
              :class="isNativeApp ? '' : 'md:hidden'"
              :aria-label="t('audioPlayer.next')"
              :title="t('audioPlayer.next')"
              @click="player.next()"
            >
              <AppIcon name="skip-forward" :size="20" class="rtl:rotate-180" />
            </button>
            <!-- En pause, la barre se ferme (sur un écran large, toujours) -->
            <button
              v-if="!player.isPlaying.value || !isNativeApp"
              class="h-11 w-11 items-center justify-center rounded-full opacity-80 hover:opacity-100"
              :class="player.isPlaying.value ? 'hidden md:flex' : 'flex'"
              :aria-label="t('audioPlayer.close')"
              :title="t('audioPlayer.close')"
              @click="player.close()"
            >
              <AppIcon name="x" :size="18" />
            </button>
          </div>
        </div>

        <!-- Téléphone : la barre de progression, au bord bas -->
        <div class="mini-progress" :class="isNativeApp ? '' : 'md:hidden'">
          <div
            class="h-full"
            :style="{ width: `${player.progress.value}%`, backgroundColor: COVER_INK }"
          ></div>
        </div>
      </div>
    </div>
  </Transition>

  <NowPlayingSheet v-if="sheetMounted && player.track.value" @closed="sheetMounted = false" />
</template>

<style scoped>
.bar-icon {
  position: relative;
  display: flex;
  height: 2.25rem;
  width: 2.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  transition:
    background-color 0.15s,
    opacity 0.15s;
}
.bar-icon:hover:not(:disabled) {
  background: rgb(255 255 255 / 0.12);
}
.bar-skip-n {
  position: absolute;
  font-size: 7px;
  font-weight: 700;
  line-height: 1;
}
.bar-icon:disabled {
  opacity: 0.35;
}
.mini-progress {
  height: 2px;
  margin: 0 0.5rem 0.25rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.2);
}
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
