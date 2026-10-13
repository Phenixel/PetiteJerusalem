<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import { useAudioPlayer, formatTime } from "../composables/useAudioPlayer";
import { chiourTrack, useChiourPlayback } from "../composables/useChiourPlayback";
import { resumePosition } from "../services/listeningProgress";
import { analyticsService } from "../services/analyticsService";
import type { Chiour } from "../models/models";

/**
 * Le lecteur de la page d'un cours : la barre qu'on fait glisser, les temps,
 * et les commandes d'un lecteur de musique (vitesse, reculer de 15 s, cours
 * précédent, lecture, cours suivant, avancer de 30 s).
 *
 * C'est une vue sur le lecteur global (useAudioPlayer) : il est « actif »
 * quand le cours chargé est le sien. Le précédent et le suivant parcourent
 * `queue`, la série du cours ; tant que ce cours ne joue pas, ils mènent à la
 * page du cours voisin.
 */

const props = defineProps<{
  chiour: Chiour;
  /** La série du cours, dans l'ordre : la file du lecteur. */
  queue: Chiour[];
}>();

const emit = defineEmits<{ navigate: [slug: string] }>();

const { t } = useI18n();
const player = useAudioPlayer();
const { playFrom } = useChiourPlayback();
const showSpeedMenu = ref(false);

const speeds = [0.75, 1, 1.25, 1.5, 1.75, 2];

const src = computed(() => props.chiour.mediaUrl);
const isCurrent = computed(() => player.track.value?.src === src.value);
const isPlaying = computed(() => isCurrent.value && player.isPlaying.value);

// Durée affichée avant lecture : la durée enregistrée, à défaut sondée via un
// <audio> jetable (métadonnées seules), sans toucher au lecteur global qui
// joue peut-être un autre morceau.
const probedDuration = ref(0);
let probe: HTMLAudioElement | null = null;

function releaseProbe() {
  if (!probe) return;
  // Retirer `src` ne suffit pas : sans `load()`, le téléchargement en cours
  // continue (HTMLMediaElement), une sonde orpheline par navigation.
  probe.removeAttribute("src");
  probe.load();
  probe = null;
}

function probeDuration(source: string) {
  probedDuration.value = props.chiour.duration ?? 0;
  releaseProbe();
  if (!source || probedDuration.value) return;
  // Morceau déjà dans le lecteur global : sa durée est connue, inutile de
  // relancer une requête (une demande Range en double à chaque ouverture).
  if (player.track.value?.src === source && player.duration.value) return;
  probe = new Audio();
  probe.preload = "metadata";
  probe.addEventListener("loadedmetadata", function (this: HTMLAudioElement) {
    if (probe === this) probedDuration.value = this.duration;
  });
  probe.src = source;
}

watch(src, probeDuration, { immediate: true });

onUnmounted(releaseProbe);

/** La position montrée avant la lecture : là où l'on reprendra. */
const restingTime = computed(() => resumePosition(props.chiour.slug) ?? 0);
const currentTime = computed(() =>
  isCurrent.value ? player.currentTime.value : restingTime.value,
);
const duration = computed(() =>
  isCurrent.value && player.duration.value ? player.duration.value : probedDuration.value,
);
const progress = computed(() => (duration.value ? (currentTime.value / duration.value) * 100 : 0));

const formattedCurrent = computed(() => formatTime(currentTime.value));
const formattedLeft = computed(() =>
  duration.value ? `-${formatTime(Math.max(0, duration.value - currentTime.value))}` : "",
);
const isMuted = computed(() => player.isMuted.value);
const volume = computed(() => player.volume.value);
const playbackRate = computed(() => player.playbackRate.value);

const index = computed(() => props.queue.findIndex((c) => c.slug === props.chiour.slug));
const previousChiour = computed(() => (index.value > 0 ? props.queue[index.value - 1] : null));
const nextChiour = computed(() =>
  index.value >= 0 && index.value < props.queue.length - 1 ? props.queue[index.value + 1] : null,
);

function start() {
  if (props.queue.length) playFrom(props.queue, props.chiour, "chiour");
  else player.play(chiourTrack(props.chiour), "chiour");
}

function togglePlay() {
  if (isCurrent.value) player.toggle();
  else start();
}

