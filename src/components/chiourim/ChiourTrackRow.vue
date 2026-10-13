<script setup lang="ts">
/**
 * Un cours dans une liste, comme un morceau dans un album : sa pochette (ou
 * son numéro d'épisode), son titre et son rav, où on en est, sa durée, et le
 * bouton qui le lance.
 *
 * Deux gestes, deux cibles : la ligne mène à la page du cours (sa
 * description, le texte qu'il étudie) ; le bouton rond au bout le joue tout
 * de suite, en faisant de la liste la file du lecteur. Le cours qui joue se
 * reconnaît à sa couleur et à ses barres.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { Chiour } from "../../models/models";
import type { PlaySource } from "../../composables/useAudioPlayer";
import {
  chiourCover,
  chiourSubtitle,
  useChiourPlayback,
} from "../../composables/useChiourPlayback";
import { isFinished, listeningOf, progressOf } from "../../services/listeningProgress";
import { formatMinutes } from "./duration";
import AppIcon from "../icons/AppIcon.vue";
import ChiourCover from "./ChiourCover.vue";
import NowPlayingBars from "./NowPlayingBars.vue";

const props = withDefaults(
  defineProps<{
    chiour: Chiour;
    /** La liste affichée, qui devient la file quand on lance ce cours. */
    list: Chiour[];
    source: PlaySource;
    /** Un numéro à la place de la pochette (l'épisode, dans une série). */
    number?: number | null;
    /** La ligne sous le titre ; par défaut le rav et la série. */
    subtitle?: string | null;
  }>(),
  { number: undefined, subtitle: null },
);

const emit = defineEmits<{ open: [] }>();

const { t, locale } = useI18n();
const { isCurrent, isPlaying, playFrom } = useChiourPlayback();

const current = computed(() => isCurrent(props.chiour.slug));
const playing = computed(() => isPlaying(props.chiour.slug));
const cover = computed(() => chiourCover(props.chiour));
const line = computed(() => props.subtitle ?? chiourSubtitle(props.chiour));
const showNumber = computed(() => props.number !== undefined);

const finished = computed(() => isFinished(props.chiour.slug));
const progress = computed(() => progressOf(props.chiour.slug));
const started = computed(() => !finished.value && progress.value > 0);

/** La durée, ou ce qu'il reste d'un cours entamé. */
const timeLabel = computed(() => {
  const duration = props.chiour.duration ?? listeningOf(props.chiour.slug)?.d ?? 0;
  if (!duration) return "";
  if (started.value) {
    const left = duration - (listeningOf(props.chiour.slug)?.t ?? 0);
    return t("chiourim.player.left", { time: formatMinutes(left, locale.value) });
  }
  return formatMinutes(duration, locale.value);
});

const playLabel = computed(() =>
  playing.value
    ? t("audioPlayer.pauseTitle", { title: props.chiour.name })
    : t("audioPlayer.playTitle", { title: props.chiour.name }),
);
</script>

<template>
  <div
    class="track group flex items-center gap-3 rounded-control px-2 py-2 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/5"
  >
    <router-link
      :to="`/chiourim/${chiour.slug}`"
      class="flex min-w-0 flex-1 items-center gap-3"
      @click="emit('open')"
    >
      <!-- Le numéro d'épisode, ou la pochette ; les barres sur le cours qui joue -->
      <span
        v-if="showNumber"
        class="flex w-7 shrink-0 justify-center text-sm tabular-nums"
        :class="current ? 'text-primary' : 'text-text-secondary'"
      >
        <NowPlayingBars v-if="current" :playing="playing" />
        <template v-else>{{ number ?? "·" }}</template>
      </span>
      <span v-else class="relative shrink-0">
        <ChiourCover :seed="cover.seed" :label="cover.label" size="xs" />
        <span
          v-if="current"
          class="absolute inset-0 flex items-center justify-center rounded-md bg-black/65 text-white"
        >
          <NowPlayingBars :playing="playing" />
        </span>
      </span>

      <span class="min-w-0 flex-1">
        <span
          class="block truncate font-semibold transition-colors"
          :class="current ? 'text-primary' : 'text-text-primary group-hover:text-primary'"
          >{{ chiour.name }}</span
        >
        <span class="flex items-center gap-2 text-sm text-text-secondary">
          <AppIcon
            v-if="finished"
            name="circle-check"
            :size="13"
            class="shrink-0 text-secondary"
            :aria-label="t('chiourim.player.finished')"
          />
          <span v-if="line" class="truncate">{{ line }}</span>
        </span>
        <!-- Entamé : où on en est -->
        <span
          v-if="started"
          class="mt-1.5 block h-[3px] w-24 overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
          aria-hidden="true"
        >
          <span class="block h-full bg-primary" :style="{ width: `${progress * 100}%` }" />
        </span>
      </span>
    </router-link>

    <span
      v-if="timeLabel"
      class="hidden shrink-0 text-sm tabular-nums text-text-secondary sm:block"
      >{{ timeLabel }}</span
    >

    <button
      v-if="chiour.mediaUrl"
      type="button"
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors"
      :class="
        current
          ? 'bg-brand text-on-brand'
          : 'bg-black/5 text-text-primary hover:bg-brand hover:text-on-brand dark:bg-white/10'
      "
      :aria-label="playLabel"
      :title="playLabel"
      @click="playFrom(list, chiour, source)"
    >
      <AppIcon
        :name="playing ? 'pause-solid' : 'play-solid'"
        :size="16"
        :class="{ 'ml-0.5': !playing }"
      />
    </button>
  </div>
</template>
