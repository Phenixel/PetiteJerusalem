<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import AppIcon from "./icons/AppIcon.vue";
import ChiourCover from "./chiourim/ChiourCover.vue";
import { useAudioPlayer, useMiniPlayerVisible } from "../composables/useAudioPlayer";
import { isNativeApp } from "../composables/useNativeApp";

/**
 * Le mini-lecteur : le cours qui joue reste sous la main d'une page à
 * l'autre, au-dessus de la barre de l'app. Sa pochette et son titre mènent à
 * la page du cours (l'écran « en cours de lecture ») ; les commandes jouent,
 * mettent en pause, passent au cours suivant de la file, ou ferment.
 *
 * Il est monté sur toutes les pages : rien ici ne doit tirer Firestore ni le
 * catalogue (voir initialBundle.test.ts). Le morceau porte de quoi dessiner
 * sa pochette et sa ligne (AudioTrack.cover, AudioTrack.subtitle).
 */

const { t } = useI18n();
const router = useRouter();

const player = useAudioPlayer();
const isVisible = useMiniPlayerVisible();

function seek(event: MouseEvent) {
  const bar = event.currentTarget as HTMLElement;
  const rect = bar.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  const rtl = getComputedStyle(bar).direction === "rtl";
  player.seekRatio(rtl ? 1 - ratio : ratio);
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
      class="fixed inset-x-0 z-40 px-2 pb-2"
      :class="
        isNativeApp
          ? 'bottom-[calc(3.5rem+var(--safe-bottom))]'
          : 'bottom-0 pb-[calc(0.5rem+env(safe-area-inset-bottom))]'
      "
      role="region"
      :aria-label="t('audioPlayer.nowPlaying')"
    >
      <div class="mx-auto max-w-3xl overflow-hidden rounded-control bg-surface shadow-pop">
        <div class="flex items-center gap-3 px-2 py-2">
          <!-- La pochette et le titre : la page du cours -->
          <button
            class="flex min-w-0 flex-1 items-center gap-3 text-left"
            :class="{ 'cursor-default': !player.track.value.slug }"
            :title="player.track.value.slug ? t('audioPlayer.goToChiour') : undefined"
            @click="goToChiour"
          >
            <ChiourCover
              v-if="player.track.value.cover"
              :seed="player.track.value.cover.seed"
              :label="player.track.value.cover.label"
              size="xs"
            />
            <span
              v-else
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
            >
              <AppIcon name="headphones" :size="16" />
            </span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-semibold text-text-primary">{{
                player.track.value.title
              }}</span>
              <span
                v-if="player.track.value.subtitle"
                class="block truncate text-xs text-text-secondary"
                >{{ player.track.value.subtitle }}</span
              >
            </span>
          </button>

          <!-- Les commandes -->
          <div class="flex shrink-0 items-center gap-1">
            <button
              @click="player.skip(-15)"
              class="hidden h-10 w-10 items-center justify-center rounded-full text-text-secondary transition-colors hover:text-primary sm:flex"
              :title="t('audioPlayer.rewind')"
              :aria-label="t('audioPlayer.rewind')"
            >
              <AppIcon name="rotate-ccw" :size="18" />
            </button>
            <button
              @click="player.toggle()"
              class="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-on-brand transition-transform active:scale-95"
              :title="player.isPlaying.value ? t('audioPlayer.pause') : t('audioPlayer.play')"
              :aria-label="player.isPlaying.value ? t('audioPlayer.pause') : t('audioPlayer.play')"
            >
              <AppIcon
                :name="player.isPlaying.value ? 'pause-solid' : 'play-solid'"
                :size="16"
                :class="{ 'ml-0.5': !player.isPlaying.value }"
              />
            </button>
            <button
              v-if="player.hasNext.value"
              @click="player.next()"
              class="flex h-10 w-10 items-center justify-center rounded-full text-text-primary transition-colors hover:text-primary"
              :title="t('audioPlayer.next')"
              :aria-label="t('audioPlayer.next')"
            >
              <AppIcon name="skip-forward" :size="18" class="rtl:rotate-180" />
            </button>
            <button
              @click="player.close()"
              class="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition-colors hover:text-text-primary"
              :title="t('audioPlayer.close')"
              :aria-label="t('audioPlayer.close')"
            >
              <AppIcon name="x" :size="16" />
            </button>
          </div>
        </div>

        <!-- La barre, au bord bas : on y touche pour aller plus loin -->
        <div class="mini-progress cursor-pointer" @click="seek">
          <div class="h-full bg-primary" :style="{ width: `${player.progress.value}%` }"></div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.mini-progress {
  height: 3px;
  background: color-mix(in srgb, var(--color-text-primary) 10%, transparent);
}
[dir="rtl"] .mini-progress > div {
  margin-inline-start: auto;
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
