<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useWhatsNew, WHATS_NEW_VERSION, whatsNewVideoUrl } from "../../composables/useWhatsNew";
import AppIcon from "../icons/AppIcon.vue";

/**
 * The "what's new" video, at the top of the help center: whoever skipped it
 * at launch, or wants to see it again, finds it here (useWhatsNew).
 *
 * The whole card plays it, and says so: the video's own poster (its
 * opening, « Bienvenue dans la 4.0 ») with the play button on it, and
 * « Regarder » spelled out. The poster comes from the site like the video:
 * offline, the card keeps its play button on a plain tint, and the video
 * says itself that it could not load.
 *
 * `title`: on the page of the version, whose own title already names it,
 * the card says « Toute la vidéo » ("The whole video").
 */

const props = defineProps<{ title?: string }>();

const { t, locale } = useI18n();
const { replayWhatsNew } = useWhatsNew();

const poster = whatsNewVideoUrl(locale.value, "jpg");
const posterFailed = ref(false);
</script>

<template>
  <button
    type="button"
    class="card card-hover press-feedback flex w-full items-center gap-4 p-3 text-start sm:gap-5"
    @click="replayWhatsNew()"
  >
    <span class="poster relative shrink-0 overflow-hidden" aria-hidden="true">
      <img
        v-if="!posterFailed"
        :src="poster"
        alt=""
        class="h-full w-full object-cover"
        loading="lazy"
        @error="posterFailed = true"
      />
      <span class="absolute inset-0 flex items-center justify-center">
        <span class="play">
          <AppIcon name="play-solid" :size="15" />
        </span>
      </span>
    </span>
    <span class="min-w-0 flex-1 py-1">
      <span class="font-display block text-xl font-bold leading-tight text-text-primary">
        {{ props.title ?? t("help.whatsNew.title", { version: WHATS_NEW_VERSION }) }}
      </span>
      <span class="mt-1.5 block text-sm leading-relaxed text-text-secondary">
        {{ t("help.whatsNew.text") }}
      </span>
      <span class="btn btn-primary btn-sm mt-3">
        <AppIcon name="play-solid" :size="12" />
        {{ t("help.whatsNew.watch") }}
      </span>
    </span>
  </button>
</template>

<style scoped>
/* The video's own format, 9:16, small: a phone held up. */
.poster {
  width: 5.25rem;
  aspect-ratio: 9 / 16;
  border-radius: calc(var(--radius-card) - 0.5rem);
  background-color: color-mix(in srgb, var(--color-brand) 55%, var(--color-surface));
}

.play {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border-radius: 999px;
  background-color: var(--color-surface);
  color: var(--color-primary);
  box-shadow: var(--shadow-pop);
}
</style>
