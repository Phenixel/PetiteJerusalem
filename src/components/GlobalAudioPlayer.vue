<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import AppIcon from "./icons/AppIcon.vue";
import {
  useAudioPlayer,
  useMiniPlayerVisible,
  formatTime,
} from "../composables/useAudioPlayer";
import { isNativeApp } from "../composables/useNativeApp";
import { computed } from "vue";

const { t } = useI18n();
const router = useRouter();

const player = useAudioPlayer();
const isVisible = useMiniPlayerVisible();

const formattedCurrent = computed(() => formatTime(player.currentTime.value));
const formattedDuration = computed(() => formatTime(player.duration.value));

function seek(event: MouseEvent) {
  const bar = event.currentTarget as HTMLElement;
  const rect = bar.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  player.seekRatio(ratio);
}

function goToChiour() {
  if (player.track.value?.slug) {
    router.push(`/chiourim/${player.track.value.slug}`);
  }
}
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="isVisible && player.track.value"
      class="fixed inset-x-0 z-40 bg-surface shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
      :class="
        isNativeApp
          ? 'bottom-[calc(3.5rem+env(safe-area-inset-bottom))]'
          : 'bottom-0 pb-[env(safe-area-inset-bottom)]'
      "
      role="region"
      :aria-label="t('audioPlayer.nowPlaying')"
    >
      <!-- Barre de progression cliquable, collée au bord haut -->
      <div class="group relative h-1.5 bg-black/10 cursor-pointer dark:bg-white/10" @click="seek">
        <div
          class="absolute inset-y-0 left-0 bg-primary transition-[width] duration-100"
          :style="{ width: `${player.progress.value}%` }"
        ></div>
      </div>

      <div class="mx-auto max-w-4xl px-4 py-2.5 flex items-center gap-3">
        <!-- Titre : lien vers la page du chiour -->
        <button
          class="flex items-center gap-2 min-w-0 flex-1 text-left text-sm font-medium text-text-primary hover:text-primary transition-colors"
          :class="{ 'cursor-default hover:text-text-primary': !player.track.value.slug }"
          @click="goToChiour"
          :title="player.track.value.slug ? t('audioPlayer.goToChiour') : undefined"
        >
          <AppIcon name="headphones" :size="14" class="text-primary shrink-0" />
          <span class="truncate">{{ player.track.value.title }}</span>
        </button>

        <!-- Temps (masqué en très petit écran) -->
        <span class="hidden sm:block text-xs text-text-secondary whitespace-nowrap tabular-nums">
          {{ formattedCurrent }} / {{ formattedDuration }}
        </span>

        <!-- Contrôles -->
        <div class="flex items-center gap-3 shrink-0">
          <button
            @click="player.skip(-15)"
            class="hidden sm:inline-flex items-center whitespace-nowrap text-text-secondary hover:text-primary transition-colors"
            :title="t('audioPlayer.rewind')"
          >
            <AppIcon name="backward" :size="13" />
            <span class="text-[9px] ml-0.5">15</span>
          </button>

          <button
            @click="player.toggle()"
            class="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-full transition-colors shrink-0"
            :title="player.isPlaying.value ? t('audioPlayer.pause') : t('audioPlayer.play')"
          >
            <AppIcon
              :name="player.isPlaying.value ? 'pause' : 'play'"
              :size="16"
              :class="{ 'ml-0.5': !player.isPlaying.value }"
            />
          </button>

          <button
            @click="player.skip(30)"
            class="hidden sm:inline-flex items-center whitespace-nowrap text-text-secondary hover:text-primary transition-colors"
            :title="t('audioPlayer.forward')"
          >
            <span class="text-[9px] mr-0.5">30</span>
            <AppIcon name="forward" :size="13" />
          </button>

          <button
            @click="player.close()"
            class="text-text-secondary hover:text-text-primary transition-colors ml-1"
            :title="t('audioPlayer.close')"
          >
            <AppIcon name="x" :size="16" />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
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
