<script setup lang="ts">
/**
 * La vitesse d'écoute, en une pastille : chaque appui passe à la vitesse
 * suivante (1×, 1,25×, 1,5×, 1,75×, 2×, puis 0,75×), comme les lecteurs de
 * podcasts. Pas de menu à ouvrir pendant qu'on marche.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useAudioPlayer } from "../../composables/useAudioPlayer";
import { analyticsService } from "../../services/analyticsService";

const SPEEDS = [1, 1.25, 1.5, 1.75, 2, 0.75];

const { t, locale } = useI18n();
const player = useAudioPlayer();

const rate = computed(() => player.playbackRate.value.toLocaleString(locale.value));
const label = computed(() => `${rate.value}×`);

function next() {
  const index = SPEEDS.indexOf(player.playbackRate.value);
  const speed = SPEEDS[(index + 1) % SPEEDS.length];
  // Le seul réglage d'écoute qui dise quelque chose du public : accélérer, ce
  // sont des habitués qui suivent une série ; ralentir, c'est de l'étude ligne
  // à ligne. Mêmes clés que `chiour_played`, pour recoller les deux.
  analyticsService.capture("chiour_speed_changed", {
    chiour_slug: player.track.value?.slug ?? null,
    chiour_title: player.track.value?.title ?? null,
    speed,
  });
  player.setSpeed(speed);
}
</script>

<template>
  <button
    type="button"
    class="min-w-[3.25rem] rounded-pill px-3 py-1.5 text-sm font-bold tabular-nums transition-colors"
    :aria-label="t('audioPlayer.speedValue', { speed: rate })"
    :title="t('audioPlayer.speed')"
    @click="next"
  >
    {{ label }}
  </button>
</template>