// --- La barre : un curseur natif, qu'on fait glisser au doigt et au clavier ---
const dragging = ref<number | null>(null);
const sliderValue = computed(() => dragging.value ?? progress.value);

function onSliderInput(event: Event) {
  dragging.value = Number((event.target as HTMLInputElement).value);
}

function onSliderChange(event: Event) {
  const ratio = Number((event.target as HTMLInputElement).value) / 100;
  dragging.value = null;
  if (!isCurrent.value) start();
  player.seekRatio(ratio);
}

const sliderLabel = computed(() =>
  t("audioPlayer.position", { current: formattedCurrent.value, total: formatTime(duration.value) }),
);

function skip(seconds: number) {
  if (!isCurrent.value) return;
  player.skip(seconds);
}

function previous() {
  if (isCurrent.value && (player.currentTime.value > 5 || !previousChiour.value)) {
    player.previous();
    return;
  }
  if (!previousChiour.value) return;
  if (isCurrent.value) player.previous();
  else emit("navigate", previousChiour.value.slug);
}

function next() {
  if (!nextChiour.value) return;
  if (isCurrent.value && player.hasNext.value) player.next();
  else emit("navigate", nextChiour.value.slug);
}

function setVolume(event: Event) {
  player.setVolume(Number((event.target as HTMLInputElement).value) / 100);
}

function setSpeed(speed: number) {
  // Le seul réglage d'écoute qui dise quelque chose du public : accélérer, ce
  // sont des habitués qui suivent une série ; ralentir, c'est de l'étude ligne
  // à ligne. Mêmes clés que `chiour_played`, pour recoller les deux.
  analyticsService.capture("chiour_speed_changed", {
    chiour_slug: props.chiour.slug,
    chiour_title: props.chiour.name,
    speed,
  });
  player.setSpeed(speed);
  showSpeedMenu.value = false;
}
</script>

