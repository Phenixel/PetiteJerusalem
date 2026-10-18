<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { analyticsService } from "../../services/analyticsService";
import {
  type HelpVideo,
  videoTitle,
  youtubeThumbnail,
  youtubeUrl,
} from "../../services/helpVideos";
import AppIcon from "../icons/AppIcon.vue";

/**
 * A tutorial video of the help center (services/helpVideos.ts): its picture,
 * its title and its length, the whole card opening it on YouTube (the
 * YouTube app when the phone has it). Nothing of YouTube loads in the app
 * but the picture: no player, no cookie.
 *
 * `place`: where the card stands, for the tracking (the help center's list,
 * or the end of a guide).
 */

const props = defineProps<{ video: HelpVideo; place: "center" | "guide"; guide?: string }>();

const { t, locale } = useI18n();
const thumbnailFailed = ref(false);

function opened(): void {
  analyticsService.capture("help_video_opened", {
    video: props.video.youtube,
    place: props.place,
    guide: props.guide ?? null,
  });
}
</script>

<template>
  <a
    :href="youtubeUrl(video)"
    target="_blank"
    rel="noopener noreferrer"
    class="card card-hover press-feedback group flex flex-col overflow-hidden"
    @click="opened"
  >
    <span class="thumb relative block" aria-hidden="true">
      <img
        v-if="!thumbnailFailed"
        :src="youtubeThumbnail(video)"
        alt=""
        class="h-full w-full object-cover"
        loading="lazy"
        @error="thumbnailFailed = true"
      />
      <span class="absolute inset-0 flex items-center justify-center">
        <span class="play"><AppIcon name="play-solid" :size="14" /></span>
      </span>
      <span v-if="video.duration" class="duration">{{ video.duration }}</span>
    </span>
    <span class="flex flex-1 flex-col gap-1 p-3.5">
      <span
        class="font-semibold leading-snug text-text-primary transition-colors group-hover:text-primary"
      >
        {{ videoTitle(video, locale) }}
      </span>
      <span class="mt-auto flex items-center gap-1.5 text-xs font-medium text-text-secondary">
        <AppIcon name="external-link" :size="12" />
        {{ t("help.watchOnYoutube") }}
      </span>
    </span>
  </a>
</template>

<style scoped>
.thumb {
  aspect-ratio: 16 / 9;
  background-color: color-mix(in srgb, var(--color-text-primary) 8%, var(--color-surface));
}

.play {
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  place-items: center;
  border-radius: 999px;
  background-color: var(--color-surface);
  color: var(--color-primary);
  box-shadow: var(--shadow-pop);
}

/* Its length, in the corner of the picture, as YouTube writes it. */
.duration {
  position: absolute;
  right: 0.45rem;
  bottom: 0.45rem;
  padding: 0.05rem 0.4rem;
  border-radius: var(--radius-pill);
  background-color: rgb(0 0 0 / 0.72);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
