<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";

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
  audio.value.currentTime = Math.max(0, Math.min(duration.value, audio.value.currentTime + seconds));
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
  <div
    class="bg-white/90 backdrop-blur-md rounded-2xl border border-white/60 p-6 shadow-sm dark:bg-gray-800/80 dark:border-gray-700"
  >
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
    <p
      v-if="title"
      class="text-sm font-medium text-text-secondary mb-4 truncate dark:text-gray-400"
    >
      <i class="fa-solid fa-headphones mr-2 text-primary"></i>{{ title }}
    </p>

    <!-- Barre de progression -->
    <div
      class="group relative h-2 bg-gray-200 rounded-full cursor-pointer mb-3 dark:bg-gray-700"
      @click="seek"
    >
      <div
        class="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-secondary rounded-full transition-[width] duration-100"
        :style="{ width: `${progress}%` }"
      ></div>
      <div
        class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
        :style="{ left: `calc(${progress}% - 8px)` }"
      ></div>
    </div>

    <!-- Temps -->
    <div class="flex justify-between text-xs text-text-secondary mb-4 dark:text-gray-500">
      <span>{{ formattedCurrent }}</span>
      <span>{{ formattedDuration }}</span>
    </div>

    <!-- Contrôles -->
    <div class="flex items-center justify-between">
      <!-- Gauche : volume -->
      <div class="flex items-center gap-2 w-1/4">
        <button
          @click="toggleMute"
          class="text-text-secondary hover:text-primary transition-colors dark:text-gray-400 dark:hover:text-primary"
          :title="isMuted ? t('audioPlayer.unmute') : t('audioPlayer.mute')"
        >
          <i
            :class="
              isMuted
                ? 'fa-solid fa-volume-xmark'
                : volume < 0.5
                  ? 'fa-solid fa-volume-low'
                  : 'fa-solid fa-volume-high'
            "
          ></i>
        </button>
        <div
          class="hidden sm:block relative h-1.5 w-20 bg-gray-200 rounded-full cursor-pointer dark:bg-gray-700"
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
          class="text-text-secondary hover:text-primary transition-colors text-sm dark:text-gray-400 dark:hover:text-primary"
          :title="t('audioPlayer.rewind')"
        >
          <i class="fa-solid fa-backward"></i>
          <span class="text-[10px] ml-0.5">15</span>
        </button>

        <button
          @click="togglePlay"
          class="w-12 h-12 flex items-center justify-center bg-gradient-to-r from-primary to-secondary text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
          :title="isPlaying ? t('audioPlayer.pause') : t('audioPlayer.play')"
        >
          <i :class="isPlaying ? 'fa-solid fa-pause text-lg' : 'fa-solid fa-play text-lg ml-0.5'"></i>
        </button>

        <button
          @click="skip(30)"
          class="text-text-secondary hover:text-primary transition-colors text-sm dark:text-gray-400 dark:hover:text-primary"
          :title="t('audioPlayer.forward')"
        >
          <span class="text-[10px] mr-0.5">30</span>
          <i class="fa-solid fa-forward"></i>
        </button>
      </div>

      <!-- Droite : vitesse -->
      <div class="relative w-1/4 flex justify-end">
        <button
          @click="showSpeedMenu = !showSpeedMenu"
          class="px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors"
          :class="
            playbackRate !== 1
              ? 'bg-primary/10 text-primary border-primary/30 dark:bg-primary/20'
              : 'bg-gray-100 text-text-secondary border-gray-200 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-600'
          "
          :title="t('audioPlayer.speed')"
        >
          {{ playbackRate }}x
        </button>

        <Transition name="fade">
          <div
            v-if="showSpeedMenu"
            class="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-10 dark:bg-gray-800 dark:border-gray-700"
          >
            <button
              v-for="speed in speeds"
              :key="speed"
              @click="setSpeed(speed)"
              class="block w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors dark:hover:bg-gray-700"
              :class="
                speed === playbackRate
                  ? 'text-primary font-bold bg-primary/5 dark:bg-primary/10'
                  : 'text-text-secondary dark:text-gray-400'
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
