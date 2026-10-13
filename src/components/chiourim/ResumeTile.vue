<script setup lang="ts">
/**
 * Un cours entamé, dans la rangée « Reprendre l'écoute » : sa pochette avec
 * la barre de ce qui est écouté, son titre, ce qu'il en reste. Toute la tuile
 * relance l'écoute là où on l'a laissée (la file reprend avec la série) ; le
 * cours qui joue se met en pause.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { Chiour } from "../../models/models";
import { chiourCover, useChiourPlayback } from "../../composables/useChiourPlayback";
import { listeningOf, progressOf } from "../../services/listeningProgress";
import { formatMinutes } from "./duration";
import AppIcon from "../icons/AppIcon.vue";
import ChiourCover from "./ChiourCover.vue";

const props = defineProps<{ chiour: Chiour; queue: Chiour[] }>();

const { t, locale } = useI18n();
const { isPlaying, playFrom } = useChiourPlayback();

const cover = computed(() => chiourCover(props.chiour));
const playing = computed(() => isPlaying(props.chiour.slug));
const left = computed(() => {
  const entry = listeningOf(props.chiour.slug);
  const duration = props.chiour.duration ?? entry?.d ?? 0;
  if (!entry || !duration) return "";
  return t("chiourim.player.left", { time: formatMinutes(duration - entry.t, locale.value) });
});
</script>

<template>
  <button
    type="button"
    class="group block w-36 shrink-0 text-left sm:w-44"
    :aria-label="
      playing
        ? t('audioPlayer.pauseTitle', { title: chiour.name })
        : t('chiourim.resumeTitle', { title: chiour.name })
    "
    @click="playFrom(queue, chiour, 'reprise')"
  >
    <span class="relative block">
      <ChiourCover :seed="cover.seed" :label="cover.label" size="md" class="shadow-card" />
      <span
        class="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-on-brand shadow-pop transition-transform group-hover:scale-105 rtl:left-3 rtl:right-auto"
      >
        <AppIcon
          :name="playing ? 'pause-solid' : 'play-solid'"
          :size="18"
          :class="{ 'ml-0.5': !playing }"
        />
      </span>
      <span class="absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-card bg-black/30">
        <span
          class="block h-full bg-brand"
          :style="{ width: `${progressOf(chiour.slug) * 100}%` }"
        />
      </span>
    </span>
    <span
      class="mt-2 line-clamp-2 block font-semibold leading-snug text-text-primary group-hover:text-primary"
      >{{ chiour.name }}</span
    >
    <span v-if="left" class="block truncate text-sm text-text-secondary">{{ left }}</span>
  </button>
</template>
