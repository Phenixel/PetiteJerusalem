<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import { useAudioPlayer, formatTime } from "../composables/useAudioPlayer";

const { t } = useI18n();

interface Props {
  src: string;
  title?: string;
  slug?: string;
}

const props = defineProps<Props>();

const player = useAudioPlayer();
const showSpeedMenu = ref(false);

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// Ce composant est une vue sur le lecteur global : il est « actif » quand le
// morceau chargé dans le lecteur global est le sien.
const isCurrent = computed(() => player.track.value?.src === props.src);
const isPlaying = computed(() => isCurrent.value && player.isPlaying.value);

// Durée affichée avant lecture : sondée via un <audio> jetable (métadonnées
// seules), sans toucher au lecteur global qui joue peut-être un autre morceau.
const probedDuration = ref(0);
let probe: HTMLAudioElement | null = null;

function probeDuration(src: string) {
  probedDuration.value = 0;
  if (probe) {
    probe.removeAttribute("src");
    probe = null;
  }
  if (!src) return;
  probe = new Audio();
  probe.preload = "metadata";
  probe.addEventListener("loadedmetadata", function (this: HTMLAudioElement) {
    if (probe === this) probedDuration.value = this.duration;
  });
  probe.src = src;
}

watch(() => props.src, probeDuration, { immediate: true });

onUnmounted(() => {
  if (probe) {
    probe.removeAttribute("src");
    probe = null;
  }
});

const currentTime = computed(() => (isCurrent.value ? player.currentTime.value : 0));
const duration = computed(() =>
  isCurrent.value && player.duration.value ? player.duration.value : probedDuration.value,
);
const progress = computed(() => {
  if (!duration.value) return 0;
  return (currentTime.value / duration.value) * 100;
});

const formattedCurrent = computed(() => formatTime(currentTime.value));
const formattedDuration = computed(() => formatTime(duration.value));
const isMuted = computed(() => player.isMuted.value);
const volume = computed(() => player.volume.value);
const playbackRate = computed(() => player.playbackRate.value);

function ownTrack() {
  return { src: props.src, title: props.title ?? "", slug: props.slug };
}

function togglePlay() {
  if (isCurrent.value) {
    player.toggle();
  } else {
    player.play(ownTrack());
  }
}

function seek(event: MouseEvent) {
  const bar = event.currentTarget as HTMLElement;
  const rect = bar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  if (!isCurrent.value) player.play(ownTrack());
  player.seekRatio(ratio);
}

function skip(seconds: number) {
  if (!isCurrent.value) return;
  player.skip(seconds);
}

function setVolume(event: MouseEvent) {
  const bar = event.currentTarget as HTMLElement;
  const rect = bar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  player.setVolume(ratio);
}

function setSpeed(speed: number) {
  player.setSpeed(speed);
  showSpeedMenu.value = false;
}
</script>

<template>
  <div class="card p-6">
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
          @click="player.toggleMute()"
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
          class="inline-flex items-center whitespace-nowrap text-text-secondary hover:text-primary transition-colors text-sm"
          :title="t('audioPlayer.rewind')"
        >
          <AppIcon name="backward" :size="14" />
          <span class="text-[10px] ml-0.5">15</span>
        </button>

        <button
          @click="togglePlay"
          class="w-12 h-12 flex items-center justify-center bg-primary text-white rounded-full transition-colors shrink-0"
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
          class="inline-flex items-center whitespace-nowrap text-text-secondary hover:text-primary transition-colors text-sm"
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
