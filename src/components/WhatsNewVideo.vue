<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { pushOverlay } from "../composables/useOverlayStack";
import { useToast } from "../composables/useToast";
import { useWhatsNew, WHATS_NEW_VERSION, whatsNewVideoUrl } from "../composables/useWhatsNew";
import { analyticsService } from "../services/analyticsService";
import AppIcon from "./icons/AppIcon.vue";

/**
 * The "what's new" video, full screen (see useWhatsNew).
 *
 * At launch it stays invisible while it loads: offline, it never shows,
 * and comes back at a later launch. Opened by hand (the help center,
 * the address), it shows right away, with its poster.
 *
 * It starts with the sound; where the system refuses sound without a touch,
 * it plays muted and offers « Activer le son » ("Turn the sound on"): the
 * video is written to be read, the music only goes with it. At the end, « C'est
 * parti » ("Let's go") closes it and « Revoir la vidéo » plays it again.
 * One leaves at any time, like the Android back gesture: by « Passer »
 * ("Skip") when it came on its own at launch, by « Fermer » ("Close") when
 * it was asked for.
 */

const { t, locale } = useI18n();
const toast = useToast();
const { whatsNewSource, closeWhatsNew } = useWhatsNew();

const source = whatsNewSource.value ?? "help";
const src = whatsNewVideoUrl(locale.value);
const poster = whatsNewVideoUrl(locale.value, "jpg");

const video = ref<HTMLVideoElement | null>(null);
const ready = ref(false);
const muted = ref(false);
const ended = ref(false);
const progress = ref(0);
/** The furthest point reached, in seconds: how much of it was watched. */
let watched = 0;
let started = false;
/** Twenty seconds without anything playable: a network too slow to bother. */
let giveUp = 0;

/** At launch, nothing shows until the video can play. */
const visible = computed(() => source !== "launch" || ready.value);

/** Came on its own, it is skipped; asked for, it is closed. */
const leaveLabel = computed(() =>
  source === "launch" && !ended.value ? t("whatsNew.skip") : t("whatsNew.close"),
);

/** Plays with the sound, or muted where the system wants a touch first. */
async function play(): Promise<void> {
  const el = video.value;
  if (!el) return;
  try {
    el.muted = muted.value;
    await el.play();
  } catch {
    el.muted = true;
    muted.value = true;
    await el.play().catch(() => {});
  }
}

function onReady(): void {
  if (ready.value) return;
  ready.value = true;
  window.clearTimeout(giveUp);
  void play();
}

function onPlaying(): void {
  if (started) return;
  started = true;
  analyticsService.capture("whats_new_video_started", {
    version: WHATS_NEW_VERSION,
    source,
    muted: muted.value,
  });
}

function onTime(): void {
  const el = video.value;
  if (!el || !el.duration) return;
  watched = Math.max(watched, el.currentTime);
  progress.value = el.currentTime / el.duration;
}

function onEnded(): void {
  ended.value = true;
  progress.value = 1;
}

function soundOn(): void {
  muted.value = false;
  if (video.value) video.value.muted = false;
}

function again(): void {
  ended.value = false;
  if (video.value) video.value.currentTime = 0;
  void play();
}

/** A touch on the video pauses it, another resumes it. */
function toggle(): void {
  const el = video.value;
  if (!el || ended.value) return;
  if (el.paused) void play();
  else el.pause();
}

/**
 * Leaves. `via`: `close` (« Passer », « Fermer »), `done` (« C'est parti »), `back`
 * (Android back, Escape), `error` (the video did not load).
 */
function close(via: "close" | "done" | "back" | "error"): void {
  analyticsService.capture("whats_new_video_closed", {
    version: WHATS_NEW_VERSION,
    source,
    via,
    watched_seconds: Math.round(watched),
    completed: ended.value,
  });
  // Not loaded at launch: it will be offered at a later launch.
  closeWhatsNew(!(via === "error" && source === "launch"));
}

function onError(): void {
  window.clearTimeout(giveUp);
  if (source !== "launch") toast.error(t("whatsNew.failed"));
  close("error");
}

const removeOverlay = pushOverlay(() => close("back"));

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") close("back");
}

onMounted(() => {
  giveUp = window.setTimeout(() => {
    if (!ready.value) onError();
  }, 20000);
  document.documentElement.style.overflow = "hidden";
  document.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  window.clearTimeout(giveUp);
  document.documentElement.style.overflow = "";
  document.removeEventListener("keydown", onKeydown);
  removeOverlay();
});
</script>

<template>
  <div
    class="fixed inset-0 z-[95] flex flex-col bg-bg-beige transition-opacity duration-300 dark:bg-gray-900"
    :class="visible ? 'opacity-100' : 'pointer-events-none opacity-0'"
    role="dialog"
    aria-modal="true"
    :aria-label="t('whatsNew.ariaLabel')"
    :aria-hidden="visible ? undefined : 'true'"
  >
    <!-- How far along, and the way out. -->
    <header class="flex items-center gap-4 px-4 pb-3 pt-[calc(0.75rem+var(--safe-top))]">
      <div class="h-1 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
        <div class="h-full rounded-full bg-primary" :style="{ width: `${progress * 100}%` }"></div>
      </div>
      <button type="button" class="btn btn-soft btn-sm" @click="close('close')">
        <AppIcon name="x" :size="16" />
        {{ leaveLabel }}
      </button>
    </header>

    <div class="relative min-h-0 flex-1">
      <video
        ref="video"
        class="h-full w-full object-contain"
        :src="src"
        :poster="poster"
        playsinline
        preload="auto"
        @loadeddata="onReady"
        @canplay="onReady"
        @playing="onPlaying"
        @timeupdate="onTime"
        @ended="onEnded"
        @error="onError"
        @click="toggle"
      ></video>
      <div
        v-if="!ready && visible"
        class="absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <AppIcon name="spinner" :size="28" class="animate-spin text-primary" />
      </div>
    </div>

    <footer
      class="flex min-h-[4.5rem] flex-wrap items-center justify-center gap-3 px-4 pt-3 pb-[calc(1rem+var(--safe-bottom))]"
    >
      <template v-if="ended">
        <button type="button" class="btn btn-soft" @click="again">
          <AppIcon name="rotate-ccw" :size="16" />
          {{ t("whatsNew.again") }}
        </button>
        <button type="button" class="btn btn-primary" @click="close('done')">
          {{ t("whatsNew.done") }}
        </button>
      </template>
      <button v-else-if="muted" type="button" class="btn btn-soft btn-sm" @click="soundOn">
        <AppIcon name="volume-x" :size="16" />
        {{ t("whatsNew.soundOn") }}
      </button>
    </footer>
  </div>
</template>