<template>
  <div class="card p-5 md:p-6">
    <!-- La barre : la piste et son remplissage en aplats, le curseur natif par-dessus -->
    <div class="relative h-5">
      <div class="player-track">
        <div class="player-fill" :style="{ width: `${sliderValue}%` }"></div>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="0.1"
        class="player-range"
        :value="sliderValue"
        :aria-label="sliderLabel"
        :aria-valuetext="sliderLabel"
        :disabled="!duration"
        @input="onSliderInput"
        @change="onSliderChange"
      />
    </div>

    <!-- Les temps : écoulé, restant -->
    <div class="mt-1 flex justify-between text-xs tabular-nums text-text-secondary">
      <span>{{ formattedCurrent }}</span>
      <span>{{ formattedLeft }}</span>
    </div>

    <!-- Les commandes -->
    <div class="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <!-- La vitesse -->
      <div class="relative">
        <button
          @click="showSpeedMenu = !showSpeedMenu"
          class="rounded-pill px-3 py-1.5 text-xs font-bold tabular-nums transition-colors"
          :class="
            playbackRate !== 1
              ? 'bg-primary/10 text-primary'
              : 'bg-black/5 text-text-secondary hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15'
          "
          :title="t('audioPlayer.speed')"
          :aria-label="t('audioPlayer.speedValue', { speed: playbackRate })"
          :aria-expanded="showSpeedMenu"
        >
          {{ playbackRate }}×
        </button>
        <Transition name="fade">
          <div
            v-if="showSpeedMenu"
            class="absolute bottom-full left-0 z-10 mb-2 overflow-hidden rounded-control bg-surface shadow-pop rtl:left-auto rtl:right-0"
          >
            <button
              v-for="speed in speeds"
              :key="speed"
              @click="setSpeed(speed)"
              class="block w-full px-4 py-2 text-left text-sm tabular-nums transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              :class="
                speed === playbackRate
                  ? 'bg-primary/5 font-bold text-primary dark:bg-primary/10'
                  : 'text-text-secondary'
              "
            >
              {{ speed }}×
            </button>
          </div>
        </Transition>
      </div>

      <!-- Reculer, précédent, lecture, suivant, avancer -->
      <div class="flex items-center gap-1 sm:gap-3">
        <button
          @click="skip(-15)"
          class="player-skip"
          :disabled="!isCurrent"
          :title="t('audioPlayer.rewind')"
          :aria-label="t('audioPlayer.rewind')"
        >
          <AppIcon name="rotate-ccw" :size="22" />
          <span class="player-skip-n">15</span>
        </button>
        <button
          @click="previous"
          class="player-step"
          :disabled="!previousChiour && !isCurrent"
          :title="t('audioPlayer.previous')"
          :aria-label="t('audioPlayer.previous')"
        >
          <AppIcon name="skip-back" :size="20" class="rtl:rotate-180" />
        </button>
        <button
          @click="togglePlay"
          class="mx-1 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-card transition-transform active:scale-95"
          :title="isPlaying ? t('audioPlayer.pause') : t('audioPlayer.play')"
          :aria-label="isPlaying ? t('audioPlayer.pause') : t('audioPlayer.play')"
        >
          <AppIcon
            :name="isPlaying ? 'pause-solid' : 'play-solid'"
            :size="26"
            :class="{ 'ml-1': !isPlaying }"
          />
        </button>
        <button
          @click="next"
          class="player-step"
          :disabled="!nextChiour"
          :title="t('audioPlayer.next')"
          :aria-label="t('audioPlayer.next')"
        >
          <AppIcon name="skip-forward" :size="20" class="rtl:rotate-180" />
        </button>
        <button
          @click="skip(30)"
          class="player-skip"
          :disabled="!isCurrent"
          :title="t('audioPlayer.forward')"
          :aria-label="t('audioPlayer.forward')"
        >
          <AppIcon name="rotate-cw" :size="22" />
          <span class="player-skip-n">30</span>
        </button>
      </div>

      <!-- Le volume : sur ordinateur (le téléphone a ses boutons) -->
      <div class="hidden items-center justify-end gap-2 md:flex">
        <button
          @click="player.toggleMute()"
          class="text-text-secondary transition-colors hover:text-primary"
          :title="isMuted ? t('audioPlayer.unmute') : t('audioPlayer.mute')"
          :aria-label="isMuted ? t('audioPlayer.unmute') : t('audioPlayer.mute')"
        >
          <AppIcon
            :name="isMuted ? 'volume-x' : volume < 0.5 ? 'volume-low' : 'volume-high'"
            :size="18"
          />
        </button>
        <div class="relative h-5 w-24">
          <div class="player-track">
            <div class="player-fill" :style="{ width: `${volume * 100}%` }"></div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            class="player-range player-range--small"
            :value="volume * 100"
            :aria-label="t('audioPlayer.volume')"
            @input="setVolume"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* La barre de lecture : une piste fine, remplie de la couleur du thème
   jusqu'à la position (deux aplats), et le rond du curseur natif par-dessus,
   qu'on attrape au doigt comme à la souris. */
.player-track {
  position: absolute;
  inset-inline: 0;
  top: 50%;
  height: 4px;
  transform: translateY(-50%);
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-text-primary) 15%, transparent);
}
.player-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--color-primary);
}
[dir="rtl"] .player-fill {
  margin-inline-start: auto;
}
.player-range {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  cursor: pointer;
}
.player-range:disabled {
  cursor: default;
}
.player-range::-webkit-slider-runnable-track {
  height: 100%;
  background: transparent;
}
.player-range::-moz-range-track {
  background: transparent;
}
.player-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  margin-top: 3px;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: var(--shadow-card);
}
.player-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: 0;
  border-radius: 50%;
  background: var(--color-primary);
}
.player-range--small::-webkit-slider-thumb {
  width: 10px;
  height: 10px;
  margin-top: 5px;
}
.player-range--small::-moz-range-thumb {
  width: 10px;
  height: 10px;
}
.player-range:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 4px;
}
.player-skip,
.player-step {
  position: relative;
  display: flex;
  height: 2.75rem;
  width: 2.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--color-text-primary);
  transition:
    color 0.15s,
    opacity 0.15s;
}
.player-skip:hover:not(:disabled),
.player-step:hover:not(:disabled) {
  color: var(--color-primary);
}
.player-skip:disabled,
.player-step:disabled {
  opacity: 0.35;
}
.player-skip-n {
  position: absolute;
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
