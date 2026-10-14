<script setup lang="ts">
/**
 * Un cours dans une liste, comme un morceau dans une playlist : sa pochette
 * (ou son numéro d'épisode), son titre et la ligne qui le situe, où on en est,
 * sa durée.
 *
 * Toute la ligne le joue, en faisant de la liste la file du lecteur ; toucher
 * le cours qui joue le met en pause. Un cours sans audio ouvre sa page, où
 * restent sa description et son texte. Sa page (sa description, le texte qu'il
 * étudie) s'ouvre depuis le lecteur plein écran. Le cours qui joue se
 * reconnaît à sa couleur et à ses barres.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import type { Chiour } from "../../models/models";
import type { PlaySource } from "../../composables/useAudioPlayer";
import {
  chiourCover,
  chiourSubtitle,
  shortTitle,
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
    /** D'où vient la file, en tête du lecteur plein écran (voir playFrom). */
    context?: string | null;
    /** Le nom de la série, retiré du titre qui le répète (voir shortTitle). */
    stripPrefix?: string | null;
  }>(),
  { number: undefined, subtitle: null, context: null, stripPrefix: null },
);

const emit = defineEmits<{ played: [] }>();

const { t, locale } = useI18n();
const router = useRouter();
const { isCurrent, isPlaying, playFrom } = useChiourPlayback();

const current = computed(() => isCurrent(props.chiour.slug));
const playing = computed(() => isPlaying(props.chiour.slug));
const cover = computed(() => chiourCover(props.chiour));
const line = computed(() => props.subtitle ?? chiourSubtitle(props.chiour));
const showNumber = computed(() => props.number !== undefined);
const title = computed(() => shortTitle(props.chiour.name, props.stripPrefix));

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
  !props.chiour.mediaUrl
    ? props.chiour.name
    : playing.value
      ? t("audioPlayer.pauseTitle", { title: props.chiour.name })
      : t("audioPlayer.playTitle", { title: props.chiour.name }),
);

function play() {
  if (!props.chiour.mediaUrl) {
    void router.push(`/chiourim/${props.chiour.slug}`);
    return;
  }
  playFrom(props.list, props.chiour, props.source, props.context);
  emit("played");
}
</script>

<template>
  <button
    type="button"
    class="track group flex w-full items-center gap-3 rounded-control px-2 py-2 text-start transition-colors hover:bg-black/[0.04] active:bg-black/[0.06] dark:hover:bg-white/5"
    :aria-label="playLabel"
    @click="play"
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
      <ChiourCover :seed="cover.seed" :label="cover.label" size="sm" />
      <span
        v-if="current"
        class="absolute inset-0 flex items-center justify-center rounded-md bg-black/65 text-white"
      >
        <NowPlayingBars :playing="playing" />
      </span>
    </span>

    <span class="min-w-0 flex-1">
      <span
        dir="auto"
        class="block truncate font-semibold transition-colors"
        :class="current ? 'text-primary' : 'text-text-primary'"
        >{{ title }}</span
      >
      <span class="flex items-center gap-1.5 text-sm text-text-secondary">
        <AppIcon
          v-if="finished"
          name="circle-check"
          :size="13"
          class="shrink-0 text-secondary"
          :aria-label="t('chiourim.player.finished')"
        />
        <span v-if="line" dir="auto" class="truncate">{{ line }}</span>
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

    <span v-if="timeLabel" class="shrink-0 text-xs tabular-nums text-text-secondary">{{
      timeLabel
    }}</span>
  </button>
</template>
