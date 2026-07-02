<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";

const { t } = useI18n();

interface Props {
  src: string;
  title?: string;
}

const props = defineProps<Props>();

const audio = ref<HTMLAudioElement | null>(null);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(1);
const previousVolume = ref(1);
const playbackRate = ref(1);
const isLoaded = ref(false);
const showSpeedMenu = ref(false);

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const sStr = s.toString().padStart(2, "0");
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sStr}`;
  return `${m}:${sStr}`;
};

const progress = computed(() => {
  if (!duration.value) return 0;
  return (currentTime.value / duration.value) * 100;
});

const formattedCurrent = computed(() => formatTime(currentTime.value));
const formattedDuration = computed(() => formatTime(duration.value));
const isMuted = computed(() => volume.value === 0);

function togglePlay() {
  if (!audio.value) return;
  if (isPlaying.value) {
    audio.value.pause();
  } else {
    audio.value.play();
  }
}

function seek(event: MouseEvent) {
  if (!audio.value || !duration.value) return;
  const bar = event.currentTarget as HTMLElement;
  const rect = bar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  audio.value.currentTime = ratio * duration.value;
}

function skip(seconds: number) {
  if (!audio.value) return;
  audio.value.currentTime = Math.max(
    0,
    Math.min(duration.value, audio.value.currentTime + seconds),
  );
}

function setVolume(event: MouseEvent) {
  const bar = event.currentTarget as HTMLElement;
  const rect = bar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  volume.value = ratio;
  if (audio.value) audio.value.volume = ratio;
}

function toggleMute() {
  if (volume.value > 0) {
    previousVolume.value = volume.value;
    volume.value = 0;
  } else {
    volume.value = previousVolume.value || 1;
  }
  if (audio.value) audio.value.volume = volume.value;
}

function setSpeed(speed: number) {
  playbackRate.value = speed;
  if (audio.value) audio.value.playbackRate = speed;
  showSpeedMenu.value = false;
}

function onLoadedMetadata() {
  if (audio.value) {
    duration.value = audio.value.duration;
    isLoaded.value = true;
  }
}

function onTimeUpdate() {
  if (audio.value) currentTime.value = audio.value.currentTime;
}

function onEnded() {
  isPlaying.value = false;
}

function onPlay() {
  isPlaying.value = true;
}

function onPause() {
  isPlaying.value = false;
}

watch(
  () => props.src,
  () => {
    isPlaying.value = false;
    currentTime.value = 0;
    duration.value = 0;
    isLoaded.value = false;
  },
);

onUnmounted(() => {
  if (audio.value) {
    audio.value.pause();
  }
});
</script>

<template>
  <div class="card p-6">
    <audio
      ref="audio"
      :src="src"
      preload="metadata"
      @loadedmetadata="onLoadedMetadata"
      @timeupdate="onTimeUpdate"
      @ended="onEnded"
      @play="onPlay"
      @pause="onPause"
    ></audio>

    <!-- Titre si fourni -->
    <p v-if="title" class="text-sm font-medium text-text-secondary mb-4 truncate">
      <AppIcon name="headphones" :size="14" class="mr-2 text-primary" />{{ title }}
    </p>

    <!-- Barre de progression -->
    <div
      class="group relative h-2 bg-black/10 rounded-full cursor-pointer mb-3 dark:bg-white/10"
      @click="seek"
    >
      <div
        class="absolute inset-y-0 left-0 bg-primary rounded-full transition-[width] duration-100"
        :style="{ width: `${progress}%` }"
      ></div>
      <div
        class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
        :style="{ left: `calc(${progress}% - 8px)` }"
      ></div>
    </div>

    <!-- Temps -->
    <div class="flex justify-between text-xs text-text-secondary mb-4">
      <span>{{ formattedCurrent }}</span>
      <span>{{ formattedDuration }}</span>
    </div>

    <!-- Contrôles -->
    <div class="flex items-center justify-between">
      <!-- Gauche : volume -->
      <div class="flex items-center gap-2 w-1/4">
        <button
          @click="toggleMute"
          class="text-text-secondary hover:text-primary transition-colors"
          :title="isMuted ? t('audioPlayer.unmute') : t('audioPlayer.mute')"
        >
          <AppIcon
            :name="isMuted ? 'volume-x' : volume < 0.5 ? 'volume-low' : 'volume-high'"
            :size="16"
          />
        </button>
        <div
          class="hidden sm:block relative h-1.5 w-20 bg-black/10 rounded-full cursor-pointer dark:bg-white/10"
          @click="setVolume"
        >
          <div
            class="absolute inset-y-0 left-0 bg-primary/60 rounded-full"
            :style="{ width: `${volume * 100}%` }"
          ></div>
        </div>
      </div>

      <!-- Centre : play/skip -->
      <div class="flex items-center gap-4">
        <button
          @click="skip(-15)"
          class="text-text-secondary hover:text-primary transition-colors text-sm"
          :title="t('audioPlayer.rewind')"
        >
          <AppIcon name="backward" :size="14" />
          <span class="text-[10px] ml-0.5">15</span>
        </button>

        <button
          @click="togglePlay"
          class="w-12 h-12 flex items-center justify-center bg-primary text-white rounded-full transition-colors"
          :title="isPlaying ? t('audioPlayer.pause') : t('audioPlayer.play')"
        >
          <AppIcon
            :name="isPlaying ? 'pause' : 'play'"
            :size="20"
            :class="{ 'ml-0.5': !isPlaying }"
          />
        </button>

        <button
          @click="skip(30)"
          class="text-text-secondary hover:text-primary transition-colors text-sm"
          :title="t('audioPlayer.forward')"
        >
          <span class="text-[10px] mr-0.5">30</span>
          <AppIcon name="forward" :size="14" />
        </button>
      </div>

      <!-- Droite : vitesse -->
      <div class="relative w-1/4 flex justify-end">
        <button
          @click="showSpeedMenu = !showSpeedMenu"
          class="px-3 py-1.5 text-xs font-bold rounded-lg transition-colors"
          :class="
            playbackRate !== 1
              ? 'bg-primary/10 text-primary'
              : 'bg-black/5 text-text-secondary hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15'
          "
          :title="t('audioPlayer.speed')"
        >
          {{ playbackRate }}x
        </button>

        <Transition name="fade">
          <div
            v-if="showSpeedMenu"
            class="absolute bottom-full right-0 mb-2 bg-surface rounded-lg shadow-pop overflow-hidden z-10"
          >
            <button
              v-for="speed in speeds"
              :key="speed"
              @click="setSpeed(speed)"
              class="block w-full px-4 py-2 text-sm text-left hover:bg-black/5 transition-colors dark:hover:bg-white/10"
              :class="
                speed === playbackRate
                  ? 'text-primary font-bold bg-primary/5 dark:bg-primary/10'
                  : 'text-text-secondary'
              "
            >
              {{ speed }}x
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
