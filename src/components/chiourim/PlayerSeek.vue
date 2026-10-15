<script setup lang="ts">
/**
 * La barre de lecture du cours qui joue : une piste fine remplie jusqu'à la
 * position (deux aplats, dans la couleur du texte qui l'entoure), le rond du
 * curseur natif par-dessus, qu'on fait glisser au doigt, à la souris ou au
 * clavier. Les temps, écoulé et total, dessous ou de part et d'autre.
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { formatTime, useAudioPlayer } from "../../composables/useAudioPlayer";

const props = withDefaults(defineProps<{ inline?: boolean }>(), { inline: false });

const { t } = useI18n();
const player = useAudioPlayer();

const dragging = ref<number | null>(null);
const duration = computed(() => player.duration.value || player.track.value?.duration || 0);
const value = computed(() => {
  if (dragging.value !== null) return dragging.value;
  return duration.value ? (player.currentTime.value / duration.value) * 100 : 0;
});
const shownTime = computed(() =>
  dragging.value !== null ? (dragging.value / 100) * duration.value : player.currentTime.value,
);
const current = computed(() => formatTime(shownTime.value));
const total = computed(() => formatTime(duration.value));
const label = computed(() =>
  t("audioPlayer.position", { current: current.value, total: total.value }),
);

function onInput(event: Event) {
  dragging.value = Number((event.target as HTMLInputElement).value);
}

function onChange(event: Event) {
  dragging.value = null;
  player.seekRatio(Number((event.target as HTMLInputElement).value) / 100);
}
</script>

<template>
  <div :class="props.inline ? 'flex items-center gap-3' : ''">
    <span v-if="props.inline" class="w-10 text-end text-xs tabular-nums opacity-75">{{
      current
    }}</span>
    <div class="relative h-5 flex-1">
      <div class="seek-track">
        <div class="seek-fill" :style="{ width: `${value}%` }"></div>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="0.1"
        class="seek-range"
        :value="value"
        :aria-label="label"
        :aria-valuetext="label"
        :disabled="!duration"
        @input="onInput"
        @change="onChange"
      />
    </div>
    <span v-if="props.inline" class="w-10 text-xs tabular-nums opacity-75">{{ total }}</span>
    <div v-else class="mt-1 flex justify-between text-xs tabular-nums opacity-75">
      <span>{{ current }}</span>
      <span>{{ total }}</span>
    </div>
  </div>
</template>

<style scoped>
.seek-track {
  position: absolute;
  inset-inline: 0;
  top: 50%;
  height: 4px;
  transform: translateY(-50%);
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 25%, transparent);
}
.seek-fill {
  height: 100%;
  border-radius: 999px;
  background: currentColor;
}
.seek-range {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  cursor: pointer;
  color: inherit;
}
.seek-range:disabled {
  cursor: default;
}
.seek-range::-webkit-slider-runnable-track {
  height: 100%;
  background: transparent;
}
.seek-range::-moz-range-track {
  background: transparent;
}
.seek-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  margin-top: 3px;
  border-radius: 50%;
  background: currentColor;
}
.seek-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: 0;
  border-radius: 50%;
  background: currentColor;
}
.seek-range:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
